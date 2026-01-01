
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
  }
};
