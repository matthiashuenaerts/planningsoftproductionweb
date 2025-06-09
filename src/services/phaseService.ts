
import { supabase } from '@/integrations/supabase/client';
import { Phase } from '@/services/dataService';

export class PhaseService {
  async getByProject(projectId: string): Promise<Phase[]> {
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date');

    if (error) throw error;
    return data || [];
  }
}

export const phaseService = new PhaseService();
