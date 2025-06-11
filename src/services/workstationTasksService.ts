
import { supabase } from '@/integrations/supabase/client';

export interface WorkstationTask {
  id: string;
  workstation_id: string;
  task_name: string;
  description: string | null;
  duration: number | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkstationTaskData {
  workstation_id: string;
  task_name: string;
  description?: string;
  duration?: number;
  priority: string;
}

export interface UpdateWorkstationTaskData {
  task_name?: string;
  description?: string;
  duration?: number;
  priority?: string;
}

export const workstationTasksService = {
  async getAll(): Promise<WorkstationTask[]> {
    const { data, error } = await supabase
      .from('workstation_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch workstation tasks: ${error.message}`);
    }

    return data || [];
  },

  async getByWorkstation(workstationId: string): Promise<WorkstationTask[]> {
    const { data, error } = await supabase
      .from('workstation_tasks')
      .select('*')
      .eq('workstation_id', workstationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch workstation tasks: ${error.message}`);
    }

    return data || [];
  },

  async getById(id: string): Promise<WorkstationTask | null> {
    const { data, error } = await supabase
      .from('workstation_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch workstation task: ${error.message}`);
    }

    return data;
  },

  async create(taskData: CreateWorkstationTaskData): Promise<WorkstationTask> {
    const { data, error } = await supabase
      .from('workstation_tasks')
      .insert([{
        ...taskData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create workstation task: ${error.message}`);
    }

    return data;
  },

  async update(id: string, taskData: UpdateWorkstationTaskData): Promise<WorkstationTask> {
    const { data, error } = await supabase
      .from('workstation_tasks')
      .update({
        ...taskData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update workstation task: ${error.message}`);
    }

    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('workstation_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete workstation task: ${error.message}`);
    }
  }
};
