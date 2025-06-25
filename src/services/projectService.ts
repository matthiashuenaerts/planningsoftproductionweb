
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
    
    // Cast the status to the correct union type
    return {
      ...data,
      status: data.status as "planned" | "in_progress" | "completed" | "on_hold"
    };
  }
}

export const projectService = new ProjectService();
