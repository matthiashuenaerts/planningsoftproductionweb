import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { customerService, Customer } from '@/services/customerService';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { User, Search, Plus } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  className?: string;
  placeholder?: string;
}

const CustomerSelector: React.FC<Props> = ({ value, onChange, onSelectCustomer, className, placeholder }) => {
  const { tenant } = useTenant();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '', email: '', phone: '', company_name: '',
    address_street: '', address_number: '', address_postal_code: '',
    address_city: '', address_country: '', vat_number: '',
  });
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    customerService.getAll(tenant?.id).then(setCustomers).catch(() => {});
  }, [tenant?.id]);

  useEffect(() => {
    if (value.trim().length > 0) {
      const q = value.toLowerCase();
      setFiltered(customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q)
      ).slice(0, 10));
    } else {
      setFiltered(customers.slice(0, 10));
    }
  }, [value, customers]);

  const handleSelect = useCallback((customer: Customer) => {
    onChange(customer.name);
    onSelectCustomer?.(customer);
    setShowDropdown(false);
  }, [onChange, onSelectCustomer]);

  const hasExactMatch = customers.some(c => c.name.toLowerCase() === value.trim().toLowerCase());

  const openCreateDialog = () => {
    setNewCustomer({
      name: value.trim(), email: '', phone: '', company_name: '',
      address_street: '', address_number: '', address_postal_code: '',
      address_city: '', address_country: '', vat_number: '',
    });
    setShowDropdown(false);
    setShowCreateDialog(true);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim() || !tenant?.id) return;
    setCreating(true);
    try {
      const created = await customerService.create({ ...newCustomer, tenant_id: tenant.id });
      setCustomers(prev => [...prev, created]);
      onChange(created.name);
      onSelectCustomer?.(created);
      setShowCreateDialog(false);
    } catch (err: any) {
      console.error('Create customer error:', err);
    } finally {
      setCreating(false);
    }
  };

  const updateField = (field: string, val: string) => {
    setNewCustomer(prev => ({ ...prev, [field]: val }));
  };

  return (
    <>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={e => { onChange(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder={placeholder || (t('cs_search_or_type') || 'Search or type client name...')}
            className={cn("pl-8", className)}
          />
        </div>
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
            <ScrollArea className="max-h-[200px]">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.company_name && <p className="text-xs text-muted-foreground truncate">{c.company_name}</p>}
                  </div>
                </button>
              ))}
              {/* Show "Add new customer" option when no exact match */}
              {value.trim().length > 0 && !hasExactMatch && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm border-t text-primary font-medium"
                  onMouseDown={(e) => { e.preventDefault(); openCreateDialog(); }}
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{t('cs_add_new_customer') || 'Nieuwe klant toevoegen'}: "{value.trim()}"</span>
                </button>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cs_new_customer') || 'Nieuwe klant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('cs_name') || 'Naam'} *</Label>
                <Input value={newCustomer.name} onChange={e => updateField('name', e.target.value)} />
              </div>
              <div>
                <Label>{t('cs_company') || 'Bedrijf'}</Label>
                <Input value={newCustomer.company_name} onChange={e => updateField('company_name', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('cs_email') || 'E-mail'}</Label>
                <Input type="email" value={newCustomer.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div>
                <Label>{t('cs_phone') || 'Telefoon'}</Label>
                <Input value={newCustomer.phone} onChange={e => updateField('phone', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('cs_street') || 'Straat'}</Label>
                <Input value={newCustomer.address_street} onChange={e => updateField('address_street', e.target.value)} />
              </div>
              <div>
                <Label>{t('cs_number') || 'Nummer'}</Label>
                <Input value={newCustomer.address_number} onChange={e => updateField('address_number', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t('cs_postal_code') || 'Postcode'}</Label>
                <Input value={newCustomer.address_postal_code} onChange={e => updateField('address_postal_code', e.target.value)} />
              </div>
              <div>
                <Label>{t('cs_city') || 'Stad'}</Label>
                <Input value={newCustomer.address_city} onChange={e => updateField('address_city', e.target.value)} />
              </div>
              <div>
                <Label>{t('cs_country') || 'Land'}</Label>
                <Input value={newCustomer.address_country} onChange={e => updateField('address_country', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t('cs_vat_number') || 'BTW-nummer'}</Label>
              <Input value={newCustomer.vat_number} onChange={e => updateField('vat_number', e.target.value)} />
            </div>
            <Button onClick={handleCreateCustomer} disabled={!newCustomer.name.trim() || creating} className="w-full">
              {creating ? '...' : (t('cs_create_customer') || 'Klant aanmaken')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomerSelector;
