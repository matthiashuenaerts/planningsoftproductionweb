import { supabase } from '@/integrations/supabase/client';

export interface Accessory {
  id: string;
  project_id: string;
  article_name: string;
  article_description?: string;
  article_code?: string;
  quantity: number;
  stock_location?: string;
  status: 'to_check' | 'in_stock' | 'delivered' | 'to_order' | 'ordered';
  order_id?: string;
  supplier?: string;
  qr_code_text?: string | null;
  created_at: string;
  updated_at: string;
}

export const accessoriesService = {
  async getByProject(projectId: string): Promise<Accessory[]> {
    const { data, error } = await supabase
      .from('accessories')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(accessory => ({
      ...accessory,
      status: accessory.status as Accessory['status']
    }));
  },

  async create(accessory: Omit<Accessory, 'id' | 'created_at' | 'updated_at'>): Promise<Accessory> {
    const { data, error } = await supabase
      .from('accessories')
      .insert(accessory)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      status: data.status as Accessory['status']
    };
  },

  async createMany(accessories: Omit<Accessory, 'id' | 'created_at' | 'updated_at'>[]): Promise<Accessory[]> {
    const { data, error } = await supabase
      .from('accessories')
      .insert(accessories)
      .select();

    if (error) throw error;
    return (data || []).map(accessory => ({
      ...accessory,
      status: accessory.status as Accessory['status']
    }));
  },

  async update(id: string, updates: Partial<Accessory>): Promise<Accessory> {
    const { data, error } = await supabase
      .from('accessories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      status: data.status as Accessory['status']
    };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('accessories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async linkToOrder(accessoryIds: string[], orderId: string): Promise<void> {
    const { error } = await supabase
      .from('accessories')
      .update({ order_id: orderId, status: 'ordered' })
      .in('id', accessoryIds);

    if (error) throw error;
  }
};
