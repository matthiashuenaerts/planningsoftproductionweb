
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderItem } from "@/types/order";

export const orderService = {
  async getByProjectId(projectId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', projectId)
      .order('order_date', { ascending: false });
    
    if (error) throw error;
    return data as Order[] || [];
  },

  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false });
    
    if (error) throw error;
    return data as Order[] || [];
  },

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data as OrderItem[] || [];
  },

  async getOrderAttachments(orderId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('order_attachments')
      .select('*')
      .eq('order_id', orderId);
    
    if (error) throw error;
    return data || [];
  },

  async createOrder(orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  async createOrderItems(orderItems: Omit<OrderItem, 'id' | 'created_at' | 'updated_at'>[]): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();
    
    if (error) throw error;
    return data as OrderItem[] || [];
  },

  async updateStatus(orderId: string, status: Order['status']): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    return this.updateStatus(orderId, status);
  },

  async deleteOrder(orderId: string): Promise<void> {
    // First delete order items
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    
    // Then delete the order
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
    
    if (error) throw error;
  },

  async uploadOrderAttachment(formData: FormData): Promise<any> {
    // Mock implementation for now
    console.log('Upload order attachment:', formData);
    return Promise.resolve({ success: true });
  },

  async getDeliveriesToday(): Promise<(Order & { project_name: string })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        projects(name)
      `)
      .eq('expected_delivery', today)
      .neq('status', 'delivered')
      .neq('status', 'canceled');
    
    if (error) throw error;
    
    return (data || []).map(order => ({
      ...order,
      project_name: (order.projects as any)?.name || 'Unknown Project',
      status: order.status as Order['status']
    }));
  },

  async getUpcomingDeliveries(): Promise<(Order & { project_name: string })[]> {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        projects(name)
      `)
      .gt('expected_delivery', today)
      .lte('expected_delivery', nextWeek)
      .neq('status', 'delivered')
      .neq('status', 'canceled')
      .order('expected_delivery', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(order => ({
      ...order,
      project_name: (order.projects as any)?.name || 'Unknown Project',
      status: order.status as Order['status']
    }));
  },

  async getBackorderDeliveries(): Promise<(Order & { project_name: string })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        projects(name)
      `)
      .lt('expected_delivery', today)
      .neq('status', 'delivered')
      .neq('status', 'canceled')
      .order('expected_delivery', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(order => ({
      ...order,
      project_name: (order.projects as any)?.name || 'Unknown Project',
      status: order.status as Order['status']
    }));
  },

  async confirmDelivery(orderId: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'delivered',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    
    if (error) throw error;
  }
};
