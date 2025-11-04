import { supabase } from '@/integrations/supabase/client';

export interface ProjectTeamAssignmentOverride {
  id: string;
  project_id: string;
  team_id: string;
  start_date: string;
  end_date: string;
  start_hour: number;
  end_hour: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTeamAssignmentOverrideInsert {
  project_id: string;
  team_id: string;
  start_date: string;
  end_date: string;
  start_hour: number;
  end_hour: number;
}

export class ProjectTeamAssignmentOverrideService {
  async getAll(): Promise<ProjectTeamAssignmentOverride[]> {
    const { data, error } = await supabase
      .from('project_team_assignment_overrides')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async getByProject(projectId: string): Promise<ProjectTeamAssignmentOverride[]> {
    const { data, error } = await supabase
      .from('project_team_assignment_overrides')
      .select('*')
      .eq('project_id', projectId);

    if (error) throw error;
    return data || [];
  }

  async upsert(override: ProjectTeamAssignmentOverrideInsert): Promise<ProjectTeamAssignmentOverride> {
    const { data, error } = await supabase
      .from('project_team_assignment_overrides')
      .upsert([override] as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('project_team_assignment_overrides')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const projectTeamAssignmentOverrideService = new ProjectTeamAssignmentOverrideService();
