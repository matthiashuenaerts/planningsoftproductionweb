
import { supabase } from "@/integrations/supabase/client";
import { RushOrder, RushOrderFormData, EditRushOrderPayload, RushOrderMessage } from "@/types/rushOrder";

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

  async getRushOrdersForWorkstation(workstationId: string): Promise<RushOrder[]> {
    try {
      // Get tasks linked to this workstation that are part of rush orders
      const { data: taskLinks, error: taskLinksError } = await supabase
        .from('task_workstation_links')
        .select(`
          task_id,
          tasks!inner(
            id,
            rush_order_task_links!inner(
              rush_order_id
            )
          )
        `)
        .eq('workstation_id', workstationId);

      if (taskLinksError) throw taskLinksError;

      if (!taskLinks || taskLinks.length === 0) {
        return [];
      }

      // Extract unique rush order IDs
      const rushOrderIds = Array.from(new Set(
        taskLinks
          .filter(link => link.tasks?.rush_order_task_links && link.tasks.rush_order_task_links.length > 0)
          .map(link => link.tasks!.rush_order_task_links[0].rush_order_id)
      ));

      if (rushOrderIds.length === 0) {
        return [];
      }

      // Get the rush orders
      const { data: rushOrders, error: rushOrdersError } = await supabase
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
        .in('id', rushOrderIds)
        .order('created_at', { ascending: false });

      if (rushOrdersError) throw rushOrdersError;

      return rushOrders || [];
    } catch (error: any) {
      console.error('Error fetching rush orders for workstation:', error);
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
  },

  // Rush Order Messages
  async getRushOrderMessages(rushOrderId: string): Promise<RushOrderMessage[]> {
    try {
      const { data, error } = await supabase
        .from('rush_order_messages')
        .select(`
          *,
          employee_name:employees(name)
        `)
        .eq('rush_order_id', rushOrderId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        ...msg,
        employee_name: msg.employee_name?.name || 'Unknown'
      }));
    } catch (error: any) {
      console.error('Error fetching rush order messages:', error);
      throw error;
    }
  },

  async sendRushOrderMessage(rushOrderId: string, employeeId: string, message: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('rush_order_messages')
        .insert({
          rush_order_id: rushOrderId,
          employee_id: employeeId,
          message: message
        });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error sending rush order message:', error);
      throw error;
    }
  },

  async markMessagesAsRead(rushOrderId: string): Promise<boolean> {
    try {
      // This is a placeholder - you might want to implement a read status for messages
      return true;
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  async notifyAssignedUsersOfNewMessage(rushOrderId: string, senderId: string, senderName: string): Promise<void> {
    try {
      // Get assigned users for this rush order
      const { data: assignments, error: assignmentsError } = await supabase
        .from('rush_order_assignments')
        .select('employee_id')
        .eq('rush_order_id', rushOrderId)
        .neq('employee_id', senderId); // Don't notify the sender

      if (assignmentsError) throw assignmentsError;

      if (assignments && assignments.length > 0) {
        const notifications = assignments.map(assignment => ({
          user_id: assignment.employee_id,
          message: `New message from ${senderName} in rush order`,
          rush_order_id: rushOrderId,
          link: `/rush-orders/${rushOrderId}`
        }));

        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notificationError) throw notificationError;
      }
    } catch (error: any) {
      console.error('Error notifying assigned users:', error);
      // Don't throw here as it's not critical
    }
  }
};
