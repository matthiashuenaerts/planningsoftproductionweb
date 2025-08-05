import { supabase } from '@/integrations/supabase/client';

export interface ProjectCalculationVariables {
  id: string;
  project_id: string;
  aantal_objecten: number;
  aantal_kasten: number;
  aantal_stuks: number;
  aantal_platen: number;
  aantal_zaagsnedes: number;
  aantal_lopende_meters_zaagsnede: number;
  aantal_verschillende_kantenbanden: number;
  aantal_lopende_meter_kantenbanden: number;
  aantal_drevel_programmas: number;
  aantal_cnc_programmas: number;
  aantal_boringen: number;
  aantal_kasten_te_monteren: number;
  aantal_manueel_te_monteren_kasten: number;
  aantal_manueel_te_monteren_objecten: number;
  created_at: string;
  updated_at: string;
}

export interface CalculationTaskRelationship {
  id: string;
  variable_name: string;
  standard_task_id: string;
  multiplier: number;
  base_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export class ProjectCalculationService {
  async getVariablesByProject(projectId: string): Promise<ProjectCalculationVariables | null> {
    const { data, error } = await supabase
      .from('project_calculation_variables')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createOrUpdateVariables(projectId: string, variables: Partial<ProjectCalculationVariables>): Promise<ProjectCalculationVariables> {
    const { data: existingData } = await supabase
      .from('project_calculation_variables')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (existingData) {
      // Update existing
      const { data, error } = await supabase
        .from('project_calculation_variables')
        .update(variables)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('project_calculation_variables')
        .insert([{ project_id: projectId, ...variables }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async getAllTaskRelationships(): Promise<CalculationTaskRelationship[]> {
    const { data, error } = await supabase
      .from('calculation_task_relationships')
      .select('*')
      .order('variable_name');

    if (error) throw error;
    return data || [];
  }

  async createTaskRelationship(relationship: Omit<CalculationTaskRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<CalculationTaskRelationship> {
    const { data, error } = await supabase
      .from('calculation_task_relationships')
      .insert([relationship])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTaskRelationship(id: string, relationship: Partial<CalculationTaskRelationship>): Promise<CalculationTaskRelationship> {
    const { data, error } = await supabase
      .from('calculation_task_relationships')
      .update(relationship)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTaskRelationship(id: string): Promise<void> {
    const { error } = await supabase
      .from('calculation_task_relationships')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const projectCalculationService = new ProjectCalculationService();