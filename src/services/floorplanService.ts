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
    const { data, error } = await supabase
      .from('time_registrations')
      .select(`
        workstation_task_id,
        employee_id,
        is_active,
        employees!inner(name),
        workstation_tasks!inner(workstation_id)
      `)
      .eq('is_active', true);
    
    if (error) throw error;

    // Group by workstation_id
    const workstationStatusMap = new Map<string, WorkstationStatus>();
    
    data?.forEach((reg: any) => {
      if (!reg.workstation_tasks?.workstation_id) return;
      
      const workstationId = reg.workstation_tasks.workstation_id;
      const userName = reg.employees?.name || 'Unknown User';
      
      if (!workstationStatusMap.has(workstationId)) {
        workstationStatusMap.set(workstationId, {
          workstation_id: workstationId,
          is_active: false,
          active_users_count: 0,
          active_user_names: []
        });
      }
      
      const status = workstationStatusMap.get(workstationId)!;
      status.is_active = true;
      status.active_users_count++;
      status.active_user_names.push(userName);
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