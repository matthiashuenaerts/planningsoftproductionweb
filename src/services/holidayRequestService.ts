
import { supabase } from '@/integrations/supabase/client';

export interface HolidayRequest {
  id: string;
  user_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export const holidayRequestService = {
  async createRequest(request: {
    user_id: string;
    employee_name: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) {
    const { data, error } = await supabase
      .from('holiday_requests')
      .insert([request])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getUserRequests(userId: string) {
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAllRequests() {
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateRequestStatus(id: string, status: 'approved' | 'rejected', adminNotes?: string, approvedBy?: string) {
    const { data, error } = await supabase
      .from('holiday_requests')
      .update({ 
        status, 
        admin_notes: adminNotes,
        approved_by: approvedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
