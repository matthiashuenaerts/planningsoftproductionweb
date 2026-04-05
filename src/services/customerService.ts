import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address_street: string | null;
  address_number: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  vat_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const customerService = {
  async getAll(tenantId?: string): Promise<Customer[]> {
    let query = supabase.from('customers' as any).select('*').order('name');
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Customer[];
  },

  async getById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase.from('customers' as any).select('*').eq('id', id).single();
    if (error) { if (error.code === 'PGRST116') return null; throw error; }
    return data as unknown as Customer;
  },

  async create(customer: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase.from('customers' as any).insert(customer).select().single();
    if (error) throw error;
    return data as unknown as Customer;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase.from('customers' as any).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as unknown as Customer;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('customers' as any).delete().eq('id', id);
    if (error) throw error;
  },

  async search(query: string, tenantId?: string): Promise<Customer[]> {
    let q = supabase.from('customers' as any).select('*').or(`name.ilike.%${query}%,company_name.ilike.%${query}%,email.ilike.%${query}%`).order('name').limit(20);
    q = applyTenantFilter(q, tenantId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Customer[];
  },
};
