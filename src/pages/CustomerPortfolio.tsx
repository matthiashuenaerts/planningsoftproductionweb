import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Plus, Search, Edit3, Trash2, User, Mail, Phone, MapPin, Building2, FileText, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { customerService, Customer } from '@/services/customerService';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const CustomerPortfolio: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const { tenant } = useTenant();
  const isMobile = useIsMobile();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerProjects, setCustomerProjects] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company_name: '',
    address_street: '', address_number: '', address_postal_code: '',
    address_city: '', address_country: '', vat_number: '', notes: '',
  });

  useEffect(() => { loadCustomers(); }, [tenant?.id]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAll(tenant?.id);
      setCustomers(data);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const loadCustomerProjects = async (customerId: string) => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, client, status, installation_date, created_at, installation_status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    setCustomerProjects(data ?? []);
  };

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadCustomerProjects(customer.id);
  };

  const handleCreateCustomer = async () => {
    try {
      await customerService.create(formData);
      toast({ title: t('success'), description: 'Customer created' });
      setShowCreateDialog(false);
      resetForm();
      loadCustomers();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      const updated = await customerService.update(selectedCustomer.id, formData);
      toast({ title: t('success'), description: 'Customer updated' });
      setShowEditDialog(false);
      setSelectedCustomer(updated);
      loadCustomers();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await customerService.delete(id);
      toast({ title: t('success'), description: 'Customer deleted' });
      setSelectedCustomer(null);
      loadCustomers();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (customer: Customer) => {
    setFormData({
      name: customer.name, email: customer.email || '', phone: customer.phone || '',
      company_name: customer.company_name || '', address_street: customer.address_street || '',
      address_number: customer.address_number || '', address_postal_code: customer.address_postal_code || '',
      address_city: customer.address_city || '', address_country: customer.address_country || '',
      vat_number: customer.vat_number || '', notes: customer.notes || '',
    });
    setShowEditDialog(true);
  };

  const resetForm = () => setFormData({
    name: '', email: '', phone: '', company_name: '',
    address_street: '', address_number: '', address_postal_code: '',
    address_city: '', address_country: '', vat_number: '', notes: '',
  });

  const filtered = searchQuery.trim()
    ? customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers;

  const CustomerForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Company</Label><Input value={formData.company_name} onChange={e => setFormData(f => ({ ...f, company_name: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Street</Label><Input value={formData.address_street} onChange={e => setFormData(f => ({ ...f, address_street: e.target.value }))} /></div>
        <div><Label>Number</Label><Input value={formData.address_number} onChange={e => setFormData(f => ({ ...f, address_number: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Postal Code</Label><Input value={formData.address_postal_code} onChange={e => setFormData(f => ({ ...f, address_postal_code: e.target.value }))} /></div>
        <div><Label>City</Label><Input value={formData.address_city} onChange={e => setFormData(f => ({ ...f, address_city: e.target.value }))} /></div>
        <div><Label>Country</Label><Input value={formData.address_country} onChange={e => setFormData(f => ({ ...f, address_country: e.target.value }))} /></div>
      </div>
      <div><Label>VAT Number</Label><Input value={formData.vat_number} onChange={e => setFormData(f => ({ ...f, vat_number: e.target.value }))} /></div>
      <div><Label>Notes</Label><Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} className="resize-none" /></div>
      <Button onClick={onSubmit} disabled={!formData.name.trim()} className="w-full">{submitLabel}</Button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate(createLocalizedPath('/projects'))} className="mb-3 -ml-2">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {t('back_to_projects')}
          </Button>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Customer Portfolio</h1>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Customer
            </Button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className={cn("gap-4", selectedCustomer ? 'grid grid-cols-1 lg:grid-cols-3' : '')}>
            {/* Customer list */}
            <div className={selectedCustomer ? 'lg:col-span-1' : ''}>
              <div className="space-y-2">
                {loading ? <p className="text-muted-foreground text-sm">Loading...</p> :
                  filtered.length === 0 ? <p className="text-muted-foreground text-sm">No customers found</p> :
                  filtered.map(c => (
                    <Card key={c.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", selectedCustomer?.id === c.id && 'ring-2 ring-primary')} onClick={() => handleSelectCustomer(c)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{c.name}</p>
                            {c.company_name && <p className="text-xs text-muted-foreground truncate">{c.company_name}</p>}
                            {c.address_city && <p className="text-xs text-muted-foreground">{c.address_city}</p>}
                          </div>
                          <div className="flex gap-1">
                            {c.email && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                            {c.phone && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            </div>

            {/* Customer detail */}
            {selectedCustomer && (
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" /> {selectedCustomer.name}</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedCustomer)}><Edit3 className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteCustomer(selectedCustomer.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedCustomer.company_name && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{selectedCustomer.company_name}</div>}
                    {selectedCustomer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selectedCustomer.email}</div>}
                    {selectedCustomer.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selectedCustomer.phone}</div>}
                    {selectedCustomer.address_street && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{[selectedCustomer.address_street, selectedCustomer.address_number, selectedCustomer.address_postal_code, selectedCustomer.address_city].filter(Boolean).join(', ')}</div>}
                    {selectedCustomer.vat_number && <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />VAT: {selectedCustomer.vat_number}</div>}
                    {selectedCustomer.notes && <p className="text-muted-foreground text-xs mt-2">{selectedCustomer.notes}</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Projects ({customerProjects.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customerProjects.length === 0 ? <p className="text-sm text-muted-foreground">No projects linked to this customer</p> : (
                      <div className="space-y-2">
                        {customerProjects.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50" onClick={() => navigate(createLocalizedPath(`/projects/${p.id}`))}>
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.installation_date ? new Date(p.installation_date).toLocaleDateString() : 'No date'}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                              {p.installation_status && (
                                <Badge variant="outline" className={cn("text-[10px]", p.installation_status === 'completed' ? 'border-green-500 text-green-600' : 'border-amber-500 text-amber-600')}>
                                  {p.installation_status === 'completed' ? '✓ Installed' : '🔧 Service'}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <CustomerForm onSubmit={handleCreateCustomer} submitLabel="Create Customer" />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <CustomerForm onSubmit={handleUpdateCustomer} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortfolio;
