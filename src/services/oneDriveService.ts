
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
  refresh_token?: string;
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export const oneDriveService = {
  async connectProjectToOneDrive(projectId: string, folderData: OneDriveFolder, tokens?: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }): Promise<ProjectOneDriveConfig> {
    const insertData: any = {
      project_id: projectId,
      folder_id: folderData.id,
      folder_name: folderData.name,
      folder_url: folderData.webUrl
    };

    // Add token data if provided
    if (tokens) {
      insertData.access_token = tokens.access_token;
      if (tokens.refresh_token) {
        insertData.refresh_token = tokens.refresh_token;
      }
      if (tokens.expires_in) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);
        insertData.token_expires_at = expiresAt.toISOString();
      }
    }

    const { data, error } = await supabase
      .from('project_onedrive_configs')
      .insert([insertData])
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
    return data as ProjectOneDriveConfig;
  },

  async disconnectProjectFromOneDrive(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('project_onedrive_configs')
      .delete()
      .eq('project_id', projectId);
    
    if (error) throw error;
  },

  // Generate OneDrive authorization URL with tenant-specific endpoint
  generateAuthUrl(clientId: string, redirectUri: string, projectId: string, tenantId?: string): string {
    const scope = 'Files.ReadWrite.All offline_access';
    const responseType = 'code';
    const state = btoa(JSON.stringify({ projectId }));
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: responseType,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      prompt: 'consent' // Force consent to ensure refresh token
    });
    
    // Use tenant-specific endpoint if tenant ID is provided
    const baseUrl = tenantId 
      ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    
    return `${baseUrl}?${params.toString()}`;
  },

  // Exchange authorization code for access token
  async exchangeCodeForTokens(code: string, clientId: string, redirectUri: string, tenantId?: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const tokenUrl = tenantId
      ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'Files.ReadWrite.All offline_access'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    return await response.json();
  },

  // Create a folder structure for a project
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
      const errorText = await response.text();
      console.error('OneDrive API Error:', errorText);
      throw new Error('Failed to create OneDrive folder');
    }
    
    return await response.json();
  },

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string, clientId: string, tenantId?: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const tokenUrl = tenantId
      ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Files.ReadWrite.All offline_access'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    return await response.json();
  }
};
