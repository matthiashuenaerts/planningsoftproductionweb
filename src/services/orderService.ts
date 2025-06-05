
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderItem, OrderAttachment } from "@/types/order";

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('expected_delivery', { ascending: false });
    
    if (error) throw error;
    return data as Order[] || [];
  },

  async getByProject(projectId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', projectId)
      .order('order_date', { ascending: false });
    
    if (error) throw error;
    return data as Order[] || [];
  },
  
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    
    if (error) throw error;
    return data as OrderItem[] || [];
  },
  
  async getOrderAttachments(orderId: string): Promise<OrderAttachment[]> {
    const { data, error } = await supabase
      .from('order_attachments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // If the table doesn't exist yet, just return an empty array
      if (error.code === '42P01') {
        return [];
      }
      throw error;
    }
    return data as OrderAttachment[] || [];
  },
  
  async createOrder(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },
  
  async createOrderItems(items: Omit<OrderItem, 'id' | 'created_at' | 'updated_at'>[]): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .insert(items)
      .select();
    
    if (error) throw error;
    return data as OrderItem[] || [];
  },
  
  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Order;
  },

  async uploadOrderAttachment(orderId: string, file: File): Promise<OrderAttachment> {
    try {
      // First, upload the file to Supabase Storage
      const filePath = `${orderId}/${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }
      
      // Get public URL for the file
      const { data: publicUrlData } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(filePath);
      
      const publicUrl = publicUrlData.publicUrl;
      
      // Create an entry in the order_attachments table
      const attachmentData = {
        order_id: orderId,
        file_name: file.name,
        file_path: publicUrl,
        file_type: file.type,
        file_size: file.size
      };
      
      const { data: attachmentRecord, error: attachmentError } = await supabase
        .from('order_attachments')
        .insert([attachmentData])
        .select()
        .single();
      
      if (attachmentError) {
        console.error("Database attachment error:", attachmentError);
        // If table doesn't exist yet
        if (attachmentError.code === '42P01') {
          console.error("Table 'order_attachments' doesn't exist yet. Make sure you run the required SQL migrations.");
          // Return a mocked attachment object for now to avoid breaking the UI
          return {
            id: 'temp-' + Date.now(),
            order_id: orderId,
            file_name: file.name,
            file_path: publicUrl,
            file_type: file.type,
            file_size: file.size,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        throw attachmentError;
      }
      
      return attachmentRecord as OrderAttachment;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  async deleteOrderAttachment(attachmentId: string): Promise<void> {
    try {
      // First, get the attachment record
      const { data: attachment, error: fetchError } = await supabase
        .from('order_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Extract the file path from the URL
      const filePath = `${attachment.order_id}/${attachment.file_name}`;
      
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('order-attachments')
        .remove([filePath]);
      
      if (storageError) {
        console.error("Error removing file from storage:", storageError);
        // Continue anyway to delete the database record
      }
      
      // Delete the database record
      const { error: deleteError } = await supabase
        .from('order_attachments')
        .delete()
        .eq('id', attachmentId);
      
      if (deleteError) throw deleteError;
    } catch (error) {
      console.error("Error deleting attachment:", error);
      throw error;
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    try {
      // First delete all order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      
      // Get all attachments
      const attachments = await this.getOrderAttachments(orderId);
      
      // Delete each attachment (this will handle both DB record and storage)
      for (const attachment of attachments) {
        await this.deleteOrderAttachment(attachment.id);
      }
      
      // Finally delete the order itself
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (orderError) throw orderError;
    } catch (error) {
      console.error("Error deleting order:", error);
      throw error;
    }
  }
};
