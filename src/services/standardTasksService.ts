
import { supabase } from "@/integrations/supabase/client";

export interface StandardTask {
  id: string;
  task_number: string;
  task_name: string;
  time_coefficient: number;
  day_counter: number;
  color?: string;
  hourly_cost: number;
  created_at: string;
  updated_at: string;
}

export interface LimitPhase {
  id: string;
  standard_task_id: string;
  standard_task_number: string;
  standard_task_name: string;
}

export const standardTasksService = {
  async getAll(): Promise<StandardTask[]> {
    console.log('Fetching all standard tasks...');
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('*')
      .order('task_number', { ascending: true });
    
    if (error) {
      console.error('Error fetching standard tasks:', error);
      throw error;
    }
    console.log('Standard tasks fetched successfully:', data);
    return data as StandardTask[] || [];
  },

  async getById(id: string): Promise<StandardTask | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data as StandardTask;
  },

  async getByTaskNumber(taskNumber: string): Promise<StandardTask | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('*')
      .eq('task_number', taskNumber)
      .maybeSingle();
    
    if (error) throw error;
    return data as StandardTask;
  },

  async updateTimeCoefficient(id: string, timeCoefficient: number): Promise<StandardTask | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .update({ time_coefficient: timeCoefficient })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data as StandardTask;
  },

  async updateDayCounter(id: string, dayCounter: number): Promise<StandardTask | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .update({ day_counter: dayCounter })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data as StandardTask;
  },

  async updateColor(id: string, color: string): Promise<StandardTask | null> {
    console.log(`Updating color for task ${id} to ${color}`);
    const { data, error } = await supabase
      .from('standard_tasks')
      .update({ color: color })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) {
      console.error('Error updating color:', error);
      throw error;
    }
    console.log('Color updated successfully:', data);
    return data as StandardTask;
  },

  async updateHourlyCost(id: string, hourlyCost: number): Promise<StandardTask | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .update({ hourly_cost: hourlyCost })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as StandardTask;
  },

  async getAllStandardTasksForLimitPhases(): Promise<StandardTask[]> {
    // Get all standard tasks that can be used as limit phases
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('*')
      .order('task_number');
    
    if (error) throw error;
    return data as StandardTask[] || [];
  },

  async getLimitPhases(standardTaskId: string): Promise<LimitPhase[]> {
    console.log(`Fetching limit phases for standard task: ${standardTaskId}`);
    const { data, error } = await supabase
      .from('standard_task_limit_phases')
      .select(`
        id,
        limit_standard_task_id,
        standard_tasks!standard_task_limit_phases_limit_standard_task_id_fkey(task_number, task_name)
      `)
      .eq('standard_task_id', standardTaskId);
    
    if (error) {
      console.error('Error fetching limit phases:', error);
      throw error;
    }
    
    console.log('Raw limit phases data:', data);
    
    // Transform the data to match our LimitPhase interface
    const transformedData = (data || []).map(item => ({
      id: item.id,
      standard_task_id: item.limit_standard_task_id,
      standard_task_number: (item.standard_tasks as any)?.task_number || '',
      standard_task_name: (item.standard_tasks as any)?.task_name || ''
    }));
    
    console.log('Transformed limit phases:', transformedData);
    return transformedData;
  },

  async addLimitPhase(standardTaskId: string, limitStandardTaskId: string): Promise<LimitPhase> {
    console.log(`Adding limit phase: ${standardTaskId} -> ${limitStandardTaskId}`);
    
    // First check if this limit phase already exists
    const { data: existing } = await supabase
      .from('standard_task_limit_phases')
      .select('id')
      .eq('standard_task_id', standardTaskId)
      .eq('limit_standard_task_id', limitStandardTaskId)
      .maybeSingle();
    
    if (existing) {
      throw new Error('This limit phase already exists');
    }
    
    const { data, error } = await supabase
      .from('standard_task_limit_phases')
      .insert({
        standard_task_id: standardTaskId,
        limit_standard_task_id: limitStandardTaskId
      })
      .select(`
        id,
        limit_standard_task_id,
        standard_tasks!standard_task_limit_phases_limit_standard_task_id_fkey(task_number, task_name)
      `)
      .single();
    
    if (error) {
      console.error('Error adding limit phase:', error);
      throw error;
    }
    
    return {
      id: data.id,
      standard_task_id: data.limit_standard_task_id,
      standard_task_number: (data.standard_tasks as any)?.task_number || '',
      standard_task_name: (data.standard_tasks as any)?.task_name || ''
    };
  },

  async removeLimitPhase(limitPhaseId: string): Promise<void> {
    const { error } = await supabase
      .from('standard_task_limit_phases')
      .delete()
      .eq('id', limitPhaseId);
    
    if (error) throw error;
  },

  async checkLimitPhasesCompleted(standardTaskId: string, projectId: string): Promise<boolean> {
    // Get all limit phases for this standard task
    const limitPhases = await this.getLimitPhases(standardTaskId);
    
    if (limitPhases.length === 0) {
      return true; // No limit phases means task can proceed
    }
    
    // Check if all limit standard tasks are completed in the project
    for (const limitPhase of limitPhases) {
      // Find tasks in the project that match this standard task
      const { data: projectTasks, error } = await supabase
        .from('tasks')
        .select(`
          status,
          phases!inner(project_id)
        `)
        .eq('phases.project_id', projectId)
        .eq('standard_task_id', limitPhase.standard_task_id);
      
      if (error) throw error;
      
      // If no tasks exist for this standard task, it means it was either:
      // 1. Not included in the project (unchecked during creation), OR
      // 2. Actually missing
      // We need to check if this standard task was intentionally excluded
      if (!projectTasks || projectTasks.length === 0) {
        // Check if this standard task was intentionally excluded from the project
        const wasExcluded = await this.wasStandardTaskExcludedFromProject(limitPhase.standard_task_id, projectId);
        
        if (wasExcluded) {
          // If it was excluded, we consider it as "satisfied" for limit phase purposes
          continue;
        } else {
          // If it wasn't excluded but doesn't exist, limit phases are not satisfied
          return false;
        }
      }
      
      // Check if all instances of this standard task in the project are completed
      const allCompleted = projectTasks.every(task => task.status === 'COMPLETED');
      if (!allCompleted) {
        return false;
      }
    }
    
    return true; // All limit phases are completed or excluded
  },

  async wasStandardTaskExcludedFromProject(standardTaskId: string, projectId: string): Promise<boolean> {
    try {
      // Check if there are any phases in this project that should have this standard task
      // but it was intentionally excluded
      
      // First, get all phases for this project
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id, name')
        .eq('project_id', projectId);
      
      if (phasesError || !phases) {
        console.error('Error fetching phases:', phasesError);
        return false;
      }
      
      // For each phase, check if this standard task should exist but doesn't
      // This is a heuristic - if other similar tasks exist in the project but this one doesn't,
      // it was likely excluded during creation
      
      // Get the standard task details
      const standardTask = await this.getById(standardTaskId);
      if (!standardTask) return false;
      
      // Check if there are any tasks at all in this project with standard_task_id
      const { data: anyStandardTasks, error: anyError } = await supabase
        .from('tasks')
        .select(`
          id,
          phases!inner(project_id)
        `)
        .eq('phases.project_id', projectId)
        .not('standard_task_id', 'is', null)
        .limit(1);
      
      if (anyError) {
        console.error('Error checking for standard tasks:', anyError);
        return false;
      }
      
      // If there are other standard tasks in the project but this specific one is missing,
      // it was likely excluded
      if (anyStandardTasks && anyStandardTasks.length > 0) {
        console.log(`Standard task ${standardTaskId} was excluded from project ${projectId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if standard task was excluded:', error);
      return false; // Fail safe - assume it wasn't excluded
    }
  },

  // Get task name parts by splitting the task name at underscores
  getTaskNameParts(taskName: string): string[] {
    return taskName.split('_').filter(part => part.trim() !== '');
  },

  // Calculate task duration based on time coefficient and project value
  calculateTaskDuration(timeCoefficient: number, projectValue: number): number {
    return Math.round(timeCoefficient * projectValue);
  },

  // Calculate task due date based on installation date and day counter
  calculateTaskDueDate(installationDate: Date, dayCounter: number): Date {
    const dueDate = new Date(installationDate);
    dueDate.setDate(dueDate.getDate() - dayCounter);
    return dueDate;
  },

  async linkEmployeeToStandardTask(employeeId: string, standardTaskId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_standard_task_links')
      .insert({ employee_id: employeeId, standard_task_id: standardTaskId });
    
    if (error) {
      throw new Error(`Failed to link employee to standard task: ${error.message}`);
    }
  },

  async unlinkEmployeeFromStandardTask(employeeId: string, standardTaskId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_standard_task_links')
      .delete()
      .eq('employee_id', employeeId)
      .eq('standard_task_id', standardTaskId);
    
    if (error) {
      throw new Error(`Failed to unlink employee from standard task: ${error.message}`);
    }
  },

  async getStandardTasksForEmployee(employeeId: string): Promise<StandardTask[]> {
    const { data, error } = await supabase
      .from('employee_standard_task_links')
      .select(`
        standard_tasks (
          id,
          task_number,
          task_name,
          time_coefficient,
          day_counter,
          color,
          hourly_cost,
          created_at,
          updated_at
        )
      `)
      .eq('employee_id', employeeId);
    
    if (error) {
      throw new Error(`Failed to fetch standard tasks for employee: ${error.message}`);
    }
    
    return data?.map(item => item.standard_tasks).filter(Boolean) as StandardTask[] || [];
  },

  async create(task: { task_number: string; task_name: string; time_coefficient?: number; day_counter?: number; color?: string; hourly_cost?: number }): Promise<StandardTask> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .insert({
        task_number: task.task_number,
        task_name: task.task_name,
        time_coefficient: task.time_coefficient || 0,
        day_counter: task.day_counter || 0,
        color: task.color || null,
        hourly_cost: task.hourly_cost || 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating standard task:', error);
      throw error;
    }
    return data as StandardTask;
  },

  async update(id: string, updates: Partial<{ task_number: string; task_name: string; time_coefficient: number; day_counter: number; color: string; hourly_cost: number }>): Promise<StandardTask> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating standard task:', error);
      throw error;
    }
    return data as StandardTask;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('standard_tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting standard task:', error);
      throw error;
    }
  }
};
