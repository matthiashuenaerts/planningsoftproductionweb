
import { supabase } from "@/integrations/supabase/client";

export interface TimeRegistration {
  id: string;
  employee_id: string;
  task_id?: string;
  workstation_task_id?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const timeRegistrationService = {
  async startTask(employeeId: string, taskId: string, remainingDurationMinutes?: number): Promise<TimeRegistration> {
    // First, stop any active registrations for this employee
    await this.stopActiveRegistrations(employeeId);
    
    // Check if this is a workstation task (if it doesn't exist in tasks table)
    const { data: regularTask, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .maybeSingle();
    
    let isWorkstationTask = false;
    if (!regularTask) {
      // Check if it's a workstation task
      const { data: workstationTask, error: workstationError } = await supabase
        .from('workstation_tasks')
        .select('id')
        .eq('id', taskId)
        .maybeSingle();
      
      if (workstationTask) {
        isWorkstationTask = true;
      } else {
        throw new Error('Task not found in either tasks or workstation_tasks table');
      }
    }
    
    if (!isWorkstationTask) {
      // For regular tasks, check if currently being worked on by anyone
      const { data: currentlyActive, error: activeError } = await supabase
        .from('time_registrations')
        .select('id')
        .eq('task_id', taskId)
        .eq('is_active', true);
      
      if (activeError) throw activeError;
      
      // If no one is currently working on the task, update task status to IN_PROGRESS
      if (!currentlyActive || currentlyActive.length === 0) {
        const updateData: any = { 
          status: 'IN_PROGRESS',
          status_changed_at: new Date().toISOString(),
          assignee_id: employeeId
        };
        
        // If we have remaining duration, update the task with it
        if (remainingDurationMinutes !== undefined) {
          updateData.duration = remainingDurationMinutes;
        }
        
        await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', taskId);
      }
    }
    
    // Create time registration
    const insertData: any = {
      employee_id: employeeId,
      start_time: new Date().toISOString(),
      is_active: true
    };
    
    if (isWorkstationTask) {
      insertData.workstation_task_id = taskId;
    } else {
      insertData.task_id = taskId;
    }
    
    const { data, error } = await supabase
      .from('time_registrations')
      .insert([insertData])
      .select()
      .single();
    
    if (error) throw error;
    return data as TimeRegistration;
  },

  async startWorkstationTask(employeeId: string, workstationTaskId: string): Promise<TimeRegistration> {
    // First, stop any active registrations for this employee
    await this.stopActiveRegistrations(employeeId);
    
    // Create time registration for workstation task using the new column
    const { data, error } = await supabase
      .from('time_registrations')
      .insert([{
        employee_id: employeeId,
        workstation_task_id: workstationTaskId,
        start_time: new Date().toISOString(),
        is_active: true
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating time registration for workstation task:', error);
      throw error;
    }
    
    return data as TimeRegistration;
  },

  async stopTask(registrationId: string): Promise<{ registration: TimeRegistration; remainingDuration?: number }> {
    const endTime = new Date();
    
    // Get the registration to calculate duration and task info
    const { data: registration, error: fetchError } = await supabase
      .from('time_registrations')
      .select('start_time, task_id, workstation_task_id')
      .eq('id', registrationId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const startTime = new Date(registration.start_time);
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    let remainingDuration: number | undefined;
    
    // Only handle task status updates for regular tasks (not workstation tasks)
    if (registration.task_id) {
      // Get current task info to calculate remaining duration
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('duration')
        .eq('id', registration.task_id)
        .maybeSingle();
      
      if (taskData && taskData.duration) {
        remainingDuration = Math.max(0, taskData.duration - durationMinutes);
      }
    }
    
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
    
    // Only update task status for regular tasks (not workstation tasks)
    if (registration.task_id) {
      // Check if anyone else is still working on this task
      const { data: stillActive, error: stillActiveError } = await supabase
        .from('time_registrations')
        .select('id')
        .eq('task_id', registration.task_id)
        .eq('is_active', true);
      
      if (stillActiveError) throw stillActiveError;
      
      // If no one else is working on the task, change status back to TODO and save remaining duration
      if (!stillActive || stillActive.length === 0) {
        const updateData: any = { 
          status: 'TODO',
          assignee_id: null
        };
        
        // Save remaining duration if available
        if (remainingDuration !== undefined) {
          updateData.duration = remainingDuration;
        }
        
        await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', registration.task_id);
      }
    }
    
    return { 
      registration: data as TimeRegistration, 
      remainingDuration 
    };
  },

  async completeTask(taskId: string): Promise<void> {
    // First, stop all active time registrations for this task (both regular and workstation tasks)
    const { data: activeRegistrations, error: fetchError } = await supabase
      .from('time_registrations')
      .select('id, start_time, task_id, workstation_task_id')
      .or(`task_id.eq.${taskId},workstation_task_id.eq.${taskId}`)
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
    
    // Now mark the task as completed (only for regular tasks, not workstation tasks)
    const { data: taskExists } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .maybeSingle();
    
    if (taskExists) {
      await supabase
        .from('tasks')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          assignee_id: null
        })
        .eq('id', taskId);
    }
  },

  async stopActiveRegistrations(employeeId: string): Promise<void> {
    const { data: activeRegistrations, error: fetchError } = await supabase
      .from('time_registrations')
      .select('id, start_time, task_id, workstation_task_id')
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    
    if (fetchError) throw fetchError;
    
    if (activeRegistrations && activeRegistrations.length > 0) {
      const endTime = new Date();
      
      for (const registration of activeRegistrations) {
        const startTime = new Date(registration.start_time);
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        let remainingDuration: number | undefined;
        
        // Only handle task status updates for regular tasks
        if (registration.task_id) {
          // Get task duration to calculate remaining time
          const { data: taskData } = await supabase
            .from('tasks')
            .select('duration')
            .eq('id', registration.task_id)
            .maybeSingle();
          
          if (taskData?.duration) {
            remainingDuration = Math.max(0, taskData.duration - durationMinutes);
          }
        }
        
        // Stop the registration
        await supabase
          .from('time_registrations')
          .update({
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            is_active: false
          })
          .eq('id', registration.id);
        
        // Only update task status for regular tasks
        if (registration.task_id) {
          // Check if anyone else is still working on this task
          const { data: stillActive, error: stillActiveError } = await supabase
            .from('time_registrations')
            .select('id')
            .eq('task_id', registration.task_id)
            .eq('is_active', true);
          
          if (stillActiveError) continue;
          
          // If no one else is working on the task, change status back to TODO
          if (!stillActive || stillActive.length === 0) {
            const updateData: any = { 
              status: 'TODO',
              assignee_id: null
            };
            
            if (remainingDuration !== undefined) {
              updateData.duration = remainingDuration;
            }
            
            await supabase
              .from('tasks')
              .update(updateData)
              .eq('id', registration.task_id);
          }
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
        tasks (title, phases (name, projects (id, name))),
        workstation_tasks (task_name, workstations (id, name))
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
        tasks (title, phases (name, projects (id, name))),
        workstation_tasks (task_name, workstations (id, name))
      `)
      .eq('employee_id', employeeId)
      .order('start_time', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};

