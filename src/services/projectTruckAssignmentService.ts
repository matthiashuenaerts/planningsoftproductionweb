
import { supabase } from '@/integrations/supabase/client';

export interface ProjectTruckAssignment {
  id: string;
  project_id: string;
  truck_id: string;
  loading_date: string;
  installation_date: string;
  notes?: string;
  assigned_by?: string;
  created_at: string;
  updated_at: string;
}

export class ProjectTruckAssignmentService {
  async getByProject(projectId: string): Promise<ProjectTruckAssignment[]> {
    const { data, error } = await supabase
      .from('project_truck_assignments')
      .select('*')
      .eq('project_id', projectId)
      .order('loading_date');

    if (error) throw error;
    return data || [];
  }
}

export const projectTruckAssignmentService = new ProjectTruckAssignmentService();
