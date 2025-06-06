
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Files - {projectName}</DialogTitle>
            <DialogDescription>
              Browse and manage files for this project
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8" />
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-3">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <File className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setPreviewFileName(file.name)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openFile(file.name)}
                          title="Open"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadFile(file.name)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
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
