import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import ProductSelector from './ProductSelector';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { Order, OrderItem, OrderStep } from '@/types/order';
import { Accessory } from '@/services/accessoriesService';
import { addBusinessDays, subBusinessDays, format, parseISO, isAfter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState<'standard' | 'semi-finished'>('standard');
  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([]);
  const [formData, setFormData] = useState({
    supplier: '',
    expected_delivery: '',
    status: 'pending' as Order['status'],
    notes: '',
    order_reference: ''
  });
  const [orderItems, setOrderItems] = useState<Partial<OrderItem>[]>([]);
  const [orderSteps, setOrderSteps] = useState<Partial<OrderStep>[]>([]);
  const [internalProcessingDays, setInternalProcessingDays] = useState<number>(0);
  const [isScheduleInvalid, setIsScheduleInvalid] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  const isProcessingOnly = orderType === 'semi-finished' && orderItems.length === 0;

  const stepDurations = useMemo(() => orderSteps.map(s => s.expected_duration_days || 0).join(','), [orderSteps]);
  const stepCount = orderSteps.length;

  useEffect(() => {
    if (orderType !== 'semi-finished' || !formData.expected_delivery) {
      setScheduleWarning(null);
      setIsScheduleInvalid(false);
      return;
    }

    const materialDeliveryDate = parseISO(formData.expected_delivery);
    // This will be the end date of the last completed process (internal or external)
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
        endOfLastProcess = stepEndDate; // Update with end date of this step
      }
    }
    
    if (installationDate) {
      const deadline = subBusinessDays(parseISO(installationDate), 5);
      
      if (isAfter(endOfLastProcess, deadline)) {
        setIsScheduleInvalid(true);
        const finishDateStr = format(endOfLastProcess, 'MMM dd, yyyy');
        const installDateStr = format(parseISO(installationDate), 'MMM dd, yyyy');
        setScheduleWarning(`Error: The process is scheduled to finish on ${finishDateStr}, which is less than 5 working days before the installation date (${installDateStr}). Please adjust delivery dates, internal processing, or step durations.`);
      } else {
        setIsScheduleInvalid(false);
        setScheduleWarning(null);
      }
    } else {
      setIsScheduleInvalid(false);
      setScheduleWarning("Warning: Project installation date is not set. Cannot validate delivery timeline.");
    }
    
    if (modified) {
      setOrderSteps(newSteps);
    }

  }, [formData.expected_delivery, stepDurations, stepCount, orderType, installationDate, internalProcessingDays]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setSuppliers(data || []);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    };

    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  useEffect(() => {
    if (prefilledData && open) {
      // Set order items from prefilled data
      setOrderItems(prefilledData.orderItems);

      // Use the supplier from prefilled data if available
      let supplierName = prefilledData.supplier || '';
      if (!supplierName && prefilledData.accessories.length > 0) {
        // Generate supplier name based on accessories if no common supplier
        supplierName = `Accessories Order - ${prefilledData.accessories.map(a => a.article_name).join(', ').substring(0, 50)}${prefilledData.accessories.length > 1 ? '...' : ''}`;
      }
      if (!supplierName) {
        supplierName = 'Accessories Order';
      }
      setFormData(prev => ({
        ...prev,
        supplier: supplierName
      }));
    } else if (!prefilledData && open) {
      // Reset when no prefilled data
      setOrderItems([]);
      setOrderSteps([]);
      setOrderType('standard');
      setFormData({
        supplier: '',
        expected_delivery: '',
        status: 'pending',
        notes: '',
        order_reference: ''
      });
      setInternalProcessingDays(0);
    }
  }, [prefilledData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Create the order
      const orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'> = {
        project_id: projectId,
        supplier: formData.supplier,
        order_date: new Date().toISOString(),
        expected_delivery: new Date(formData.expected_delivery).toISOString(),
        status: formData.status,
        order_type: orderType,
        notes: `Order Reference: ${formData.order_reference}\n\n${formData.notes}`.trim()
      };
      const order = await orderService.create(orderData);

      // Create order items
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
      
      // Create order steps if it's a semi-finished order
      if (orderType === 'semi-finished') {
        for (const [index, step] of orderSteps.entries()) {
          if (!step.name) continue; // Don't save empty steps
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

      toast({
        title: "Success",
        description: "Order created successfully"
      });
      setFormData({
        supplier: '',
        expected_delivery: '',
        status: 'pending',
        notes: '',
        order_reference: ''
      });
      setOrderItems([]);
      setOrderSteps([]);
      onOpenChange(false);
      onSuccess(order.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      description: '',
      quantity: 1,
      article_code: ''
    }]);
  };

  const handleProductSelect = (product: any) => {
    setOrderItems(prev => [...prev, {
      description: product.description || product.name,
      quantity: product.standard_order_quantity || 1,
      article_code: product.article_code || '',
      notes: `Selected from products database - ${product.name}`
    }]);
  };

  const handleGroupSelect = (group: any, products: Array<{ product: any; quantity: number }>) => {
    const newItems = products.map(({ product, quantity }) => ({
      description: product.description || product.name,
      quantity: quantity,
      article_code: product.article_code || '',
      notes: `From group: ${group.name} - ${product.name}`
    }));
    setOrderItems(prev => [...prev, ...newItems]);
  };
  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number | null | undefined) => {
    setOrderItems(prev => prev.map((item, i) => i === index ? {
      ...item,
      [field]: value
    } : item));
  };
  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const addOrderStep = () => {
    setOrderSteps(prev => [...prev, { name: '', step_number: prev.length + 1 }]);
  };

  const updateOrderStep = (index: number, field: keyof OrderStep, value: any) => {
    setOrderSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const removeOrderStep = (index: number) => {
    setOrderSteps(prev => prev.filter((_, i) => i !== index));
  };

  const modalContent = <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create New Order</DialogTitle>
        <DialogDescription>
          Add a new order for this project with order items.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="orderType">Order Type</Label>
          <Select value={orderType} onValueChange={(value: 'standard' | 'semi-finished') => setOrderType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard Order</SelectItem>
              <SelectItem value="semi-finished">Semi-finished Product Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier">{isProcessingOnly ? 'Order Name *' : 'Supplier *'}</Label>
            {isProcessingOnly ? (
              <Input 
                id="supplier" 
                value={formData.supplier} 
                onChange={e => setFormData(prev => ({ ...prev, supplier: e.target.value }))} 
                placeholder="e.g., External Powder Coating Job"
                required 
              />
            ) : (
              <Select value={formData.supplier} onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor="order_reference">Order Reference</Label>
            <Input id="order_reference" value={formData.order_reference} onChange={e => setFormData(prev => ({
            ...prev,
            order_reference: e.target.value
          }))} placeholder="PO number, reference, etc." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expected_delivery">{isProcessingOnly ? 'Processing Start *' : 'Material Delivery *'}</Label>
            <Input id="expected_delivery" type="date" value={formData.expected_delivery} onChange={e => setFormData(prev => ({
            ...prev,
            expected_delivery: e.target.value
          }))} required />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: Order['status']) => setFormData(prev => ({
            ...prev,
            status: value
          }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {orderType === 'semi-finished' && (
            <div>
                <Label htmlFor="internal_processing_days">Internal Processing Duration (days)</Label>
                <Input
                  id="internal_processing_days"
                  type="number"
                  min="0"
                  value={internalProcessingDays}
                  onChange={(e) => setInternalProcessingDays(parseInt(e.target.value) || 0)}
                  placeholder="Days for internal work before external steps"
                />
            </div>
        )}

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={formData.notes} onChange={e => setFormData(prev => ({
          ...prev,
          notes: e.target.value
        }))} placeholder="Additional notes about this order..." />
        </div>

        {scheduleWarning && (
            <div className={`p-3 border-l-4 ${isScheduleInvalid ? 'bg-red-100 border-red-500 text-red-700' : 'bg-yellow-100 border-yellow-500 text-yellow-700'}`}>
                <p className="font-bold">{isScheduleInvalid ? 'Error' : 'Warning'}</p>
                <p>{scheduleWarning}</p>
            </div>
        )}

        {orderType === 'semi-finished' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>External Processing Steps</CardTitle>
                <Button type="button" onClick={addOrderStep} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orderSteps.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Define any external processing steps for this order.
                </p>
              ) : (
                <div className="space-y-4">
                  {orderSteps.map((step, index) => (
                    <div key={index} className="flex gap-2 items-end p-2 border rounded">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Step Name *</Label>
                            <Input value={step.name} onChange={e => updateOrderStep(index, 'name', e.target.value)} placeholder="e.g., Powder Coating" required />
                          </div>
                          <div>
                            <Label>Supplier</Label>
                            <Input value={step.supplier || ''} onChange={e => updateOrderStep(index, 'supplier', e.target.value)} placeholder="External processor" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label>Start Date</Label>
                                <Input type="date" value={step.start_date || ''} readOnly />
                            </div>
                            <div>
                                <Label>Expected Duration (days)</Label>
                                <Input type="number" min="1" value={step.expected_duration_days || ''} onChange={e => updateOrderStep(index, 'expected_duration_days', parseInt(e.target.value))} />
                            </div>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeOrderStep(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Order Items</CardTitle>
              <div className="flex gap-2">
                <ProductSelector 
                  onProductSelect={handleProductSelect} 
                  onGroupSelect={handleGroupSelect}
                  buttonText="Add from Products" 
                />
                <Button type="button" onClick={addOrderItem} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Item
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {orderItems.length === 0 ? <p className="text-muted-foreground text-center py-4">
                {isProcessingOnly
                  ? "This is a processing-only order. Add items if you also need to order materials."
                  : 'No items added yet. Click "Add Item" to get started.'}
              </p> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => <TableRow key={index}>
                      <TableCell>
                        <Input value={item.article_code || ''} onChange={e => updateOrderItem(index, 'article_code', e.target.value)} placeholder="Article code" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.description || ''} onChange={e => updateOrderItem(index, 'description', e.target.value)} placeholder="Item description" required />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)} required />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOrderItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || isScheduleInvalid}>
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </DialogContent>;
  if (showAddOrderButton) {
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          
        </DialogTrigger>
        {modalContent}
      </Dialog>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
      {modalContent}
    </Dialog>;
};
export default NewOrderModal;
