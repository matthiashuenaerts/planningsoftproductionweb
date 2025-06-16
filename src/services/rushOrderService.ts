
import { supabase } from "@/integrations/supabase/client";
import { RushOrder, RushOrderFormData, EditRushOrderPayload } from "@/types/rushOrder";

export const rushOrderService = {
  async getAllRushOrders(): Promise<RushOrder[]> {
    try {
      const { data, error } = await supabase
        .from('rush_orders')
        .select(`
          *,
          tasks:rush_order_tasks(
            id,
            standard_task_id,
            created_at
          ),
          assignments:rush_order_assignments(
            id,
            employee_id,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching rush orders:', error);
      throw error;
    }
  },

  async getRushOrderById(id: string): Promise<RushOrder | null> {
    try {
      const { data, error } = await supabase
        .from('rush_orders')
        .select(`
          *,
          tasks:rush_order_tasks(
            id,
            standard_task_id,
            created_at
          ),
          assignments:rush_order_assignments(
            id,
            employee_id,
            created_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching rush order:', error);
      throw error;
    }
  },

  async createRushOrder(formData: RushOrderFormData, createdBy: string): Promise<string> {
    try {
      let imageUrl = null;

      // Upload image if provided
      if (formData.attachment) {
        const fileExt = formData.attachment.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('rush-orders')
          .upload(fileName, formData.attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('rush-orders')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      // Create rush order
      const { data: rushOrder, error: rushOrderError } = await supabase
        .from('rush_orders')
        .insert({
          title: formData.title,
          description: formData.description,
          deadline: formData.deadline.toISOString(),
          image_url: imageUrl,
          created_by: createdBy
        })
        .select()
        .single();

      if (rushOrderError) throw rushOrderError;

      // Add tasks
      if (formData.selectedTasks.length > 0) {
        const taskInserts = formData.selectedTasks.map(taskId => ({
          rush_order_id: rushOrder.id,
          standard_task_id: taskId
        }));

        const { error: tasksError } = await supabase
          .from('rush_order_tasks')
          .insert(taskInserts);

        if (tasksError) throw tasksError;
      }

      // Add assignments
      if (formData.assignedUsers.length > 0) {
        const assignmentInserts = formData.assignedUsers.map(userId => ({
          rush_order_id: rushOrder.id,
          employee_id: userId
        }));

        const { error: assignmentsError } = await supabase
          .from('rush_order_assignments')
          .insert(assignmentInserts);

        if (assignmentsError) throw assignmentsError;

        // Create notifications for assigned users
        const notificationInserts = formData.assignedUsers.map(userId => ({
          user_id: userId,
          message: `New rush order assigned: ${formData.title}`,
          rush_order_id: rushOrder.id,
          link: `/rush-orders/${rushOrder.id}`
        }));

        const { error: notificationsError } = await supabase
          .from('notifications')
          .insert(notificationInserts);

        if (notificationsError) throw notificationsError;
      }

      return rushOrder.id;
    } catch (error: any) {
      console.error('Error creating rush order:', error);
      throw error;
    }
  },

  async updateRushOrder(id: string, payload: EditRushOrderPayload): Promise<boolean> {
    try {
      let imageUrl = null;

      // Upload new image if provided
      if (payload.attachment) {
        const fileExt = payload.attachment.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('rush-orders')
          .upload(fileName, payload.attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('rush-orders')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const updateData: any = {
        title: payload.title,
        description: payload.description,
        deadline: payload.deadline.toISOString(),
      };

      if (imageUrl) {
        updateData.image_url = imageUrl;
      }

      const { error } = await supabase
        .from('rush_orders')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error updating rush order:', error);
      throw error;
    }
  },

  async updateRushOrderStatus(id: string, status: "pending" | "in_progress" | "completed"): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rush_orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error updating rush order status:', error);
      throw error;
    }
  },

  async deleteRushOrder(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rush_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting rush order:', error);
      throw error;
    }
  }
};
