
import { supabase } from "@/integrations/supabase/client";

export interface OneDriveFolder {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface ProjectOneDriveConfig {
  id: string;
  project_id: string;
  folder_id: string;
  folder_name: string;
  folder_url: string;
  access_token?: string;
  created_at: string;
  updated_at: string;
}

export const oneDriveService = {
  async connectProjectToOneDrive(projectId: string, folderData: OneDriveFolder): Promise<ProjectOneDriveConfig> {
    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .insert([{
        project_id: projectId,
        folder_id: folderData.id,
        folder_name: folderData.name,
        folder_url: folderData.webUrl
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getProjectOneDriveConfig(projectId: string): Promise<ProjectOneDriveConfig | null> {
    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async updateProjectOneDriveConfig(projectId: string, updates: Partial<ProjectOneDriveConfig>): Promise<ProjectOneDriveConfig> {
    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async disconnectProjectFromOneDrive(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('project_onedrive_configs')
      .delete()
      .eq('project_id', projectId);
    
    if (error) throw error;
  },

  // Helper method to generate OneDrive authorization URL
  generateAuthUrl(clientId: string, redirectUri: string, projectId: string): string {
    const scope = 'Files.ReadWrite.All';
    const responseType = 'code';
    const state = btoa(JSON.stringify({ projectId })); // Encode project ID in state
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: responseType,
      redirect_uri: redirectUri,
      scope: scope,
      state: state
    });
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  },

  // Helper method to create a folder structure for a project
  async createProjectFolderStructure(accessToken: string, projectName: string): Promise<OneDriveFolder> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Project - ${projectName}`,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create OneDrive folder');
    }
    
    return await response.json();
  }
};
