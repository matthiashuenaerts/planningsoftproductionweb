import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Plus, CheckCircle, Clock, Package, Wrench, Building2, ClipboardList,
  Trash2, Loader2, AlertCircle, ChevronsUpDown, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceTicketItemsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  assignmentId: string | null;
}

interface TicketItem {
  id: string;
  assignment_id: string;
  item_type: 'todo' | 'order_request' | 'production_task' | 'office_task';
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  order_article_code?: string | null;
  order_supplier?: string | null;
  order_quantity?: number | null;
}

interface ServiceAssignment {
  id: string;
  team: string;
  start_date: string | null;
  service_notes: string | null;
  service_hours: number | null;
}

interface ProductOption {
  id: string;
  name: string;
  article_code?: string;
  supplier?: string;
}

const ITEM_TYPE_CONFIG = {
  todo: { label: 'To-do', icon: ClipboardList, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  order_request: { label: 'Bestelling', icon: Package, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  production_task: { label: 'Productie', icon: Wrench, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  office_task: { label: 'Kantoor', icon: Building2, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
};

const ServiceTicketItemsPanel: React.FC<ServiceTicketItemsPanelProps> = ({
  open, onOpenChange, projectId, projectName, assignmentId,
}) => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [items, setItems] = useState<TicketItem[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // New item form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<string>('todo');
  const [newPriority, setNewPriority] = useState('medium');
  const [showForm, setShowForm] = useState(false);
  const [targetAssignmentId, setTargetAssignmentId] = useState<string>('');

  // Order-specific fields
  const [orderArticleCode, setOrderArticleCode] = useState('');
  const [orderSupplier, setOrderSupplier] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ticketAssignments } = await supabase
        .from('project_team_assignments')
        .select('id, team, start_date, service_notes, service_hours')
        .eq('project_id', projectId)
        .eq('is_service_ticket', true)
        .order('created_at');

      setAssignments((ticketAssignments || []) as ServiceAssignment[]);

      if (ticketAssignments && ticketAssignments.length > 0) {
        const ids = ticketAssignments.map(a => a.id);
        const { data: itemsData } = await supabase
          .from('service_ticket_items' as any)
          .select('*')
          .in('assignment_id', ids)
          .order('created_at', { ascending: false });
        setItems((itemsData as any) || []);
      } else {
        setItems([]);
      }

      if (ticketAssignments && ticketAssignments.length > 0) {
        setTargetAssignmentId(ticketAssignments[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load products/accessories for order selection
  const loadProducts = useCallback(async () => {
    try {
      let query = supabase.from('products' as any).select('id, name, article_code, supplier').limit(200);
      if (tenant?.id) {
        query = applyTenantFilter(query, tenant.id);
      }
      const { data } = await query;
      setProducts((data as any) || []);
    } catch { /* ignore */ }
  }, [tenant?.id]);

  useEffect(() => {
    if (open) {
      loadData();
      loadProducts();
    }
  }, [open, loadData, loadProducts]);

  const createServiceTicket = async () => {
    try {
      const { data, error } = await supabase
        .from('project_team_assignments')
        .insert({
          project_id: projectId,
          team: 'Naservice',
          duration: 1,
          is_service_ticket: true,
          service_notes: '',
        } as any)
        .select('id')
        .single();

      if (error) throw error;
      toast({ title: 'Service ticket aangemaakt' });
      await loadData();
      setTargetAssignmentId(data.id);
      return data.id;
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const handleAddItem = async () => {
    if (!newTitle.trim() || !currentEmployee) return;
    setSaving(true);
    try {
      let aId = targetAssignmentId;
      if (!aId) {
        const created = await createServiceTicket();
        if (!created) return;
        aId = created;
      }

      const insertData: any = {
        assignment_id: aId,
        item_type: newType,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        priority: newPriority,
        created_by: currentEmployee.id,
      };

      // Add order-specific fields
      if (newType === 'order_request') {
        insertData.order_article_code = orderArticleCode.trim() || null;
        insertData.order_supplier = orderSupplier.trim() || null;
        insertData.order_quantity = orderQuantity || 1;
      }

      const { error } = await supabase.from('service_ticket_items' as any).insert(insertData);
      if (error) throw error;

      toast({ title: 'Item toegevoegd' });
      resetForm();
      loadData();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setOrderArticleCode('');
    setOrderSupplier('');
    setOrderQuantity(1);
    setShowForm(false);
  };

  const toggleItemStatus = async (item: TicketItem) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('service_ticket_items' as any).update({ status: newStatus }).eq('id', item.id);
    loadData();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('service_ticket_items' as any).delete().eq('id', id);
    loadData();
  };

  const selectProduct = (product: ProductOption) => {
    setNewTitle(product.name);
    setOrderArticleCode(product.article_code || '');
    setOrderSupplier(product.supplier || '');
    setProductPopoverOpen(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.article_code && p.article_code.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredItems = activeTab === 'all'
    ? items
    : items.filter(i => i.item_type === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-2xl max-h-[85vh] overflow-hidden flex flex-col'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Naservice - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {/* Tabs for filtering */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`w-full ${isMobile ? 'grid grid-cols-3' : 'grid grid-cols-5'}`}>
              <TabsTrigger value="all" className="text-xs">Alles</TabsTrigger>
              <TabsTrigger value="todo" className="text-xs">To-do</TabsTrigger>
              <TabsTrigger value="order_request" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                {isMobile ? 'Best.' : 'Bestellingen'}
              </TabsTrigger>
              {!isMobile && (
                <>
                  <TabsTrigger value="production_task" className="text-xs">Productie</TabsTrigger>
                  <TabsTrigger value="office_task" className="text-xs">Kantoor</TabsTrigger>
                </>
              )}
            </TabsList>
            {isMobile && (
              <TabsList className="w-full grid grid-cols-2 mt-1">
                <TabsTrigger value="production_task" className="text-xs">Productie</TabsTrigger>
                <TabsTrigger value="office_task" className="text-xs">Kantoor</TabsTrigger>
              </TabsList>
            )}
          </Tabs>

          {/* Add button */}
          {!showForm && (
            <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> Item Toevoegen
            </Button>
          )}

          {/* Add form */}
          {showForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To-do</SelectItem>
                      <SelectItem value="order_request">Bestelling nodig</SelectItem>
                      <SelectItem value="production_task">Productie taak</SelectItem>
                      <SelectItem value="office_task">Kantoor taak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prioriteit</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Laag</SelectItem>
                      <SelectItem value="medium">Normaal</SelectItem>
                      <SelectItem value="high">Hoog</SelectItem>
                      <SelectItem value="critical">Kritiek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product selection for order_request */}
              {newType === 'order_request' && (
                <div className="space-y-3 border border-border rounded-md p-3 bg-background">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Bestelling details
                  </Label>
                  
                  {/* Product selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Product selecteren (optioneel)</Label>
                    <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                          <span className="truncate">{newTitle || 'Zoek een product...'}</span>
                          <ChevronsUpDown className="h-3.5 w-3.5 ml-2 flex-shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Zoek product of artikelcode..."
                            value={productSearch}
                            onValueChange={setProductSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Geen producten gevonden</CommandEmpty>
                            <CommandGroup className="max-h-48 overflow-y-auto">
                              {filteredProducts.slice(0, 30).map(p => (
                                <CommandItem key={p.id} onSelect={() => selectProduct(p)} className="text-sm">
                                  <div className="flex flex-col">
                                    <span>{p.name}</span>
                                    {p.article_code && (
                                      <span className="text-xs text-muted-foreground">{p.article_code}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Artikelcode</Label>
                      <Input
                        value={orderArticleCode}
                        onChange={e => setOrderArticleCode(e.target.value)}
                        placeholder="Artikelcode"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Leverancier</Label>
                      <Input
                        value={orderSupplier}
                        onChange={e => setOrderSupplier(e.target.value)}
                        placeholder="Leverancier"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aantal</Label>
                    <Input
                      type="number"
                      min={1}
                      value={orderQuantity}
                      onChange={e => setOrderQuantity(parseInt(e.target.value) || 1)}
                      className="h-9 text-sm w-24"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">{newType === 'order_request' ? 'Product / Omschrijving' : 'Titel'}</Label>
                <Input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Omschrijving van het item..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Details (optioneel)</Label>
                <Textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Extra details..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              {assignments.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Service Ticket</Label>
                  <Select value={targetAssignmentId} onValueChange={setTargetAssignmentId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.team} {a.start_date ? `(${a.start_date})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAddItem} disabled={saving || !newTitle.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Toevoegen
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>Annuleren</Button>
              </div>
            </div>
          )}

          {/* Items list */}
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Laden...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {assignments.length === 0
                ? 'Nog geen service tickets. Voeg een item toe om automatisch een ticket aan te maken.'
                : 'Geen items gevonden.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map(item => {
                const config = ITEM_TYPE_CONFIG[item.item_type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.todo;
                const Icon = config.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-border transition-colors ${
                      item.status === 'completed' ? 'opacity-60 bg-muted/30' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleItemStatus(item)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {item.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${item.status === 'completed' ? 'line-through' : ''}`}>
                          {item.title}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {item.priority === 'high' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            <AlertCircle className="h-3 w-3 mr-1" /> Hoog
                          </Badge>
                        )}
                        {item.priority === 'critical' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Kritiek
                          </Badge>
                        )}
                      </div>
                      {/* Order details */}
                      {item.item_type === 'order_request' && (item.order_article_code || item.order_supplier || item.order_quantity) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {item.order_article_code && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Code: {item.order_article_code}</span>
                          )}
                          {item.order_supplier && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Lev: {item.order_supplier}</span>
                          )}
                          {item.order_quantity && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Qty: {item.order_quantity}</span>
                          )}
                        </div>
                      )}
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceTicketItemsPanel;
