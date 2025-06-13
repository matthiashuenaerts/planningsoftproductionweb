import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderAttachment } from '@/types/order';

export const orderService = {
  async getAll(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(order => ({
      ...order,
      status: order.status as Order['status']
    }));
  },

  async getAllOrders(): Promise<Order[]> {
    return this.getAll();
  },

  async getById(id: string): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return {
      ...data,
      status: data.status as Order['status']
    };
  },

  async getByProject(projectId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(order => ({
      ...order,
      status: order.status as Order['status']
    }));
  },

  async create(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      status: data.status as Order['status']
    };
  },

  async update(id: string, updates: Partial<Order>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If the order status is being changed to delivered, update linked accessories
    if (updates.status === 'delivered') {
      await this.updateLinkedAccessoriesStatus(id, 'delivered');
    }

    return {
      ...data,
      status: data.status as Order['status']
    };
  },

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    return this.update(id, { status });
  },

  async updateLinkedAccessoriesStatus(orderId: string, status: 'delivered'): Promise<void> {
    const { error } = await supabase
      .from('accessories')
      .update({ status })
      .eq('order_id', orderId);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async confirmDelivery(orderId: string): Promise<void> {
    // Update order status to delivered
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Update all accessories linked to this order to 'delivered' status
    const { error: accessoriesError } = await supabase
      .from('accessories')
      .update({ status: 'delivered' })
      .eq('order_id', orderId);

    if (accessoriesError) throw accessoriesError;
  },

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createOrderItem(item: Omit<OrderItem, 'id' | 'created_at' | 'updated_at'>): Promise<OrderItem> {
    const { data, error } = await supabase
      .from('order_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrderItem(id: string, updates: Partial<OrderItem>): Promise<OrderItem> {
    const { data, error } = await supabase
      .from('order_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOrderItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Order Attachments
  async getOrderAttachments(orderId: string): Promise<OrderAttachment[]> {
    const { data, error } = await supabase
      .from('order_attachments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createOrderAttachment(attachment: Omit<OrderAttachment, 'id' | 'created_at' | 'updated_at'>): Promise<OrderAttachment> {
    const { data, error } = await supabase
      .from('order_attachments')
      .insert(attachment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async uploadOrderAttachment(orderId: string, file: File): Promise<OrderAttachment> {
    // Upload file to Supabase storage
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('order-attachments')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('order-attachments')
      .getPublicUrl(fileName);

    // Create attachment record
    return this.createOrderAttachment({
      order_id: orderId,
      file_name: file.name,
      file_path: publicUrl,
      file_type: file.type,
      file_size: file.size
    });
  },

  async deleteOrderAttachment(id: string): Promise<void> {
    const { error } = await supabase
      .from('order_attachments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
