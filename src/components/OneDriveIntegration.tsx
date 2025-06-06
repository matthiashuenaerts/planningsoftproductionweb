
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { oneDriveService, ProjectOneDriveConfig } from '@/services/oneDriveService';
import { ExternalLink, Folder, Plus, Unlink, RefreshCw } from 'lucide-react';

interface OneDriveIntegrationProps {
  projectId: string;
  projectName: string;
}

const OneDriveIntegration: React.FC<OneDriveIntegrationProps> = ({ projectId, projectName }) => {
  const [config, setConfig] = useState<ProjectOneDriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  // OneDrive app configuration with your provided credentials
  const ONEDRIVE_CLIENT_ID = '092681d3-68ad-4b6d-84f0-995b3525462a';
  const TENANT_ID = '6d129b43-6491-418d-b9cd-e1f43b7866bb';
  const REDIRECT_URI = `${window.location.origin}/onedrive-callback`;

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  useEffect(() => {
    // Listen for OAuth callback messages
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'ONEDRIVE_AUTH_SUCCESS') {
        setConnecting(false);
        loadConfig();
        toast({
          title: 'Succes',
          description: 'OneDrive map succesvol verbonden',
        });
      } else if (event.data.type === 'ONEDRIVE_AUTH_ERROR') {
        setConnecting(false);
        toast({
          title: 'Fout',
          description: 'Verbinding met OneDrive map mislukt',
          variant: 'destructive'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configData = await oneDriveService.getProjectOneDriveConfig(projectId);
      setConfig(configData);
    } catch (error) {
      console.error('Error loading OneDrive config:', error);
      toast({
        title: 'Fout',
        description: 'Laden van OneDrive configuratie mislukt',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectOneDrive = () => {
    setConnecting(true);
    
    // Generate authorization URL with tenant-specific endpoint
    const authUrl = oneDriveService.generateAuthUrl(
      ONEDRIVE_CLIENT_ID,
      REDIRECT_URI,
      projectId,
      TENANT_ID
    );
    
    // Open in new window for OAuth flow
    const authWindow = window.open(
      authUrl,
      'onedrive-auth',
      'width=600,height=700,scrollbars=yes,resizable=yes,location=yes'
    );

    // Check if popup was blocked
    if (!authWindow) {
      setConnecting(false);
      toast({
        title: 'Popup geblokkeerd',
        description: 'Schakel popups in voor deze website om door te gaan',
        variant: 'destructive'
      });
      return;
    }

    // Monitor for window closure
    const checkClosed = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(checkClosed);
        setConnecting(false);
      }
    }, 1000);
  };

  const handleDisconnectOneDrive = async () => {
    try {
      await oneDriveService.disconnectProjectFromOneDrive(projectId);
      setConfig(null);
      toast({
        title: 'Succes',
        description: 'OneDrive map losgekoppeld',
      });
    } catch (error) {
      console.error('Error disconnecting OneDrive:', error);
      toast({
        title: 'Fout',
        description: 'Loskoppelen van OneDrive map mislukt',
        variant: 'destructive'
      });
    }
  };

  const handleOpenFolder = () => {
    if (config?.folder_url) {
      window.open(config.folder_url, '_blank');
    }
  };

  const handleRefresh = () => {
    loadConfig();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            OneDrive Integratie
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
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            OneDrive Integratie
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {config ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Verbonden Map</h4>
                <p className="text-sm text-gray-600">{config.folder_name}</p>
                <p className="text-xs text-gray-500">
                  Verbonden op {new Date(config.created_at).toLocaleDateString('nl-NL')}
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                Verbonden
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleOpenFolder} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Map Openen
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDisconnectOneDrive}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Unlink className="h-4 w-4" />
                Loskoppelen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">OneDrive Map Verbinden</h4>
              <p className="text-sm text-gray-600 mb-4">
                Verbind een OneDrive map met dit project voor eenvoudig delen van bestanden en samenwerking.
                Er wordt een speciale map aangemaakt voor projectbestanden.
              </p>
            </div>
            
            <Button 
              onClick={handleConnectOneDrive} 
              disabled={connecting}
              className="flex items-center gap-2"
            >
              {connecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {connecting ? 'Verbinden...' : 'OneDrive Verbinden'}
            </Button>
            
            <div className="text-xs text-gray-500">
              <p>Let op: Je moet inloggen op je Microsoft account en toestemming geven.</p>
              <p className="mt-1">Tenant ID: {TENANT_ID}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OneDriveIntegration;
