import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { FileText, Download, Loader2, Image, File, FolderOpen } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProjectDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { mimetype?: string; size?: number };
}

const ProjectDocumentsDialog: React.FC<ProjectDocumentsDialogProps> = ({
  open, onOpenChange, projectId, projectName
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [yardPhotos, setYardPhotos] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadFiles();
  }, [open, projectId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      // Load main project files
      const { data: mainFiles } = await supabase.storage
        .from('project_files')
        .list(projectId, { sortBy: { column: 'name', order: 'asc' } });
      
      setFiles((mainFiles || []).filter(f => !f.name.endsWith('/') && f.name !== '.folder') as StorageFile[]);

      // Load yard photos
      const { data: yardFiles } = await supabase.storage
        .from('project_files')
        .list(`yard-photos/${projectId}`, { sortBy: { column: 'name', order: 'desc' } });

      setYardPhotos((yardFiles || []).filter(f => !f.name.endsWith('/') && f.name !== '.folder') as StorageFile[]);
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (path: string) => {
    try {
      const { data } = await supabase.storage
        .from('project_files')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image className="h-4 w-4 text-primary" />;
    if (['pdf'].includes(ext || '')) return <FileText className="h-4 w-4 text-destructive" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto' : 'max-w-lg max-h-[80vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" /> {t('inst_documents')} — {projectName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            {/* Main project files */}
            {files.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">{t('inst_project_files')}</h4>
                <div className="space-y-1">
                  {files.map(file => (
                    <button
                      key={file.id}
                      onClick={() => openFile(`${projectId}/${file.name}`)}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      {getFileIcon(file.name)}
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Yard photos */}
            {yardPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-1.5">
                  📸 {t('inst_yard_photos')}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {yardPhotos.map(photo => (
                    <YardPhotoThumbnail
                      key={photo.id}
                      filePath={`yard-photos/${projectId}/${photo.name}`}
                      onClick={() => openFile(`yard-photos/${projectId}/${photo.name}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {files.length === 0 && yardPhotos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t('inst_no_documents')}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const YardPhotoThumbnail: React.FC<{ filePath: string; onClick: () => void }> = ({ filePath, onClick }) => {
  const signedUrl = useSignedUrl('project_files', filePath);
  return (
    <button onClick={onClick} className="rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary/30 transition-all">
      {signedUrl ? (
        <img src={signedUrl} alt="" className="w-full h-20 object-cover" />
      ) : (
        <div className="w-full h-20 bg-muted flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )}
    </button>
  );
};

export default ProjectDocumentsDialog;
