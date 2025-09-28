import { supabase } from '@/integrations/supabase/client';

export interface ProjectMessage {
  id: string;
  project_id: string;
  employee_id: string;
  employee_name?: string;
  message: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  is_image?: boolean;
  target_user_ids?: string[] | null;
  reply_to_message_id?: string | null;
  reply_to_message?: ProjectMessage | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMessageRead {
  id: string;
  project_id: string;
  employee_id: string;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export const projectChatService = {
  // Get messages for a project (all users can see all messages)
  async getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from('project_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at');

      if (error) throw error;

      if (!messages || messages.length === 0) {
        return [];
      }

      // Show ALL messages - everyone can see everything
      const visibleMessages = messages;

      // Get employee names separately
      const employeeIds = [...new Set(visibleMessages.map(msg => msg.employee_id))];
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id, name')
        .in('id', employeeIds);

      if (employeeError) {
        console.error('Error fetching employee names:', employeeError);
        return visibleMessages.map(msg => ({ ...msg, employee_name: 'Unknown' }));
      }

      const employeeMap = new Map(employees?.map(emp => [emp.id, emp.name]) || []);

      // Build message map for replies
      const messageMap = new Map(visibleMessages.map(msg => [msg.id, msg]));

      return visibleMessages.map(msg => ({
        ...msg,
        employee_name: employeeMap.get(msg.employee_id) || 'Unknown',
        reply_to_message: msg.reply_to_message_id ? messageMap.get(msg.reply_to_message_id) : null
      }));
    } catch (error) {
      console.error('Error fetching project messages:', error);
      throw error;
    }
  },

  // Send a message
  async sendMessage(
    projectId: string, 
    message: string, 
    file?: File,
    targetUserIds?: string[],
    replyToMessageId?: string
  ): Promise<ProjectMessage> {
    try {
      // Get current user from localStorage (custom auth system)
      const storedSession = localStorage.getItem('employeeSession');
      if (!storedSession) throw new Error('User not authenticated');
      
      const employee = JSON.parse(storedSession);
      if (!employee?.id) throw new Error('User not authenticated');

      let file_url: string | null = null;
      let file_name: string | null = null;
      let file_type: string | null = null;
      let is_image = false;

      // Handle file upload if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `project-chat/${projectId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project_files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project_files')
          .getPublicUrl(filePath);

        file_url = publicUrl;
        file_name = file.name;
        file_type = file.type;
        is_image = file.type.startsWith('image/');
      }

      const { data, error } = await supabase
        .from('project_messages')
        .insert({
          project_id: projectId,
          employee_id: employee.id,
          message,
          file_url,
          file_name,
          file_type,
          is_image,
          target_user_ids: targetUserIds || null,
          reply_to_message_id: replyToMessageId || null
        })
        .select('*')
        .single();

      if (error) throw error;

      // Send notifications only to targeted users if specified
      // If no target users specified, don't send any notifications (broadcast message)
      if (targetUserIds && targetUserIds.length > 0) {
        await this.sendTargetedNotifications(projectId, targetUserIds, message, employee.name);
      }

      return {
        ...data,
        employee_name: employee.name || 'Unknown'
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Send notifications to specific users
  async sendTargetedNotifications(projectId: string, targetUserIds: string[], message: string, senderName: string): Promise<void> {
    try {
      const notifications = targetUserIds.map(userId => ({
        user_id: userId,
        message: `New message from ${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        link: `/projects/${projectId}`
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    } catch (error) {
      console.error('Error sending targeted notifications:', error);
    }
  },

  // Get project team members for user selection
  async getProjectTeamMembers(projectId: string): Promise<{id: string, name: string}[]> {
    try {
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name')
        .neq('role', 'workstation') // Exclude workstation users
        .order('name');

      if (error) throw error;
      return employees || [];
    } catch (error) {
      console.error('Error fetching team members:', error);
      return [];
    }
  },

  // Get unread message count for a project
  async getUnreadMessageCount(projectId: string): Promise<number> {
    try {
      // Get current user from localStorage (custom auth system)
      const storedSession = localStorage.getItem('employeeSession');
      if (!storedSession) return 0;
      
      const employee = JSON.parse(storedSession);
      if (!employee?.id) return 0;

      // Get last read timestamp for this user and project
      const { data: readData } = await supabase
        .from('project_message_reads')
        .select('last_read_at')
        .eq('project_id', projectId)
        .eq('employee_id', employee.id)
        .single();

      const lastRead = readData?.last_read_at;

      // Count messages newer than last read time
      let query = supabase
        .from('project_messages')
        .select('id', { count: 'exact' })
        .eq('project_id', projectId);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  },

  // Mark messages as read for current user
  async markMessagesAsRead(projectId: string): Promise<void> {
    try {
      // Get current user from localStorage (custom auth system)
      const storedSession = localStorage.getItem('employeeSession');
      if (!storedSession) return;
      
      const employee = JSON.parse(storedSession);
      if (!employee?.id) return;

      const { error } = await supabase
        .from('project_message_reads')
        .upsert({
          project_id: projectId,
          employee_id: employee.id,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: 'project_id,employee_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Subscribe to real-time updates
  subscribeToMessages(projectId: string, callback: (message: ProjectMessage) => void) {
    return supabase
      .channel(`project-messages-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_messages',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          // Fetch the complete message with employee info
          const { data: message } = await supabase
            .from('project_messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (message) {
            // Get employee name
            const { data: employee } = await supabase
              .from('employees')
              .select('name')
              .eq('id', message.employee_id)
              .single();

            callback({
              ...message,
              employee_name: employee?.name || 'Unknown'
            });
          }
        }
      )
      .subscribe();
  }
};