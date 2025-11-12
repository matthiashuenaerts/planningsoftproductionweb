
import { supabase } from '@/integrations/supabase/client';

export interface ProjectTeamAssignment {
  id: string;
  project_id: string;
  team: string;
  team_id?: string;
  start_date: string;
  duration: number;
  created_at: string;
  updated_at: string;
}

export class ProjectTeamAssignmentService {
  async getByProject(projectId: string): Promise<ProjectTeamAssignment[]> {
    const { data, error } = await supabase
      .from('project_team_assignments')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date');

    if (error) throw error;
    return data || [];
  }
}

export const projectTeamAssignmentService = new ProjectTeamAssignmentService();
