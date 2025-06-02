
import { supabase } from '@/integrations/supabase/client';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_room_id: string;
  employee_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  employee_name?: string;
}

export const chatService = {
  async getChatRooms(userRole: string): Promise<ChatRoom[]> {
    try {
      let query = supabase
        .from('chat_rooms')
        .select('*')
        .order('name');

      if (userRole !== 'admin') {
        query = query.or(`role.eq.${userRole},role.eq.all`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching chat rooms:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getChatRooms:', error);
      throw error;
    }
  },

  async getChatMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          employees!inner(name)
        `)
        .eq('chat_room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
      }

      return (data || []).map(msg => ({
        ...msg,
        employee_name: msg.employees?.name || 'Unknown User'
      }));
    } catch (error) {
      console.error('Error in getChatMessages:', error);
      throw error;
    }
  },

  async sendMessage(roomId: string, employeeId: string, message: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_room_id: roomId,
          employee_id: employeeId,
          message: message.trim()
        });

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return false;
    }
  }
};
