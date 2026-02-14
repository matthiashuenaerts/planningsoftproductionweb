import { supabase } from '@/integrations/supabase/client';

export interface CalculationVariableDefinition {
  id: string;
  variable_key: string;
  display_name: string;
  description: string | null;
  default_value: number;
  display_order: number;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export const calculationVariableDefinitionsService = {
  async getAll(): Promise<CalculationVariableDefinition[]> {
    const { data, error } = await supabase
      .from('calculation_variable_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    return data || [];
  },

  async getAllIncludingInactive(): Promise<CalculationVariableDefinition[]> {
    const { data, error } = await supabase
      .from('calculation_variable_definitions')
      .select('*')
      .order('display_order');
    if (error) throw error;
    return data || [];
  },

  async create(def: { variable_key: string; display_name: string; description?: string; default_value?: number }): Promise<CalculationVariableDefinition> {
    // Get max display_order
    const { data: existing } = await supabase
      .from('calculation_variable_definitions')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const maxOrder = existing?.[0]?.display_order ?? 0;

    const { data, error } = await supabase
      .from('calculation_variable_definitions')
      .insert([{ ...def, display_order: maxOrder + 1 }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Pick<CalculationVariableDefinition, 'variable_key' | 'display_name' | 'description' | 'default_value' | 'is_active' | 'display_order'>>): Promise<CalculationVariableDefinition> {
    const { data, error } = await supabase
      .from('calculation_variable_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('calculation_variable_definitions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getProjectValues(projectId: string): Promise<Record<string, { definitionId: string; value: number }>> {
    const { data, error } = await supabase
      .from('project_calculation_variable_values')
      .select('*, calculation_variable_definitions!inner(variable_key)')
      .eq('project_id', projectId);
    if (error) throw error;

    const result: Record<string, { definitionId: string; value: number }> = {};
    for (const row of data || []) {
      const key = (row as any).calculation_variable_definitions?.variable_key;
      if (key) {
        result[key] = { definitionId: row.variable_definition_id, value: row.value };
      }
    }
    return result;
  },

  async saveProjectValues(projectId: string, values: Record<string, number>, definitions: CalculationVariableDefinition[]): Promise<void> {
    for (const def of definitions) {
      const value = values[def.variable_key] ?? def.default_value;
      const { error } = await supabase
        .from('project_calculation_variable_values')
        .upsert({
          project_id: projectId,
          variable_definition_id: def.id,
          value,
        }, { onConflict: 'project_id,variable_definition_id' });
      if (error) throw error;
    }
  }
};
