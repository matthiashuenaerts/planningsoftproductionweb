
import { supabase } from "@/integrations/supabase/client";

export interface ChatRoom {
  id: string;
  name: string;
  role: string;
  description?: string;
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
    let query = supabase
      .from('chat_rooms')
      .select('*')
      .order('name');

    // If user is admin, they can see all chat rooms
    if (userRole !== 'admin') {
      query = query.eq('role', userRole);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getChatMessages(chatRoomId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        employees (name)
      `)
      .eq('chat_room_id', chatRoomId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(msg => ({
      ...msg,
      employee_name: msg.employees?.name || 'Unknown User'
    }));
  },

  async sendMessage(chatRoomId: string, employeeId: string, message: string): Promise<boolean> {
    const { error } = await supabase
      .from('chat_messages')
      .insert([{
        chat_room_id: chatRoomId,
        employee_id: employeeId,
        message: message.trim()
      }]);

    if (error) throw error;
    return true;
  }
};
