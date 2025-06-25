
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/services/dataService';

export class ProjectService {
  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    // Cast the status to the correct union type and add end_date
    return {
      ...data,
      status: data.status as "planned" | "in_progress" | "completed" | "on_hold",
      end_date: data.installation_date // Use installation_date as end_date
    };
  }
}

export const projectService = new ProjectService();
