
import { supabase } from "@/integrations/supabase/client";

export interface TimeRegistration {
  id: string;
  employee_id: string;
  task_id: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const timeRegistrationService = {
  async startTask(employeeId: string, taskId: string): Promise<TimeRegistration> {
    // First, stop any active registrations for this employee
    await this.stopActiveRegistrations(employeeId);
    
    const { data, error } = await supabase
      .from('time_registrations')
      .insert([{
        employee_id: employeeId,
        task_id: taskId,
        start_time: new Date().toISOString(),
        is_active: true
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data as TimeRegistration;
  },

  async stopTask(registrationId: string): Promise<TimeRegistration> {
    const endTime = new Date();
    
    // Get the registration to calculate duration
    const { data: registration, error: fetchError } = await supabase
      .from('time_registrations')
      .select('start_time')
      .eq('id', registrationId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const startTime = new Date(registration.start_time);
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    const { data, error } = await supabase
      .from('time_registrations')
      .update({
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
        is_active: false
      })
      .eq('id', registrationId)
      .select()
      .single();
    
    if (error) throw error;
    return data as TimeRegistration;
  },

  async stopActiveRegistrations(employeeId: string): Promise<void> {
    const { data: activeRegistrations, error: fetchError } = await supabase
      .from('time_registrations')
      .select('id, start_time')
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    
    if (fetchError) throw fetchError;
    
    if (activeRegistrations && activeRegistrations.length > 0) {
      const endTime = new Date();
      
      for (const registration of activeRegistrations) {
        const startTime = new Date(registration.start_time);
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        await supabase
          .from('time_registrations')
          .update({
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            is_active: false
          })
          .eq('id', registration.id);
      }
    }
  },

  async getActiveRegistration(employeeId: string): Promise<TimeRegistration | null> {
    const { data, error } = await supabase
      .from('time_registrations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) throw error;
    return data as TimeRegistration | null;
  },

  async getAllRegistrations(): Promise<any[]> {
    const { data, error } = await supabase
      .from('time_registrations')
      .select(`
        *,
        employees (name),
        tasks (title, phases (name, projects (name)))
      `)
      .order('start_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getRegistrationsByEmployee(employeeId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('time_registrations')
      .select(`
        *,
        tasks (title, phases (name, projects (name)))
      `)
      .eq('employee_id', employeeId)
      .order('start_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};
