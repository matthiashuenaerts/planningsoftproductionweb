import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderAttachment, OrderStep } from '@/types/order';
import { applyTenantFilter } from '@/lib/tenantQuery';

export const orderService = {
  async getAll(tenantId?: string | null): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select('*, order_items(count)');
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;

    if (error) throw error;
    
    return (data || []).map((order: any) => {
      const { order_items, ...rest } = order;
      const orderItemsCount = (Array.isArray(order_items) && order_items.length > 0) ? order_items[0].count : 0;

      return {
        ...rest,
        status: order.status as Order['status'],
        order_type: order.order_type as Order['order_type'],
        order_items_count: orderItemsCount,
      };
    });
  },

  async getAllOrders(tenantId?: string | null): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items!inner(
          id,
          description,
          quantity,
          article_code,
          ean,
          delivered_quantity,
          stock_location,
          notes
        )
      `);
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;

    if (error) throw error;
    
    return (data || []).map((order: any) => ({
      ...order,
      status: order.status as Order['status'],
      order_type: order.order_type as Order['order_type'],
      order_items_count: order.order_items?.length || 0,
    }));
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
      status: data.status as Order['status'],
      order_type: data.order_type as Order['order_type']
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
      status: order.status as Order['status'],
      order_type: order.order_type as Order['order_type']
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
      status: data.status as Order['status'],
      order_type: data.order_type as Order['order_type']
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
      status: data.status as Order['status'],
      order_type: data.order_type as Order['order_type']
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

  async confirmDelivery(orderId: string, deliveryData?: { itemDeliveries: Array<{itemId: string, deliveredQuantity: number, stockLocation?: string}> }): Promise<void> {
    if (deliveryData?.itemDeliveries) {
      // Update delivered quantities for each item
      for (const delivery of deliveryData.itemDeliveries) {
        await supabase
          .from('order_items')
          .update({ 
            delivered_quantity: delivery.deliveredQuantity,
            stock_location: delivery.stockLocation 
          })
          .eq('id', delivery.itemId);
      }

      // Check if all items are fully delivered
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, delivered_quantity')
        .eq('order_id', orderId);

      const allItemsDelivered = orderItems?.every(item => item.delivered_quantity >= item.quantity);
      const someItemsDelivered = orderItems?.some(item => item.delivered_quantity > 0);

      if (allItemsDelivered) {
        await this.updateLinkedAccessoriesStatus(orderId, 'delivered');
        await this.updateOrderStatus(orderId, 'delivered');
        
        // Check if order is from external database and send confirmation
        await this.sendExternalDeliveryConfirmation(orderId);
      } else if (someItemsDelivered) {
        await this.updateOrderStatus(orderId, 'partially_delivered');
        
        // Send confirmation for partially delivered items
        await this.sendExternalDeliveryConfirmation(orderId);
      }
    } else {
      // Legacy behavior - mark everything as delivered
      await this.updateLinkedAccessoriesStatus(orderId, 'delivered');
      await this.updateOrderStatus(orderId, 'delivered');
      
      // Check if order is from external database and send confirmation
      await this.sendExternalDeliveryConfirmation(orderId);
    }
  },

  async sendExternalDeliveryConfirmation(orderId: string): Promise<void> {
    try {
      // Get order to check if it's from external database
      const { data: order } = await supabase
        .from('orders')
        .select('source, external_order_number')
        .eq('id', orderId)
        .single();

      if (order?.source === 'external database' && order.external_order_number) {
        console.log(`Sending external delivery confirmation for order ${orderId}`);
        
        // Call the external delivery confirmation edge function
        const { data, error } = await supabase.functions.invoke('external-delivery-confirmation', {
          body: { orderId }
        });

        if (error) {
          console.error('Failed to send external delivery confirmation:', error);
        } else {
          console.log('External delivery confirmation sent successfully:', data);
        }
      }
    } catch (error) {
      console.error('Error sending external delivery confirmation:', error);
      // Don't throw error to avoid disrupting the main delivery confirmation flow
    }
  },

  async getLogisticsOutOrders(tenantId?: string | null): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select('*, order_items(count)')
      .eq('order_type', 'semi-finished');
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;

    if (error) throw error;

    return (data || [])
      .map((order: any) => {
        const { order_items, ...rest } = order;
        const orderItemsCount = (Array.isArray(order_items) && order_items.length > 0) ? order_items[0].count : 0;

        return {
          ...rest,
          status: order.status as Order['status'],
          order_type: order.order_type as Order['order_type'],
          order_items_count: orderItemsCount,
        };
      });
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

  // Order Steps
  async getOrderSteps(orderId: string): Promise<OrderStep[]> {
    const { data, error } = await supabase
      .from('order_steps')
      .select('*')
      .eq('order_id', orderId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return (data || []).map(step => ({
        ...step,
        status: step.status as OrderStep['status']
    }));
  },

  async createOrderStep(step: Omit<OrderStep, 'id' | 'created_at' | 'updated_at'>): Promise<OrderStep> {
    const { data, error } = await supabase
      .from('order_steps')
      .insert(step)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      status: data.status as OrderStep['status']
    };
  },

  async updateOrderStep(id: string, updates: Partial<OrderStep>): Promise<OrderStep> {
    const { data, error } = await supabase
      .from('order_steps')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      status: data.status as OrderStep['status']
    };
  },

  async deleteOrderStep(id: string): Promise<void> {
    const { error } = await supabase
      .from('order_steps')
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
