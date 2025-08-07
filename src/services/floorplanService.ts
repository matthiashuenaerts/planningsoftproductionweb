import { supabase } from '@/integrations/supabase/client';

export interface WorkstationPosition {
  id: string;
  workstation_id: string;
  x_position: number;
  y_position: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionFlowLine {
  id: string;
  name: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  color: string;
  stroke_width: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkstationStatus {
  workstation_id: string;
  is_active: boolean;
  active_users_count: number;
  active_user_names: string[];
  active_tasks: Array<{
    task_id: string;
    task_title: string;
    employee_name: string;
    project_name?: string;
  }>;
  current_projects: Array<{
    project_id: string;
    project_name: string;
    task_count: number;
  }>;
  has_error: boolean;
}

export const floorplanService = {
  // Workstation Positions
  async getWorkstationPositions(): Promise<WorkstationPosition[]> {
    const { data, error } = await supabase
      .from('workstation_positions')
      .select('*')
      .order('created_at');
    
    if (error) throw error;
    return data || [];
  },

  async updateWorkstationPosition(workstationId: string, x: number, y: number): Promise<void> {
    const { error } = await supabase
      .from('workstation_positions')
      .upsert({
        workstation_id: workstationId,
        x_position: x,
        y_position: y,
      });
    
    if (error) throw error;
  },

  // Production Flow Lines
  async getProductionFlowLines(): Promise<ProductionFlowLine[]> {
    const { data, error } = await supabase
      .from('production_flow_lines')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    
    if (error) throw error;
    return data || [];
  },

  async createProductionFlowLine(line: Omit<ProductionFlowLine, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('production_flow_lines')
      .insert(line);
    
    if (error) throw error;
  },

  async updateProductionFlowLine(id: string, updates: Partial<ProductionFlowLine>): Promise<void> {
    const { error } = await supabase
      .from('production_flow_lines')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
  },

  async deleteProductionFlowLine(id: string): Promise<void> {
    const { error } = await supabase
      .from('production_flow_lines')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  },

  // Workstation Status (based on active time registrations)
  async getWorkstationStatuses(): Promise<WorkstationStatus[]> {
    // Get active time registrations with detailed information
    const { data: timeRegistrations, error: timeError } = await supabase
      .from('time_registrations')
      .select(`
        workstation_task_id,
        employee_id,
        task_id,
        is_active,
        employees!inner(name),
        workstation_tasks!inner(
          workstation_id,
          workstations!inner(name)
        ),
        tasks(
          id,
          title,
          status,
          phases(
            project_id,
            projects(name)
          )
        )
      `)
      .eq('is_active', true);
    
    if (timeError) throw timeError;

    // Get current projects for each workstation (tasks that are todo or in_progress)
    const { data: currentProjects, error: projectError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        workstation,
        phases!inner(
          project_id,
          projects!inner(id, name)
        ),
        task_workstation_links(
          workstation_id,
          workstations(id, name)
        )
      `)
      .in('status', ['TODO', 'IN_PROGRESS']);
    
    if (projectError) throw projectError;

    // Group by workstation_id
    const workstationStatusMap = new Map<string, WorkstationStatus>();
    
    // Process active time registrations
    timeRegistrations?.forEach((reg: any) => {
      if (!reg.workstation_tasks?.workstation_id) return;
      
      const workstationId = reg.workstation_tasks.workstation_id;
      const userName = reg.employees?.name || 'Unknown User';
      
      if (!workstationStatusMap.has(workstationId)) {
        workstationStatusMap.set(workstationId, {
          workstation_id: workstationId,
          is_active: false,
          active_users_count: 0,
          active_user_names: [],
          active_tasks: [],
          current_projects: [],
          has_error: false
        });
      }
      
      const status = workstationStatusMap.get(workstationId)!;
      status.is_active = true;
      status.active_users_count++;
      status.active_user_names.push(userName);
      
      // Add active task info
      if (reg.tasks) {
        status.active_tasks.push({
          task_id: reg.tasks.id,
          task_title: reg.tasks.title,
          employee_name: userName,
          project_name: reg.tasks.phases?.projects?.name
        });
      }
    });

    // Process current projects for all workstations
    const projectsByWorkstation = new Map<string, Map<string, { project_id: string; project_name: string; task_count: number }>>();
    
    currentProjects?.forEach((task: any) => {
      // Handle both direct workstation field and workstation links
      const workstationIds: string[] = [];
      
      if (task.task_workstation_links?.length > 0) {
        task.task_workstation_links.forEach((link: any) => {
          if (link.workstation_id) {
            workstationIds.push(link.workstation_id);
          }
        });
      }
      
      workstationIds.forEach(workstationId => {
        if (!projectsByWorkstation.has(workstationId)) {
          projectsByWorkstation.set(workstationId, new Map());
        }
        
        const projectMap = projectsByWorkstation.get(workstationId)!;
        const projectId = task.phases?.projects?.id;
        const projectName = task.phases?.projects?.name;
        
        if (projectId && projectName) {
          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, {
              project_id: projectId,
              project_name: projectName,
              task_count: 0
            });
          }
          projectMap.get(projectId)!.task_count++;
        }
      });
    });

    // Add current projects to workstation statuses
    projectsByWorkstation.forEach((projectMap, workstationId) => {
      if (!workstationStatusMap.has(workstationId)) {
        workstationStatusMap.set(workstationId, {
          workstation_id: workstationId,
          is_active: false,
          active_users_count: 0,
          active_user_names: [],
          active_tasks: [],
          current_projects: [],
          has_error: false
        });
      }
      
      const status = workstationStatusMap.get(workstationId)!;
      status.current_projects = Array.from(projectMap.values());
    });

    return Array.from(workstationStatusMap.values());
  },

  // Real-time subscriptions
  subscribeToWorkstationPositions(callback: (positions: WorkstationPosition[]) => void) {
    return supabase
      .channel('workstation_positions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workstation_positions'
      }, async () => {
        const positions = await this.getWorkstationPositions();
        callback(positions);
      })
      .subscribe();
  },

  subscribeToTimeRegistrations(callback: (statuses: WorkstationStatus[]) => void) {
    return supabase
      .channel('time_registrations_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'time_registrations'
      }, async () => {
        const statuses = await this.getWorkstationStatuses();
        callback(statuses);
      })
      .subscribe();
  },

  subscribeToProductionFlowLines(callback: (lines: ProductionFlowLine[]) => void) {
    return supabase
      .channel('production_flow_lines_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'production_flow_lines'
      }, async () => {
        const lines = await this.getProductionFlowLines();
        callback(lines);
      })
      .subscribe();
  }
};