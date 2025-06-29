
import { supabase } from "@/integrations/supabase/client";

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
  // Create a new holiday request
  async createRequest(request: {
    employee_name: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }): Promise<HolidayRequest> {
    const { data, error } = await supabase
      .from('holiday_requests')
      .insert([{
        ...request,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data as HolidayRequest;
  },

  // Get user's own requests
  async getUserRequests(): Promise<HolidayRequest[]> {
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as HolidayRequest[] || [];
  },

  // Get all requests (admin only)
  async getAllRequests(): Promise<HolidayRequest[]> {
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as HolidayRequest[] || [];
  },

  // Update request status (admin only)
  async updateRequestStatus(
    requestId: string, 
    status: 'approved' | 'rejected', 
    adminNotes?: string
  ): Promise<HolidayRequest> {
    const { data, error } = await supabase
      .from('holiday_requests')
      .update({ 
        status, 
        admin_notes: adminNotes,
        approved_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data as HolidayRequest;
  }
};
