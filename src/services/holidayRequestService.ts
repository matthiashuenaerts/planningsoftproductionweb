
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
    console.log('Creating holiday request:', request);
    
    // First check if the employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', request.user_id)
      .single();

    if (employeeError || !employee) {
      console.error('Employee not found:', employeeError);
      throw new Error('Employee not found');
    }

    const { data, error } = await supabase
      .from('holiday_requests')
      .insert([request])
      .select()
      .single();

    if (error) {
      console.error('Error creating holiday request:', error);
      throw error;
    }
    console.log('Holiday request created successfully:', data);
    return data;
  },

  async getUserRequests(userId: string) {
    console.log('Fetching requests for user:', userId);
    
    if (!userId) {
      console.error('No user ID provided');
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user requests:', error);
      throw error;
    }
    
    console.log('User requests fetched successfully:', data?.length || 0, 'requests');
    return data || [];
  },

  async getAllRequests() {
    console.log('Fetching all holiday requests');
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all requests:', error);
      throw error;
    }
    console.log('All requests fetched successfully:', data?.length || 0, 'requests');
    return data || [];
  },

  async updateRequestStatus(id: string, status: 'approved' | 'rejected', adminNotes?: string, approvedBy?: string) {
    console.log('Updating request status:', { id, status, adminNotes, approvedBy });
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

    if (error) {
      console.error('Error updating request status:', error);
      throw error;
    }
    console.log('Request status updated successfully:', data);
    return data;
  }
};
