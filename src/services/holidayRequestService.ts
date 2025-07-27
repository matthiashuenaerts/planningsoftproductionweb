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

const sendHolidayRequestEmail = async (request: {
  employeeName: string;
  startDate: string;
  endDate: string;
  reason?: string;
  requestId: string;
}) => {
  try {
    // Fetch email connections from settings
    const { data: emailConnections, error: emailError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('is_active', true);

    if (emailError) {
      console.error('Error fetching email connections:', emailError);
      return;
    }

    // Find sender (matthias) and recipient (ontvanger) emails
    const senderEmail = emailConnections?.find(conn => 
      conn.general_name.toLowerCase() === 'matthias'
    )?.email_address;
    
    const recipientEmail = emailConnections?.find(conn => 
      conn.general_name.toLowerCase() === 'ontvanger'
    )?.email_address;

    if (!senderEmail || !recipientEmail) {
      console.error('Sender or recipient email not found in settings');
      return;
    }

    // Use supabase.functions.invoke instead of fetch
    const { data, error } = await supabase.functions.invoke('send-holiday-request-email', {
      body: {
        employeeName: request.employeeName,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        requestId: request.requestId,
        senderEmail: senderEmail,
        recipientEmail: recipientEmail,
      }
    });

    if (error) {
      console.error('Error sending email:', error);
      return;
    }

    console.log('Holiday request email sent successfully:', data);
  } catch (error) {
    console.error('Error sending holiday request email:', error);
    // Don't throw error here to prevent blocking the request creation
  }
};

export const holidayRequestService = {
  async createRequest(request: {
    user_id: string;
    employee_name: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) {
    console.log('Creating holiday request:', request);
    
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

    // Send email notification
    await sendHolidayRequestEmail({
      employeeName: request.employee_name,
      startDate: request.start_date,
      endDate: request.end_date,
      reason: request.reason,
      requestId: data.id,
    });

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

  async updateRequestStatus(id: string, status: 'approved' | 'rejected', adminNotes?: string) {
    console.log('Updating request status:', { id, status, adminNotes });
    const { data, error } = await supabase
      .from('holiday_requests')
      .update({ 
        status, 
        admin_notes: adminNotes,
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
  },

  async cleanupOldRequests() {
    console.log('Cleaning up old holiday requests...');
    
    // Calculate the cutoff date (30 days before today)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('holiday_requests')
      .delete()
      .lt('end_date', cutoffDate)
      .select();

    if (error) {
      console.error('Error cleaning up old requests:', error);
      throw error;
    }
    
    console.log(`Cleaned up ${data?.length || 0} old holiday requests`);
    return data?.length || 0;
  }
};
