
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
    return data;
  }
}

export const projectService = new ProjectService();
