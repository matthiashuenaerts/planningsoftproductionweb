import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { customerService, Customer } from '@/services/customerService';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { User, Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  className?: string;
  placeholder?: string;
}

const CustomerSelector: React.FC<Props> = ({ value, onChange, onSelectCustomer, className, placeholder = 'Search or type client name...' }) => {
  const { tenant } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const handleSelect = (customer: Customer) => {
    onChange(customer.name);
    onSelectCustomer?.(customer);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={e => { onChange(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={placeholder}
          className={cn("pl-8", className)}
        />
      </div>
      {showDropdown && filtered.length > 0 && (
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
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;
