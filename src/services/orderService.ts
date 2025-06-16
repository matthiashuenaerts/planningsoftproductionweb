
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderItem, OrderAttachment, OrderStep } from "@/types/order";

export const orderService = {
  async getProjectOrders(projectId: string): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items_count:order_items(count)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data?.map(order => ({
        ...order,
        order_items_count: order.order_items_count?.[0]?.count || 0
      })) || [];
    } catch (error: any) {
      console.error('Error fetching project orders:', error);
      throw error;
    }
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching order:', error);
      throw error;
    }
  },

  async createOrder(order: Partial<Order>): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating order:', error);
      throw error;
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting order:', error);
      throw error;
    }
  },

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching order items:', error);
      throw error;
    }
  },

  async createOrderItem(orderItem: Partial<OrderItem>): Promise<OrderItem> {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .insert(orderItem)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating order item:', error);
      throw error;
    }
  },

  async updateOrderItem(itemId: string, updates: Partial<OrderItem>): Promise<OrderItem> {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating order item:', error);
      throw error;
    }
  },

  async deleteOrderItem(itemId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting order item:', error);
      throw error;
    }
  },

  // Order Attachments
  async getOrderAttachments(orderId: string): Promise<OrderAttachment[]> {
    try {
      const { data, error } = await supabase
        .from('order_attachments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching order attachments:', error);
      throw error;
    }
  },

  async createOrderAttachment(attachment: Partial<OrderAttachment>): Promise<OrderAttachment> {
    try {
      const { data, error } = await supabase
        .from('order_attachments')
        .insert(attachment)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating order attachment:', error);
      throw error;
    }
  },

  async deleteOrderAttachment(attachmentId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting order attachment:', error);
      throw error;
    }
  },

  // Order Steps
  async getOrderSteps(orderId: string): Promise<OrderStep[]> {
    try {
      const { data, error } = await supabase
        .from('order_steps')
        .select('*')
        .eq('order_id', orderId)
        .order('step_number', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching order steps:', error);
      throw error;
    }
  },

  async createOrderStep(step: Partial<OrderStep>): Promise<OrderStep> {
    try {
      const { data, error } = await supabase
        .from('order_steps')
        .insert(step)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating order step:', error);
      throw error;
    }
  },

  async updateOrderStep(stepId: string, updates: Partial<OrderStep>): Promise<OrderStep> {
    try {
      const { data, error } = await supabase
        .from('order_steps')
        .update(updates)
        .eq('id', stepId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating order step:', error);
      throw error;
    }
  },

  async deleteOrderStep(stepId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting order step:', error);
      throw error;
    }
  },

  // Logistics Out
  async getLogisticsOutOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .order('expected_delivery', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching logistics out orders:', error);
      throw error;
    }
  },

  // Semi-finished orders
  async getSemiFinishedOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_type', 'semi-finished')
        .order('expected_delivery', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching semi-finished orders:', error);
      throw error;
    }
  }
};
