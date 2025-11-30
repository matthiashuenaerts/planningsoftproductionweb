import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CabinetProject = Database['public']['Tables']['cabinet_projects']['Row'];
type CabinetProjectInsert = Database['public']['Tables']['cabinet_projects']['Insert'];
type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];
type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];
type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

export const cabinetService = {
  // Projects
  async getAllProjects() {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as CabinetProject[];
  },

  async getProject(id: string) {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as CabinetProject;
  },

  async createProject(project: CabinetProjectInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('cabinet_projects')
      .insert({
        ...project,
        created_by: user?.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as CabinetProject;
  },

  async updateProject(id: string, updates: Partial<CabinetProjectInsert>) {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as CabinetProject;
  },

  async deleteProject(id: string) {
    const { error } = await supabase
      .from('cabinet_projects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Models
  async getAllModels() {
    const { data, error } = await supabase
      .from('cabinet_models')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });
    
    if (error) throw error;
    return data as CabinetModel[];
  },

  async getModel(modelId: string) {
    const { data, error } = await supabase
      .from('cabinet_models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (error) throw error;
    return data as CabinetModel;
  },

  // Configurations
  async getProjectConfigurations(projectId: string) {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as CabinetConfiguration[];
  },

  async createConfiguration(config: {
    project_id: string;
    model_id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    horizontal_divisions: number;
    vertical_divisions: number;
    drawer_count: number;
    door_type: string;
    material_config: any;
    edge_banding: string;
    finish: string;
    parameters?: any;
  }) {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .insert([config])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetConfiguration;
  },

  async updateConfiguration(id: string, config: {
    name?: string;
    width?: number;
    height?: number;
    depth?: number;
    horizontal_divisions?: number;
    vertical_divisions?: number;
    drawer_count?: number;
    door_type?: string;
    material_config?: any;
    edge_banding?: string;
    finish?: string;
    parameters?: any;
  }) {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .update(config)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CabinetConfiguration;
  },

  async getConfiguration(id: string) {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as CabinetConfiguration;
  },

  // Materials
  async getAllMaterials() {
    const { data, error } = await supabase
      .from('cabinet_materials')
      .select('*')
      .eq('in_stock', true)
      .order('category', { ascending: true });
    
    if (error) throw error;
    return data as CabinetMaterial[];
  },
};
