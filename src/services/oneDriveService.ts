
import { supabase } from "@/integrations/supabase/client";

export interface ProjectOneDriveConfig {
  id: string;
  project_id: string;
  folder_id: string;
  folder_name: string;
  folder_url: string;
  drive_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
}

export interface EmployeeOneDriveTokens {
  id: string;
  employee_id: string;
  tenant_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  microsoft_email: string | null;
  created_at: string;
  updated_at: string;
}

export const oneDriveService = {
  // Save OneDrive folder link for a project
  async connectProjectToOneDrive(projectId: string, folderData: {
    folder_id: string;
    folder_name: string;
    folder_url: string;
    drive_id?: string;
  }): Promise<ProjectOneDriveConfig> {
    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .upsert([{
        project_id: projectId,
        folder_id: folderData.folder_id,
        folder_name: folderData.folder_name,
        folder_url: folderData.folder_url,
        drive_id: folderData.drive_id,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'project_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ProjectOneDriveConfig;
  },

  async getProjectOneDriveConfig(projectId: string): Promise<ProjectOneDriveConfig | null> {
    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    
    if (error) throw error;
    return data as ProjectOneDriveConfig | null;
  },

  async disconnectProjectFromOneDrive(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('project_onedrive_configs')
      .delete()
      .eq('project_id', projectId);
    
    if (error) throw error;
  },

  // Token management - persistent per employee
  async saveTokens(employeeId: string, tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    microsoft_email?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('employee_onedrive_tokens' as any)
      .upsert([{
        employee_id: employeeId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
        microsoft_email: tokens.microsoft_email || null,
      }], {
        onConflict: 'employee_id'
      });
    
    if (error) throw error;
  },

  async getTokens(employeeId: string): Promise<EmployeeOneDriveTokens | null> {
    const { data, error } = await supabase
      .from('employee_onedrive_tokens' as any)
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();
    
    if (error) throw error;
    return data as EmployeeOneDriveTokens | null;
  },

  async deleteTokens(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_onedrive_tokens' as any)
      .delete()
      .eq('employee_id', employeeId);
    
    if (error) throw error;
  },

  async isAuthenticated(employeeId: string): Promise<boolean> {
    const tokens = await this.getTokens(employeeId);
    return !!tokens;
  },
};
