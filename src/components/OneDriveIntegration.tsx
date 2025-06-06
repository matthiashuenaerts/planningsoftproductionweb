
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { oneDriveService, ProjectOneDriveConfig } from '@/services/oneDriveService';
import { ExternalLink, Folder, Plus, Unlink } from 'lucide-react';

interface OneDriveIntegrationProps {
  projectId: string;
  projectName: string;
}

const OneDriveIntegration: React.FC<OneDriveIntegrationProps> = ({ projectId, projectName }) => {
  const [config, setConfig] = useState<ProjectOneDriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // OneDrive app configuration - these would typically come from environment variables
  const ONEDRIVE_CLIENT_ID = 'cd418fec-67b0-4627-acf9-1adae0a8b8e5'; // This should be configured in project settings
  const REDIRECT_URI = `https://id-preview--3f276e44-b7a1-4360-9d73-f35784886018.lovable.app/onedrive-callback`;

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configData = await oneDriveService.getProjectOneDriveConfig(projectId);
      setConfig(configData);
    } catch (error) {
      console.error('Error loading OneDrive config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load OneDrive configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectOneDrive = () => {
    // Generate authorization URL and redirect user
    const authUrl = oneDriveService.generateAuthUrl(
      ONEDRIVE_CLIENT_ID,
      REDIRECT_URI,
      projectId
    );
    
    // Open in new window for OAuth flow
    const authWindow = window.open(
      authUrl,
      'onedrive-auth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    // Listen for the OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'ONEDRIVE_AUTH_SUCCESS') {
        authWindow?.close();
        loadConfig(); // Reload configuration
        toast({
          title: 'Success',
          description: 'OneDrive folder connected successfully',
        });
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'ONEDRIVE_AUTH_ERROR') {
        authWindow?.close();
        toast({
          title: 'Error',
          description: 'Failed to connect OneDrive folder',
          variant: 'destructive'
        });
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  const handleDisconnectOneDrive = async () => {
    try {
      await oneDriveService.disconnectProjectFromOneDrive(projectId);
      setConfig(null);
      toast({
        title: 'Success',
        description: 'OneDrive folder disconnected',
      });
    } catch (error) {
      console.error('Error disconnecting OneDrive:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect OneDrive folder',
        variant: 'destructive'
      });
    }
  };

  const handleOpenFolder = () => {
    if (config?.folder_url) {
      window.open(config.folder_url, '_blank');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            OneDrive Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          OneDrive Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {config ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Connected Folder</h4>
                <p className="text-sm text-gray-600">{config.folder_name}</p>
                <p className="text-xs text-gray-500">
                  Connected on {new Date(config.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                Connected
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleOpenFolder} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Folder
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDisconnectOneDrive}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Connect OneDrive Folder</h4>
              <p className="text-sm text-gray-600 mb-4">
                Connect a OneDrive folder to this project for easy file sharing and collaboration.
                A dedicated folder will be created for project files.
              </p>
            </div>
            
            <Button onClick={handleConnectOneDrive} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Connect OneDrive
            </Button>
            
            <div className="text-xs text-gray-500">
              <p>Note: You'll need to sign in to your Microsoft account and grant permissions.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OneDriveIntegration;
