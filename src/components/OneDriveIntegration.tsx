import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { oneDriveService, ProjectOneDriveConfig } from '@/services/oneDriveService';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { 
  ExternalLink, Folder, Link2, Unlink, RefreshCw, HelpCircle, 
  File, FileText, FileImage, FileVideo, FileAudio, ChevronRight,
  ArrowLeft, LogIn
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OneDriveIntegrationProps {
  projectId: string;
  projectName: string;
}

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  isFolder: boolean;
  childCount?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

interface OneDriveTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const TOKENS_STORAGE_KEY = 'onedrive_tokens';

const OneDriveIntegration: React.FC<OneDriveIntegrationProps> = ({ projectId, projectName }) => {
  const { tenant } = useTenant();
  const [config, setConfig] = useState<ProjectOneDriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderUrl, setFolderUrl] = useState('');
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [tenantClientId, setTenantClientId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch tenant-specific Microsoft Client ID
  useEffect(() => {
    if (!tenant?.id) return;
    const fetchClientId = async () => {
      const { data } = await supabase
        .from('tenant_onedrive_settings' as any)
        .select('microsoft_client_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (data) {
        setTenantClientId((data as any).microsoft_client_id);
      }
    };
    fetchClientId();
  }, [tenant?.id]);

  // Check for stored tokens
  useEffect(() => {
    const tokens = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (tokens) {
      const parsed = JSON.parse(tokens) as OneDriveTokens;
      if (parsed.expires_at > Date.now()) {
        setIsAuthenticated(true);
      } else {
        // Try to refresh token
        refreshAccessToken(parsed.refresh_token);
      }
    }
  }, []);

  function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generatePKCE() {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(random.buffer as ArrayBuffer);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  const codeChallenge = base64UrlEncode(digest);

  return { codeVerifier, codeChallenge };
}

  // Check if tokens were set by the callback page
  useEffect(() => {
    const tokens = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (tokens) {
      const parsed = JSON.parse(tokens) as OneDriveTokens;
      if (parsed.expires_at > Date.now()) {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const refreshAccessToken = async (refreshToken: string) => {
    try {
const { data, error } = await supabase.functions.invoke(
  'onedrive-auth?action=refresh-token',
  {
    body: { refreshToken, clientId: tenantClientId },
  }
);

      if (error) throw error;

      const tokens: OneDriveTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };

      localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Token refresh error:', error);
      localStorage.removeItem(TOKENS_STORAGE_KEY);
      setIsAuthenticated(false);
    }
  };

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const stored = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (!stored) return null;

    const tokens = JSON.parse(stored) as OneDriveTokens;
    
    // Refresh if expires in less than 5 minutes
    if (tokens.expires_at < Date.now() + 300000) {
      await refreshAccessToken(tokens.refresh_token);
      const refreshed = localStorage.getItem(TOKENS_STORAGE_KEY);
      if (!refreshed) return null;
      return JSON.parse(refreshed).access_token;
    }

    return tokens.access_token;
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configData = await oneDriveService.getProjectOneDriveConfig(projectId);
      setConfig(configData);
      if (configData && isAuthenticated) {
        loadFiles(configData.folder_id, configData.drive_id);
      }
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

  useEffect(() => {
    loadConfig();
  }, [projectId, isAuthenticated]);

  const loadFiles = async (folderId?: string, driveId?: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setFilesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('onedrive-files', {
        body: { 
          accessToken, 
          folderId: folderId || currentFolderId || config?.folder_id,
          driveId: driveId || config?.drive_id
        },
      });

      if (error) throw error;
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: 'Fout',
        description: 'Laden van bestanden mislukt',
        variant: 'destructive',
      });
    } finally {
      setFilesLoading(false);
    }
  };

  const handleAuthenticate = async () => {
  try {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('onedrive_oauth_state', state);

    // ✅ Generate PKCE
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // ✅ Store verifier for later
    sessionStorage.setItem('onedrive_code_verifier', codeVerifier);

    // ✅ Save current path to return after callback
    sessionStorage.setItem('onedrive_return_path', window.location.pathname + window.location.search);

    // ✅ Use fixed redirect URI
    const redirectUri = `${window.location.origin}/onedrive-callback`;

    // ✅ Store client ID for callback page
    if (tenantClientId) {
      sessionStorage.setItem('onedrive_client_id', tenantClientId);
    }

    const { data, error } = await supabase.functions.invoke(
      'onedrive-auth?action=get-auth-url',
      {
        body: { redirectUri, state, codeChallenge, clientId: tenantClientId },
      }
    );

    if (error) throw error;

    window.location.href = data.authUrl;
  } catch (error) {
    console.error('Auth error:', error);
    toast({
      title: 'Fout',
      description: 'Kon niet verbinden met Microsoft',
      variant: 'destructive',
    });
  }
};
  const handleLogout = () => {
    localStorage.removeItem(TOKENS_STORAGE_KEY);
    setIsAuthenticated(false);
    setFiles([]);
  };

  const navigateToFolder = (folder: OneDriveFile) => {
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    loadFiles(folder.id);
  };

  const navigateBack = () => {
    const newStack = [...folderStack];
    newStack.pop();
    setFolderStack(newStack);
    
    const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : config?.folder_id;
    setCurrentFolderId(parentId || null);
    loadFiles(parentId);
  };

  const extractOneDriveInfo = (url: string): { folderId: string; driveId?: string } | null => {
    try {
      const urlObj = new URL(url);
      const idParam = urlObj.searchParams.get('id');
      if (idParam) {
        return { folderId: idParam };
      }
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.length > 5) {
        return { folderId: lastPart };
      }
      if (urlObj.hostname === '1drv.ms') {
        return { folderId: urlObj.pathname.replace(/\//g, '_') };
      }
      return { folderId: 'root' };
    } catch {
      return null;
    }
  };

  const handleConnect = async () => {
    if (!folderUrl.trim()) {
      toast({
        title: 'Fout',
        description: 'Voer een geldige OneDrive URL in',
        variant: 'destructive'
      });
      return;
    }

    try {
      new URL(folderUrl);
    } catch {
      toast({
        title: 'Fout',
        description: 'Voer een geldige URL in',
        variant: 'destructive'
      });
      return;
    }

    const info = extractOneDriveInfo(folderUrl);
    if (!info) {
      toast({
        title: 'Fout',
        description: 'Kon OneDrive map informatie niet herkennen uit de URL',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const displayName = folderName.trim() || `Project - ${projectName}`;
      
      await oneDriveService.connectProjectToOneDrive(projectId, {
        folder_id: info.folderId,
        folder_name: displayName,
        folder_url: folderUrl.trim(),
        drive_id: info.driveId
      });

      await loadConfig();
      setDialogOpen(false);
      setFolderUrl('');
      setFolderName('');
      
      toast({
        title: 'Succes',
        description: 'OneDrive map succesvol gekoppeld',
      });
    } catch (error) {
      console.error('Error connecting OneDrive:', error);
      toast({
        title: 'Fout',
        description: 'Koppelen van OneDrive map mislukt',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await oneDriveService.disconnectProjectFromOneDrive(projectId);
      setConfig(null);
      setFiles([]);
      setFolderStack([]);
      setCurrentFolderId(null);
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

  const getFileIcon = (file: OneDriveFile) => {
    if (file.isFolder) return <Folder className="h-5 w-5 text-yellow-500" />;
    if (file.mimeType?.startsWith('image/')) return <FileImage className="h-5 w-5 text-green-500" />;
    if (file.mimeType?.startsWith('video/')) return <FileVideo className="h-5 w-5 text-purple-500" />;
    if (file.mimeType?.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-pink-500" />;
    if (file.mimeType?.includes('pdf') || file.mimeType?.includes('document')) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
            <Folder className="h-4 w-4 sm:h-5 sm:w-5" />
            OneDrive Integratie
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="px-3 sm:px-6 py-2.5 sm:py-4 pb-1.5 sm:pb-2">
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2 text-sm sm:text-lg">
              <Folder className="h-4 w-4 sm:h-5 sm:w-5" />
              OneDrive
            </div>
            <div className="flex items-center gap-1">
              {isAuthenticated && config && (
                <Button variant="ghost" size="sm" onClick={() => loadFiles()} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
          {!isAuthenticated ? (
            <div className="space-y-4">
              <div className="p-3 sm:p-4 border rounded-lg bg-muted/30 text-center">
                <LogIn className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Log in met je Microsoft account om OneDrive bestanden te bekijken.
                </p>
                <Button onClick={handleAuthenticate} className="h-8 sm:h-9 text-xs sm:text-sm">
                  <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Inloggen met Microsoft
                </Button>
              </div>
              
              <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-7 sm:h-8 text-xs sm:text-sm">
                    <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Setup instructies
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                   <div className="bg-muted p-3 sm:p-4 rounded-lg text-xs sm:text-sm space-y-2">
                    <p className="font-medium">Om OneDrive te gebruiken:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] sm:text-sm">
                      <li>Registreer een Azure AD app (gratis)</li>
                      <li>Configureer MICROSOFT_CLIENT_ID en MICROSOFT_CLIENT_SECRET</li>
                      <li>Log in met je Microsoft account</li>
                      <li>Koppel een OneDrive map aan dit project</li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : config ? (
            <div className="space-y-4">
              {/* Folder header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  {folderStack.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={navigateBack} className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0">
                      <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  )}
                  <span className="font-medium text-xs sm:text-base truncate">
                    {folderStack.length > 0 
                      ? folderStack[folderStack.length - 1].name 
                      : config.folder_name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => window.open(config.folder_url, '_blank')}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleDisconnect}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Unlink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              {/* Files list */}
              <ScrollArea className="h-[250px] sm:h-[300px] border rounded-lg">
                {filesLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Folder className="h-10 w-10 sm:h-12 sm:w-12 mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">Geen bestanden gevonden</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-2.5 sm:p-3 hover:bg-muted/50 active:bg-muted/70 ${
                          file.isFolder ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => file.isFolder && navigateToFolder(file)}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          {getFileIcon(file)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">{file.name}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {file.isFolder 
                                ? `${file.childCount || 0} items` 
                                : formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          {!file.isFolder && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.webUrl, '_blank');
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          )}
                          {file.isFolder && (
                            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Status */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-[10px] sm:text-xs">
                  Verbonden
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[10px] sm:text-xs h-7 sm:h-8">
                  Uitloggen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">OneDrive Map Koppelen</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Koppel een OneDrive map aan dit project om bestanden te bekijken.
                </p>
              </div>
              
              <Button 
                onClick={() => setDialogOpen(true)} 
                className="flex items-center gap-2"
              >
                <Link2 className="h-4 w-4" />
                OneDrive Map Koppelen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OneDrive Map Koppelen</DialogTitle>
            <DialogDescription>
              Plak de OneDrive URL van de map die je wilt koppelen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderUrl">OneDrive URL *</Label>
              <Input
                id="folderUrl"
                placeholder="https://onedrive.live.com/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="folderName">Map naam (optioneel)</Label>
              <Input
                id="folderName"
                placeholder={`Project - ${projectName}`}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleConnect} disabled={saving || !folderUrl.trim()}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Koppelen...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Koppelen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OneDriveIntegration;
