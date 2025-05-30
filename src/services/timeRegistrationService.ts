
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
    
    // Check if the task is currently not being worked on by anyone
    const { data: currentlyActive, error: activeError } = await supabase
      .from('time_registrations')
      .select('id')
      .eq('task_id', taskId)
      .eq('is_active', true);
    
    if (activeError) throw activeError;
    
    // If no one is currently working on the task, update task status to IN_PROGRESS
    if (!currentlyActive || currentlyActive.length === 0) {
      await supabase
        .from('tasks')
        .update({ 
          status: 'IN_PROGRESS',
          status_changed_at: new Date().toISOString(),
          assignee_id: employeeId
        })
        .eq('id', taskId);
    }
    
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
    
    // Get the registration to calculate duration and task info
    const { data: registration, error: fetchError } = await supabase
      .from('time_registrations')
      .select('start_time, task_id')
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
    
    // Check if anyone else is still working on this task
    const { data: stillActive, error: stillActiveError } = await supabase
      .from('time_registrations')
      .select('id')
      .eq('task_id', registration.task_id)
      .eq('is_active', true);
    
    if (stillActiveError) throw stillActiveError;
    
    // If no one else is working on the task, change status back to TODO
    if (!stillActive || stillActive.length === 0) {
      // Get total time spent on task so far
      const { data: totalTime, error: timeError } = await supabase
        .from('time_registrations')
        .select('duration_minutes')
        .eq('task_id', registration.task_id)
        .not('duration_minutes', 'is', null);
      
      if (timeError) throw timeError;
      
      const totalMinutes = totalTime?.reduce((sum, reg) => sum + (reg.duration_minutes || 0), 0) || 0;
      
      await supabase
        .from('tasks')
        .update({ 
          status: 'TODO',
          assignee_id: null,
          // Store remaining time if task has a duration
          // You might want to add a field for tracking remaining time
        })
        .eq('id', registration.task_id);
    }
    
    return data as TimeRegistration;
  },

  async stopActiveRegistrations(employeeId: string): Promise<void> {
    const { data: activeRegistrations, error: fetchError } = await supabase
      .from('time_registrations')
      .select('id, start_time, task_id')
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    
    if (fetchError) throw fetchError;
    
    if (activeRegistrations && activeRegistrations.length > 0) {
      const endTime = new Date();
      
      for (const registration of activeRegistrations) {
        const startTime = new Date(registration.start_time);
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        // Stop the registration
        await supabase
          .from('time_registrations')
          .update({
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            is_active: false
          })
          .eq('id', registration.id);
        
        // Check if anyone else is still working on this task
        const { data: stillActive, error: stillActiveError } = await supabase
          .from('time_registrations')
          .select('id')
          .eq('task_id', registration.task_id)
          .eq('is_active', true);
        
        if (stillActiveError) continue;
        
        // If no one else is working on the task, change status back to TODO
        if (!stillActive || stillActive.length === 0) {
          await supabase
            .from('tasks')
            .update({ 
              status: 'TODO',
              assignee_id: null
            })
            .eq('id', registration.task_id);
        }
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
