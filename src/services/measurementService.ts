import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';

export interface ProjectMeasurement {
  id: string;
  tenant_id: string;
  project_id: string;
  measurement_date: string | null;
  measurer_id: string | null;
  status: string;
  notes: string | null;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
}

export const measurementService = {
  async getByProject(projectId: string): Promise<ProjectMeasurement[]> {
    const { data, error } = await supabase
      .from('project_measurements' as any)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ProjectMeasurement[];
  },

  async create(measurement: Partial<ProjectMeasurement>): Promise<ProjectMeasurement> {
    const { data, error } = await supabase
      .from('project_measurements' as any)
      .insert(measurement)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ProjectMeasurement;
  },

  async update(id: string, updates: Partial<ProjectMeasurement>): Promise<ProjectMeasurement> {
    const { data, error } = await supabase
      .from('project_measurements' as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ProjectMeasurement;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('project_measurements' as any).delete().eq('id', id);
    if (error) throw error;
  },

  async uploadFile(projectId: string, file: File): Promise<string> {
    const path = `measurements/${projectId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('measurement-files').upload(path, file);
    if (error) throw error;
    return path;
  },

  async getFiles(projectId: string): Promise<any[]> {
    const { data, error } = await supabase.storage.from('measurement-files').list(`measurements/${projectId}`);
    if (error) throw error;
    return data ?? [];
  },

  async deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage.from('measurement-files').remove([path]);
    if (error) throw error;
  },
};
