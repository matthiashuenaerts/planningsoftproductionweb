
import { supabase } from "@/integrations/supabase/client";

export interface Workstation {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  icon_path: string | null;
  active_workers: number;
  sort_order: number;
  production_line: number;
  created_at: string;
  updated_at: string;
}

// Helper to normalize workstation data with new fields
const normalizeWorkstation = (ws: any): Workstation => ({
  ...ws,
  sort_order: ws.sort_order ?? 0,
  production_line: ws.production_line ?? 1
});

export const workstationService = {
  async getAll(): Promise<Workstation[]> {
    const { data, error } = await supabase
      .from('workstations')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch workstations: ${error.message}`);
    }
    
    return (data || []).map(normalizeWorkstation);
  },

  async getById(id: string): Promise<Workstation | null> {
    const { data, error } = await supabase
      .from('workstations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch workstation: ${error.message}`);
    }
    
    return data ? normalizeWorkstation(data) : null;
  },

  async getByName(name: string): Promise<Workstation | null> {
    const { data, error } = await supabase
      .from('workstations')
      .select('*')
      .eq('name', name)
      .single();
    
    if (error) {
      console.error('Error fetching workstation by name:', error);
      return null;
    }
    
    return data ? normalizeWorkstation(data) : null;
  },

  async create(workstation: { name: string; description?: string }): Promise<Workstation> {
    const { data, error } = await supabase
      .from('workstations')
      .insert({ name: workstation.name, description: workstation.description })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create workstation: ${error.message}`);
    }
    
    return normalizeWorkstation(data);
  },

  async update(id: string, updates: Partial<Pick<Workstation, 'name' | 'description' | 'image_path' | 'icon_path' | 'sort_order' | 'production_line'>>): Promise<Workstation> {
    const { data, error } = await supabase
      .from('workstations')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update workstation: ${error.message}`);
    }
    
    return normalizeWorkstation(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('workstations')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete workstation: ${error.message}`);
    }
  },

  async getWorkstationsForEmployee(employeeId: string): Promise<Workstation[]> {
    const { data, error } = await supabase
      .from('employee_workstation_links')
      .select(`
        workstations (
          id,
          name,
          description,
          image_path,
          icon_path,
          created_at,
          updated_at
        )
      `)
      .eq('employee_id', employeeId);
    
    if (error) {
      throw new Error(`Failed to fetch workstations for employee: ${error.message}`);
    }
    
    return data?.map(item => item.workstations).filter(Boolean) as Workstation[] || [];
  },

  async getWorkstationsForStandardTask(standardTaskId: string): Promise<Workstation[]> {
    const { data, error } = await supabase
      .from('standard_task_workstation_links')
      .select(`
        workstations (
          id,
          name,
          description,
          image_path,
          icon_path,
          created_at,
          updated_at
        )
      `)
      .eq('standard_task_id', standardTaskId);
    
    if (error) {
      throw new Error(`Failed to fetch workstations for standard task: ${error.message}`);
    }
    
    return data?.map(item => item.workstations).filter(Boolean) as Workstation[] || [];
  },

  async linkTaskToWorkstation(taskId: string, workstationId: string): Promise<void> {
    const { error } = await supabase
      .from('task_workstation_links')
      .insert({ task_id: taskId, workstation_id: workstationId });
    
    if (error) {
      throw new Error(`Failed to link task to workstation: ${error.message}`);
    }
  },

  async unlinkTaskFromWorkstation(taskId: string, workstationId?: string): Promise<void> {
    let query = supabase
      .from('task_workstation_links')
      .delete()
      .eq('task_id', taskId);
    
    if (workstationId) {
      query = query.eq('workstation_id', workstationId);
    }
    
    const { error } = await query;
    
    if (error) {
      throw new Error(`Failed to unlink task from workstation: ${error.message}`);
    }
  },

  async reassignTaskWorkstation(taskId: string, newWorkstationId: string): Promise<void> {
    // Delete all existing workstation links for this task
    const { error: deleteError } = await supabase
      .from('task_workstation_links')
      .delete()
      .eq('task_id', taskId);
    
    if (deleteError) {
      throw new Error(`Failed to remove existing workstation link: ${deleteError.message}`);
    }

    // Insert the new workstation link
    const { error: insertError } = await supabase
      .from('task_workstation_links')
      .insert({ task_id: taskId, workstation_id: newWorkstationId });
    
    if (insertError) {
      throw new Error(`Failed to assign task to new workstation: ${insertError.message}`);
    }
  },

  async getWorkstationsForTask(taskId: string): Promise<Workstation[]> {
    const { data, error } = await supabase
      .from('task_workstation_links')
      .select(`
        workstations (
          id,
          name,
          description,
          image_path,
          icon_path,
          active_workers,
          created_at,
          updated_at
        )
      `)
      .eq('task_id', taskId);
    
    if (error) {
      throw new Error(`Failed to fetch workstations for task: ${error.message}`);
    }
    
    return data?.map(item => item.workstations).filter(Boolean) as Workstation[] || [];
  },

  async linkEmployeeToWorkstation(employeeId: string, workstationId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_workstation_links')
      .insert({ employee_id: employeeId, workstation_id: workstationId });
    
    if (error) {
      throw new Error(`Failed to link employee to workstation: ${error.message}`);
    }
  },

  async unlinkEmployeeFromWorkstation(employeeId: string, workstationId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_workstation_links')
      .delete()
      .eq('employee_id', employeeId)
      .eq('workstation_id', workstationId);
    
    if (error) {
      throw new Error(`Failed to unlink employee from workstation: ${error.message}`);
    }
  },

  async updateActiveWorkers(id: string, activeWorkers: number): Promise<Workstation> {
    const { data, error } = await supabase
      .from('workstations')
      .update({ active_workers: activeWorkers })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update active workers: ${error.message}`);
    }
    
    return normalizeWorkstation(data);
  },

  async getEmployeesForWorkstation(workstationId: string): Promise<Array<{ id: string; name: string; email: string | null }>> {
    const { data, error } = await supabase
      .from('employee_workstation_links')
      .select(`
        employees (
          id,
          name,
          email
        )
      `)
      .eq('workstation_id', workstationId);
    
    if (error) {
      throw new Error(`Failed to fetch employees for workstation: ${error.message}`);
    }
    
    return data?.map(item => item.employees).filter(Boolean) as Array<{ id: string; name: string; email: string | null }> || [];
  }
};
