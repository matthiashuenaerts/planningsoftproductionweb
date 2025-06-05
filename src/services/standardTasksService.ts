
import { supabase } from "@/integrations/supabase/client";

export interface StandardTask {
  id: string;
  task_number: string;
  task_name: string;
  time_coefficient: number;
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
      
      // If no tasks exist for this standard task, or not all are completed, limit phases are not satisfied
      if (!projectTasks || projectTasks.length === 0) {
        return false;
      }
      
      // Check if all instances of this standard task in the project are completed
      const allCompleted = projectTasks.every(task => task.status === 'COMPLETED');
      if (!allCompleted) {
        return false;
      }
    }
    
    return true; // All limit phases are completed
  },

  // Get task name parts by splitting the task name at underscores
  getTaskNameParts(taskName: string): string[] {
    return taskName.split('_').filter(part => part.trim() !== '');
  },

  // Calculate task duration based on time coefficient and project value
  calculateTaskDuration(timeCoefficient: number, projectValue: number): number {
    return Math.round(timeCoefficient * projectValue);
  }
};
