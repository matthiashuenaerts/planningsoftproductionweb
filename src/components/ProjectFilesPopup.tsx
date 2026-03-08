
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { File, Download, Eye, ExternalLink, Loader2 } from 'lucide-react';
import FilePreview from '@/components/FilePreview';

interface ProjectFilesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface FileObject {
  id: string;
  name: string;
  size: number;
  created_at: string;
  metadata: {
    mimetype?: string;
    size?: number;
    [key: string]: any;
  };
}

const ProjectFilesPopup: React.FC<ProjectFilesPopupProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName
}) => {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && projectId) {
      fetchFiles();
    }
  }, [isOpen, projectId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .list(projectId, {
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        if (error.message.includes('The resource was not found')) {
          setFiles([]);
        } else {
          throw error;
        }
      } else {
        const fileObjects = data
          ? data
              .filter(item => !item.name.endsWith('/') && item.name !== '.folder')
              .map(item => ({
                id: item.id,
                name: item.name,
                size: item.metadata?.size || 0,
                created_at: item.created_at,
                metadata: item.metadata || {}
              }))
          : [];
        
        setFiles(fileObjects);
      }
    } catch (error: any) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: `Failed to load files: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileName: string) => {
    try {
      const filePath = `${projectId}/${fileName}`;
      
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .download(filePath);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: `Failed to download file: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const openFile = async (fileName: string) => {
    try {
      const filePath = `${projectId}/${fileName}`;
      
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .createSignedUrl(filePath, 60);

      if (error) {
        throw error;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening file:', error);
      toast({
        title: "Error",
        description: `Failed to open file: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[80vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg leading-tight break-words">Project Files - {projectName}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Browse and manage files for this project
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8" />
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-2.5 sm:p-4">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 min-w-0">
                        <File className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm break-all leading-tight">{file.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1 sm:space-x-2 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setPreviewFileName(file.name)}
                          title="Preview"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openFile(file.name)}
                          title="Open"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadFile(file.name)}
                          title="Download"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No files found for this project
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      {previewFileName && (
        <FilePreview
          isOpen={!!previewFileName}
          onClose={() => setPreviewFileName(null)}
          projectId={projectId}
          fileName={previewFileName}
        />
      )}
    </>
  );
};

export default ProjectFilesPopup;
