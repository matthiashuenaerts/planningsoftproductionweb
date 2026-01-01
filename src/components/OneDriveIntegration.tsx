
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { oneDriveService, ProjectOneDriveConfig } from '@/services/oneDriveService';
import { ExternalLink, Folder, Link2, Unlink, RefreshCw, HelpCircle, Maximize2, Minimize2 } from 'lucide-react';
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

interface OneDriveIntegrationProps {
  projectId: string;
  projectName: string;
}

const OneDriveIntegration: React.FC<OneDriveIntegrationProps> = ({ projectId, projectName }) => {
  const [config, setConfig] = useState<ProjectOneDriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderUrl, setFolderUrl] = useState('');
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

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
        title: 'Fout',
        description: 'Laden van OneDrive configuratie mislukt',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Convert share URL to embed URL
  const getEmbedUrl = (shareUrl: string): string => {
    try {
      const url = new URL(shareUrl);
      
      // For 1drv.ms short links, we need to use a different approach
      // OneDrive embed works by adding embed parameter
      if (url.hostname === '1drv.ms') {
        // Short links can be embedded by changing the domain
        return shareUrl.replace('1drv.ms', 'onedrive.live.com/embed');
      }
      
      // For onedrive.live.com links
      if (url.hostname.includes('onedrive.live.com')) {
        // Add embed to the path if not already there
        if (!url.pathname.includes('/embed')) {
          return shareUrl.replace('onedrive.live.com', 'onedrive.live.com/embed');
        }
        return shareUrl;
      }
      
      // For SharePoint/OneDrive Business links
      if (url.hostname.includes('sharepoint.com')) {
        // SharePoint embed format
        const embedUrl = new URL(shareUrl);
        embedUrl.searchParams.set('action', 'embedview');
        return embedUrl.toString();
      }
      
      // Default: try to use as-is with embed parameter
      const embedUrl = new URL(shareUrl);
      embedUrl.searchParams.set('embed', '1');
      return embedUrl.toString();
    } catch {
      return shareUrl;
    }
  };

  const extractOneDriveInfo = (url: string): { folderId: string; driveId?: string } | null => {
    try {
      const urlObj = new URL(url);
      
      // Check for id parameter
      const idParam = urlObj.searchParams.get('id');
      if (idParam) {
        return { folderId: idParam };
      }
      
      // For SharePoint/OneDrive business URLs
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.length > 5) {
        return { folderId: lastPart };
      }
      
      // For 1drv.ms short links
      if (urlObj.hostname === '1drv.ms') {
        return { folderId: urlObj.pathname.replace(/\//g, '_') };
      }
      
      return { folderId: 'linked_folder' };
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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={expanded ? 'fixed inset-4 z-50 overflow-hidden' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              OneDrive - {config?.folder_name || 'Niet gekoppeld'}
            </div>
            <div className="flex items-center gap-1">
              {config && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleOpenFolder} title="Open in nieuw tabblad">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={loadConfig}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className={`space-y-4 ${expanded ? 'h-[calc(100%-4rem)] overflow-hidden' : ''}`}>
          {config ? (
            <div className={`space-y-4 ${expanded ? 'h-full flex flex-col' : ''}`}>
              {/* Embedded OneDrive Folder */}
              <div className={`border rounded-lg overflow-hidden bg-background ${expanded ? 'flex-1' : 'h-[400px]'}`}>
                <iframe
                  src={getEmbedUrl(config.folder_url)}
                  className="w-full h-full border-0"
                  title={`OneDrive - ${config.folder_name}`}
                  allow="fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
              
              {/* Controls */}
              {!expanded && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Verbonden
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Gekoppeld op {new Date(config.created_at).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    Loskoppelen
                  </Button>
                </div>
              )}
              
              {expanded && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Verbonden
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    Loskoppelen
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">OneDrive Map Koppelen</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Koppel een OneDrive map aan dit project door de deellink te plakken. 
                  De inhoud van de map wordt hier getoond.
                </p>
              </div>
              
              <Button 
                onClick={() => setDialogOpen(true)} 
                className="flex items-center gap-2"
              >
                <Link2 className="h-4 w-4" />
                OneDrive Map Koppelen
              </Button>

              <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Hoe werkt dit?
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                    <p className="font-medium">Stappen om een OneDrive map te koppelen:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open OneDrive in je browser</li>
                      <li>Maak of selecteer een map voor dit project</li>
                      <li>Klik rechts op de map → "Delen"</li>
                      <li>Zorg dat "Iedereen met de link" is geselecteerd</li>
                      <li>Klik op "Koppeling kopiëren"</li>
                      <li>Plak de link hier</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-2">
                      Tip: De map moet gedeeld zijn zodat de inhoud hier getoond kan worden.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backdrop for expanded mode */}
      {expanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-40" 
          onClick={() => setExpanded(false)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OneDrive Map Koppelen</DialogTitle>
            <DialogDescription>
              Plak de OneDrive deellink van de map die je wilt koppelen aan dit project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderUrl">OneDrive URL *</Label>
              <Input
                id="folderUrl"
                placeholder="https://1drv.ms/f/... of https://onedrive.live.com/..."
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
              <p className="text-xs text-muted-foreground">
                Laat leeg om automatisch de projectnaam te gebruiken
              </p>
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
