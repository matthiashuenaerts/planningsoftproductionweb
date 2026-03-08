import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, FileUp, Loader2 } from 'lucide-react';
import ProductSelector from './ProductSelector';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { orderService } from '@/services/orderService';
import { Order, OrderItem, OrderStep } from '@/types/order';
import { Accessory } from '@/services/accessoriesService';
import { addBusinessDays, subBusinessDays, format, parseISO, isAfter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parsePDFForOrder, ParsedOrderData } from '@/services/pdfParseService';
import { useIsMobile } from '@/hooks/use-mobile';

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: (orderId?: string) => void;
  showAddOrderButton?: boolean;
  prefilledData?: {
    accessories: any[];
    orderItems: Partial<OrderItem>[];
    supplier?: string;
  } | null;
  accessories?: Accessory[];
  installationDate?: string;
}

const NewOrderModal = ({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  showAddOrderButton = false,
  prefilledData = null,
  accessories = [],
  installationDate,
}: NewOrderModalProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [orderType, setOrderType] = useState<'standard' | 'semi-finished'>('standard');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [taskGroups, setTaskGroups] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [parsedPdfData, setParsedPdfData] = useState<ParsedOrderData | null>(null);
  const [formData, setFormData] = useState({
    supplier: '',
    expected_delivery: '',
    status: 'pending' as Order['status'],
    notes: '',
    order_reference: '',
    task_group_id: '',
  });
  const [orderItems, setOrderItems] = useState<Partial<OrderItem>[]>([]);
  const [orderSteps, setOrderSteps] = useState<Partial<OrderStep>[]>([]);
  const [internalProcessingDays, setInternalProcessingDays] = useState<number>(0);
  const [isScheduleInvalid, setIsScheduleInvalid] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  const isProcessingOnly = orderType === 'semi-finished' && orderItems.length === 0;
  const stepDurations = useMemo(() => orderSteps.map(s => s.expected_duration_days || 0).join(','), [orderSteps]);
  const stepCount = orderSteps.length;

  // ── Schedule validation ──
  useEffect(() => {
    if (orderType !== 'semi-finished' || !formData.expected_delivery) {
      setScheduleWarning(null);
      setIsScheduleInvalid(false);
      return;
    }
    const materialDeliveryDate = parseISO(formData.expected_delivery);
    let endOfLastProcess = materialDeliveryDate;
    if (internalProcessingDays > 0) {
      endOfLastProcess = addBusinessDays(materialDeliveryDate, internalProcessingDays - 1);
    }
    const newSteps = JSON.parse(JSON.stringify(orderSteps));
    let modified = false;
    if (newSteps.length > 0) {
      let nextStepStartDate = addBusinessDays(materialDeliveryDate, internalProcessingDays);
      for (let i = 0; i < newSteps.length; i++) {
        const step = newSteps[i];
        const stepStartDate = nextStepStartDate;
        const formattedStartDate = format(stepStartDate, 'yyyy-MM-dd');
        if (step.start_date !== formattedStartDate) {
          step.start_date = formattedStartDate;
          modified = true;
        }
        const duration = Math.max(1, step.expected_duration_days || 1);
        const stepEndDate = addBusinessDays(stepStartDate, duration - 1);
        nextStepStartDate = addBusinessDays(stepEndDate, 1);
        endOfLastProcess = stepEndDate;
      }
    }
    if (installationDate) {
      const deadline = subBusinessDays(parseISO(installationDate), 5);
      if (isAfter(endOfLastProcess, deadline)) {
        setIsScheduleInvalid(true);
        const finishDateStr = format(endOfLastProcess, 'MMM dd, yyyy');
        const installDateStr = format(parseISO(installationDate), 'MMM dd, yyyy');
        setScheduleWarning(t('schedule_error_message', { finishDate: finishDateStr, installDate: installDateStr }));
      } else {
        setIsScheduleInvalid(false);
        setScheduleWarning(null);
      }
    } else {
      setIsScheduleInvalid(false);
      setScheduleWarning(t('schedule_no_install_date'));
    }
    if (modified) setOrderSteps(newSteps);
  }, [formData.expected_delivery, stepDurations, stepCount, orderType, installationDate, internalProcessingDays]);

  // ── Fetch suppliers, task groups, products, materials ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersRes, groupsRes, productsRes, materialsRes] = await Promise.all([
          supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
          supabase.from('order_task_groups').select('id, name').order('name'),
          supabase.from('products').select('id, name, article_code, description, supplier, price_per_unit').order('name'),
          supabase.from('cabinet_materials').select('id, name, sku, category, cost_per_unit, supplier').order('name'),
        ]);
        setSuppliers(suppliersRes.data || []);
        setTaskGroups((groupsRes.data as { id: string; name: string }[]) || []);
        setProducts(productsRes.data || []);
        setMaterials(materialsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    if (open) fetchData();
  }, [open]);

  // ── Prefill data ──
  useEffect(() => {
    if (prefilledData && open) {
      setOrderItems(prefilledData.orderItems);
      let supplierName = prefilledData.supplier || '';
      if (!supplierName && prefilledData.accessories.length > 0) {
        supplierName = `Accessories Order - ${prefilledData.accessories.map(a => a.article_name).join(', ').substring(0, 50)}${prefilledData.accessories.length > 1 ? '...' : ''}`;
      }
      if (!supplierName) supplierName = 'Accessories Order';
      setFormData(prev => ({ ...prev, supplier: supplierName }));
    } else if (!prefilledData && open) {
      setOrderItems([]);
      setOrderSteps([]);
      setOrderType('standard');
      setFormData({ supplier: '', expected_delivery: '', status: 'pending', notes: '', order_reference: '', task_group_id: '' });
      setInternalProcessingDays(0);
      setParsedPdfData(null);
    }
  }, [prefilledData, open]);

  // ── PDF Import ──
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: t('pdf_invalid_file'), variant: 'destructive' });
      return;
    }
    setPdfLoading(true);
    try {
      const productMatches = products.map(p => ({ id: p.id, name: p.name, article_code: p.article_code || '', description: p.description || undefined, supplier: p.supplier || undefined }));
      const materialMatches = materials.map(m => ({ id: m.id, name: m.name, sku: m.sku, category: m.category }));
      const supplierMatches = suppliers.map(s => ({ id: s.id, name: s.name }));

      const parsed = await parsePDFForOrder(file, productMatches, materialMatches, supplierMatches);
      setParsedPdfData(parsed);

      // Auto-fill supplier
      if (!formData.supplier && parsed.supplier) {
        const matched = suppliers.find(s => s.name.toLowerCase() === parsed.supplier?.toLowerCase());
        setFormData(prev => ({ ...prev, supplier: matched?.name || parsed.supplier || '' }));
      }
      // Auto-fill order reference
      if (!formData.order_reference && parsed.orderNumber) {
        setFormData(prev => ({ ...prev, order_reference: parsed.orderNumber || '' }));
      }
      // Auto-fill delivery date
      if (!formData.expected_delivery && parsed.expectedDelivery) {
        setFormData(prev => ({ ...prev, expected_delivery: parsed.expectedDelivery || '' }));
      }
      // Auto-fill notes
      if (parsed.notes && !formData.notes) {
        setFormData(prev => ({ ...prev, notes: parsed.notes || '' }));
      }

      // Add parsed items
      if (parsed.items.length > 0) {
        const newItems: Partial<OrderItem>[] = parsed.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          article_code: item.article_code,
          ean: item.ean || '',
          notes: item.notes || '',
        }));
        setOrderItems(prev => {
          const existing = prev.filter(item => item.description || item.article_code);
          return [...existing, ...newItems];
        });
        toast({ title: t('pdf_parsed_success', { count: String(parsed.items.length) }) });
      } else {
        toast({ title: t('pdf_parsed_no_items') });
      }
    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      toast({ title: t('pdf_parse_error'), description: error.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'> = {
        project_id: projectId,
        supplier: formData.supplier,
        order_date: new Date().toISOString(),
        expected_delivery: new Date(formData.expected_delivery).toISOString(),
        status: formData.status,
        order_type: orderType,
        notes: `Order Reference: ${formData.order_reference}\n\n${formData.notes}`.trim(),
        task_group_id: formData.task_group_id || null,
      };
      const order = await orderService.create(orderData);
      for (const item of orderItems) {
        await orderService.createOrderItem({
          order_id: order.id,
          description: item.description!,
          quantity: item.quantity!,
          article_code: item.article_code!,
          accessory_id: item.accessory_id,
          notes: item.notes,
        });
      }
      if (orderType === 'semi-finished') {
        for (const [index, step] of orderSteps.entries()) {
          if (!step.name) continue;
          await orderService.createOrderStep({
            order_id: order.id,
            step_number: index + 1,
            name: step.name,
            supplier: step.supplier,
            status: 'pending',
            start_date: step.start_date,
            expected_duration_days: step.expected_duration_days,
            notes: step.notes,
          });
        }
      }
      toast({ title: t('order_created_success') });
      setFormData({ supplier: '', expected_delivery: '', status: 'pending', notes: '', order_reference: '', task_group_id: '' });
      setOrderItems([]);
      setOrderSteps([]);
      setParsedPdfData(null);
      onOpenChange(false);
      onSuccess(order.id);
    } catch (error: any) {
      toast({ title: t('order_create_error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => setOrderItems(prev => [...prev, { description: '', quantity: 1, article_code: '' }]);

  const handleProductSelect = (product: any) => {
    setOrderItems(prev => [...prev, {
      description: product.description || product.name,
      quantity: product.standard_order_quantity || 1,
      article_code: product.article_code || '',
      notes: `Selected from products database - ${product.name}`,
    }]);
  };

  const handleGroupSelect = (group: any, groupProducts: Array<{ product: any; quantity: number }>) => {
    const newItems = groupProducts.map(({ product, quantity }) => ({
      description: product.description || product.name,
      quantity,
      article_code: product.article_code || '',
      notes: `From group: ${group.name} - ${product.name}`,
    }));
    setOrderItems(prev => [...prev, ...newItems]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number | null | undefined) => {
    setOrderItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeOrderItem = (index: number) => setOrderItems(prev => prev.filter((_, i) => i !== index));

  const addOrderStep = () => setOrderSteps(prev => [...prev, { name: '', step_number: prev.length + 1 }]);

  const updateOrderStep = (index: number, field: keyof OrderStep, value: any) => {
    setOrderSteps(prev => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const removeOrderStep = (index: number) => setOrderSteps(prev => prev.filter((_, i) => i !== index));

  const modalContent = (
    <DialogContent className={cn(
      "max-h-[90vh] overflow-y-auto",
      isMobile ? "max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4" : "max-w-4xl"
    )}>
      <DialogHeader>
        <DialogTitle className={isMobile ? "text-base" : ""}>{t('create_new_order')}</DialogTitle>
        <DialogDescription className={isMobile ? "text-xs" : ""}>{t('create_new_order_desc')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Order Type */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground">{t('order_type')}</Label>
          <Select value={orderType} onValueChange={(value: 'standard' | 'semi-finished') => setOrderType(value)}>
            <SelectTrigger className="h-9 rounded-lg mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">{t('order_type_standard')}</SelectItem>
              <SelectItem value="semi-finished">{t('order_type_semi_finished')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Supplier + Order Reference */}
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">{isProcessingOnly ? `${t('order_name')} *` : `${t('supplier')} *`}</Label>
            {isProcessingOnly ? (
              <Input
                value={formData.supplier}
                onChange={e => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                placeholder="e.g., External Powder Coating Job"
                required
                className="h-9 rounded-lg mt-0.5"
              />
            ) : (
              <Select value={formData.supplier} onValueChange={value => setFormData(prev => ({ ...prev, supplier: value }))}>
                <SelectTrigger className="h-9 rounded-lg mt-0.5">
                  <SelectValue placeholder={t('select_supplier')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">{t('order_reference')}</Label>
            <Input
              value={formData.order_reference}
              onChange={e => setFormData(prev => ({ ...prev, order_reference: e.target.value }))}
              placeholder={t('order_reference_placeholder')}
              className="h-9 rounded-lg mt-0.5"
            />
          </div>
        </div>

        {/* Delivery + Status */}
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">{isProcessingOnly ? `${t('processing_start')} *` : `${t('material_delivery')} *`}</Label>
            <Input type="date" value={formData.expected_delivery} onChange={e => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))} required className="h-9 rounded-lg mt-0.5" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">{t('status')}</Label>
            <Select value={formData.status} onValueChange={(value: Order['status']) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="h-9 rounded-lg mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('status_pending')}</SelectItem>
                <SelectItem value="delivered">{t('status_delivered')}</SelectItem>
                <SelectItem value="canceled">{t('status_canceled')}</SelectItem>
                <SelectItem value="delayed">{t('status_delayed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {taskGroups.length > 0 && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">{t('task_dependency_group')}</Label>
              <Select value={formData.task_group_id} onValueChange={value => setFormData(prev => ({ ...prev, task_group_id: value === '_none_' ? '' : value }))}>
                <SelectTrigger className="h-9 rounded-lg mt-0.5"><SelectValue placeholder={t('task_dependency_none')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">{t('task_dependency_none')}</SelectItem>
                  {taskGroups.map(g => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t('task_dependency_hint')}</p>
            </div>
          )}
        </div>

        {/* Internal processing for semi-finished */}
        {orderType === 'semi-finished' && (
          <div>
            <Label className="text-xs font-medium text-muted-foreground">{t('internal_processing_duration')}</Label>
            <Input type="number" min="0" value={internalProcessingDays} onChange={e => setInternalProcessingDays(parseInt(e.target.value) || 0)} placeholder={t('internal_processing_placeholder')} className="h-9 rounded-lg mt-0.5" />
          </div>
        )}

        {/* Notes */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground">{t('notes')}</Label>
          <Textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder={t('notes_placeholder')} className="rounded-lg mt-0.5 min-h-[48px]" rows={2} />
        </div>

        {/* Schedule warning */}
        {scheduleWarning && (
          <div className={`p-2.5 border-l-4 rounded-lg text-sm ${isScheduleInvalid ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-yellow-100 border-yellow-500 text-yellow-700'}`}>
            <p className="font-semibold text-xs">{isScheduleInvalid ? t('schedule_error') : t('schedule_warning')}</p>
            <p className="text-xs mt-0.5">{scheduleWarning}</p>
          </div>
        )}

        {/* PDF confidence badge */}
        {parsedPdfData && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={parsedPdfData.extractionConfidence === 'high' ? 'default' : parsedPdfData.extractionConfidence === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">
              {t(`pdf_confidence_${parsedPdfData.extractionConfidence}`)}
            </Badge>
            {parsedPdfData.supplier && <span className="text-muted-foreground">{t('pdf_detected_supplier', { name: parsedPdfData.supplier })}</span>}
            {parsedPdfData.orderNumber && <span className="text-muted-foreground">{t('pdf_detected_order_number', { number: parsedPdfData.orderNumber })}</span>}
          </div>
        )}

        {/* External processing steps */}
        {orderType === 'semi-finished' && (
          <Card className="rounded-lg border-border/50">
            <CardHeader className="p-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm">{t('external_processing_steps')}</CardTitle>
                <Button type="button" onClick={addOrderStep} variant="outline" size="sm" className="h-7 text-xs rounded-lg">
                  <Plus className="mr-1 h-3 w-3" /> {t('add_step')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {orderSteps.length === 0 ? (
                <p className="text-muted-foreground text-center py-3 text-xs">{t('define_external_steps')}</p>
              ) : (
                <div className="space-y-2">
                  {orderSteps.map((step, index) => (
                    <div key={index} className="flex gap-2 items-end p-2 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('step_name')} *</Label>
                            <Input value={step.name} onChange={e => updateOrderStep(index, 'name', e.target.value)} placeholder={t('step_name_placeholder')} required className="h-8 text-sm rounded-lg mt-0.5" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('step_supplier')}</Label>
                            <Input value={step.supplier || ''} onChange={e => updateOrderStep(index, 'supplier', e.target.value)} placeholder={t('step_supplier_placeholder')} className="h-8 text-sm rounded-lg mt-0.5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('start_date')}</Label>
                            <Input type="date" value={step.start_date || ''} readOnly className="h-8 text-sm rounded-lg mt-0.5" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('expected_duration_days')}</Label>
                            <Input type="number" min="1" value={step.expected_duration_days || ''} onChange={e => updateOrderStep(index, 'expected_duration_days', parseInt(e.target.value))} className="h-8 text-sm rounded-lg mt-0.5" />
                          </div>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeOrderStep(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="rounded-lg border-border/50">
          <CardHeader className="p-3">
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-center'}`}>
              <CardTitle className="text-sm">{t('order_items')}</CardTitle>
              <div className="flex gap-1.5 flex-wrap">
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()} disabled={pdfLoading} className="h-7 text-xs rounded-lg">
                        {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                        <span className="ml-1">{pdfLoading ? t('pdf_parsing') : t('import_pdf')}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('import_pdf_tooltip')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ProductSelector onProductSelect={handleProductSelect} onGroupSelect={handleGroupSelect} buttonText={t('add_from_products')} />
                <Button type="button" onClick={addOrderItem} variant="outline" size="sm" className="h-7 text-xs rounded-lg">
                  <Plus className="mr-0.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('add_custom_item')}</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-xs">
                {isProcessingOnly ? t('processing_only_hint') : t('no_items_hint')}
              </p>
            ) : isMobile ? (
              <div className="space-y-2">
                {orderItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-2.5 space-y-1.5 bg-muted/20">
                    <div className="flex justify-between items-center">
                      <Label className="text-[11px] text-muted-foreground">{t('article_code')}</Label>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOrderItem(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input value={item.article_code || ''} onChange={e => updateOrderItem(index, 'article_code', e.target.value)} placeholder={t('article_code')} className="h-8 text-sm rounded-lg" />
                    <div>
                      <Label className="text-[11px] text-muted-foreground">{t('description')}</Label>
                      <Input value={item.description || ''} onChange={e => updateOrderItem(index, 'description', e.target.value)} placeholder={t('description')} required className="h-8 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">{t('quantity')}</Label>
                      <Input type="number" min="1" value={item.quantity} onChange={e => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)} required className="h-8 text-sm rounded-lg w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('article_code')}</TableHead>
                    <TableHead>{t('description')}</TableHead>
                    <TableHead>{t('quantity')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input value={item.article_code || ''} onChange={e => updateOrderItem(index, 'article_code', e.target.value)} placeholder={t('article_code')} />
                      </TableCell>
                      <TableCell>
                        <Input value={item.description || ''} onChange={e => updateOrderItem(index, 'description', e.target.value)} placeholder={t('description')} required />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)} required className="w-20" />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOrderItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={loading || isScheduleInvalid} className={cn("h-9 rounded-lg active:scale-[0.98] transition-transform", isMobile && "flex-1")}>
            {loading ? t('creating_order') : t('create_order')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={cn("h-9 rounded-lg active:scale-[0.98] transition-transform", isMobile && "flex-1")}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  if (showAddOrderButton) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild><span /></DialogTrigger>
        {modalContent}
      </Dialog>
    );
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>{modalContent}</Dialog>;
};

export default NewOrderModal;
