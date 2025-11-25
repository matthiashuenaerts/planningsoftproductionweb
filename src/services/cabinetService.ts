import { supabase } from '@/integrations/supabase/client';

// ===== TYPES =====

export interface CabinetProject {
  id: string;
  name: string;
  client_name?: string;
  client_address?: string;
  project_number?: string;
  currency: string;
  units: 'metric' | 'imperial';
  created_by?: string;
  status: 'draft' | 'quoted' | 'approved' | 'archived';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CabinetModel {
  id: string;
  name: string;
  description?: string;
  category: string;
  thumbnail_url?: string;
  is_template: boolean;
  default_width?: number;
  default_height?: number;
  default_depth?: number;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  min_depth?: number;
  max_depth?: number;
  parameters?: any;
  created_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CabinetConfiguration {
  id: string;
  project_id: string;
  model_id?: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  horizontal_divisions: number;
  vertical_divisions: number;
  door_type?: string;
  drawer_count: number;
  material_config?: any;
  finish?: string;
  edge_banding?: string;
  position_x: number;
  position_y: number;
  parameters?: any;
  created_at: string;
  updated_at: string;
}

export interface CabinetMaterial {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  unit: string;
  cost_per_unit: number;
  waste_factor: number;
  lead_time_days?: number;
  supplier?: string;
  standard_size_width?: number;
  standard_size_height?: number;
  thickness?: number;
  color?: string;
  finish_type?: string;
  image_url?: string;
  in_stock: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CabinetPart {
  id: string;
  configuration_id: string;
  part_type: string;
  part_name: string;
  material_id?: string;
  width?: number;
  height?: number;
  thickness?: number;
  length?: number;
  quantity: number;
  material_area?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  created_at: string;
}

export interface CabinetQuote {
  id: string;
  project_id: string;
  version: number;
  materials_cost: number;
  hardware_cost: number;
  labor_minutes: number;
  labor_cost: number;
  overhead_percentage: number;
  overhead_cost: number;
  margin_percentage: number;
  margin_amount: number;
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  total_cost: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface CabinetPriceRule {
  id: string;
  name: string;
  rule_type: string;
  value: number;
  unit?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== SERVICE CLASS =====

class CabinetService {
  // ===== PROJECT METHODS =====
  
  async getAllProjects(): Promise<CabinetProject[]> {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as any[]) || [];
  }

  async getProject(id: string): Promise<CabinetProject | null> {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as CabinetProject;
  }

  async createProject(project: Partial<CabinetProject>): Promise<CabinetProject> {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .insert([project as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetProject;
  }

  async updateProject(id: string, updates: Partial<CabinetProject>): Promise<CabinetProject> {
    const { data, error } = await supabase
      .from('cabinet_projects')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CabinetProject;
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('cabinet_projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ===== MODEL LIBRARY METHODS =====
  
  async getAllModels(): Promise<CabinetModel[]> {
    const { data, error } = await supabase
      .from('cabinet_models')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data as any[]) || [];
  }

  async getModelsByCategory(category: string): Promise<CabinetModel[]> {
    const { data, error } = await supabase
      .from('cabinet_models')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data as any[]) || [];
  }

  async createModel(model: Partial<CabinetModel>): Promise<CabinetModel> {
    const { data, error } = await supabase
      .from('cabinet_models')
      .insert([model as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetModel;
  }

  async updateModel(id: string, updates: Partial<CabinetModel>): Promise<CabinetModel> {
    const { data, error } = await supabase
      .from('cabinet_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ===== CONFIGURATION METHODS =====
  
  async getConfigurationsByProject(projectId: string): Promise<CabinetConfiguration[]> {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as any[]) || [];
  }

  async createConfiguration(config: Partial<CabinetConfiguration>): Promise<CabinetConfiguration> {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .insert([config as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetConfiguration;
  }

  async updateConfiguration(id: string, updates: Partial<CabinetConfiguration>): Promise<CabinetConfiguration> {
    const { data, error } = await supabase
      .from('cabinet_configurations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteConfiguration(id: string): Promise<void> {
    const { error } = await supabase
      .from('cabinet_configurations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ===== MATERIALS METHODS =====
  
  async getAllMaterials(): Promise<CabinetMaterial[]> {
    const { data, error } = await supabase
      .from('cabinet_materials')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true});

    if (error) throw error;
    return data || [];
  }

  async getMaterialsByCategory(category: string): Promise<CabinetMaterial[]> {
    const { data, error } = await supabase
      .from('cabinet_materials')
      .select('*')
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createMaterial(material: Partial<CabinetMaterial>): Promise<CabinetMaterial> {
    const { data, error } = await supabase
      .from('cabinet_materials')
      .insert([material as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetMaterial;
  }

  async updateMaterial(id: string, updates: Partial<CabinetMaterial>): Promise<CabinetMaterial> {
    const { data, error} = await supabase
      .from('cabinet_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ===== PARTS & QUOTE METHODS =====
  
  async getPartsByConfiguration(configId: string): Promise<CabinetPart[]> {
    const { data, error } = await supabase
      .from('cabinet_parts')
      .select('*')
      .eq('configuration_id', configId);

    if (error) throw error;
    return data || [];
  }

  async createPart(part: Partial<CabinetPart>): Promise<CabinetPart> {
    const { data, error } = await supabase
      .from('cabinet_parts')
      .insert([part as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetPart;
  }

  async getQuotesByProject(projectId: string): Promise<CabinetQuote[]> {
    const { data, error } = await supabase
      .from('cabinet_quotes')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createQuote(quote: Partial<CabinetQuote>): Promise<CabinetQuote> {
    const { data, error } = await supabase
      .from('cabinet_quotes')
      .insert([quote as any])
      .select()
      .single();

    if (error) throw error;
    return data as CabinetQuote;
  }

  // ===== PRICE RULES =====
  
  async getPriceRules(): Promise<CabinetPriceRule[]> {
    const { data, error } = await supabase
      .from('cabinet_price_rules')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  async updatePriceRule(id: string, updates: Partial<CabinetPriceRule>): Promise<CabinetPriceRule> {
    const { data, error } = await supabase
      .from('cabinet_price_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ===== UTILITY METHODS =====
  
  /**
   * Check if current user has one of the specified roles
   */
  async hasRole(roles: string[]): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error checking roles:', error);
      return false;
    }

    const userRoles = data?.map(r => String(r.role)) || [];
    return roles.some(role => userRoles.includes(role));
  }
}

export const cabinetService = new CabinetService();