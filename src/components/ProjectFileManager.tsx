import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureStorageBucket } from '@/integrations/supabase/createBucket';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Trash2, FileUp, File, Download, AlertCircle, Upload, Eye, ExternalLink, FolderOpen, Image, Loader2 as Loader2Icon, Camera } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import FilePreview from '@/components/FilePreview';
import { generateAnnotatedPdf } from '@/services/pdfAnnotationExportService';

interface ProjectFileManagerProps {
  projectId: string;
}

// Interface to match Supabase response structure
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

// Yard Photos Folder component - shows yard photos in a virtual folder UI
const YardPhotoThumbnail: React.FC<{ filePath: string; onClick: () => void }> = ({ filePath, onClick }) => {
  const signedUrl = useSignedUrl('project_files', filePath);
  return (
    <button onClick={onClick} className="rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary/30 transition-all">
      {signedUrl ? (
        <img src={signedUrl} alt="" className="w-full h-24 object-cover" />
      ) : (
        <div className="w-full h-24 bg-muted flex items-center justify-center">
          <Loader2Icon className="h-3 w-3 animate-spin" />
        </div>
      )}
    </button>
  );
};

const YardPhotosFolder: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage
        .from('project_files')
        .list(`yard-photos/${projectId}`, { sortBy: { column: 'name', order: 'desc' } });
      setPhotos((data || []).filter(f => !f.name.endsWith('/') && f.name !== '.folder').map(f => ({ id: f.id, name: f.name })));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (expanded) loadPhotos();
  }, [expanded, loadPhotos]);

  const openPhoto = async (name: string) => {
    const { data } = await supabase.storage
      .from('project_files')
      .createSignedUrl(`yard-photos/${projectId}/${name}`, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <Card className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs sm:text-sm">📸 {t('inst_yard_photos')}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {photos.length > 0 ? `${photos.length} foto's` : t('inst_no_documents')}
          </p>
        </div>
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      </button>
      {expanded && (
        <CardContent className="pt-0 px-3 sm:px-6 pb-4">
          {loading ? (
            <div className="py-4 text-center"><Loader2Icon className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map(photo => (
                <YardPhotoThumbnail
                  key={photo.id}
                  filePath={`yard-photos/${projectId}/${photo.name}`}
                  onClick={() => openPhoto(photo.name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('inst_no_documents')}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

const ProjectFileManager: React.FC<ProjectFileManagerProps> = ({ projectId }) => {
  const { toast } = useToast();
  const { currentEmployee, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bucketInitialized, setBucketInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated || !currentEmployee) {
      console.log("User not authenticated, redirecting to login");
      toast({
        title: "Authentication required",
        description: "You must be logged in to manage files",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }
    
    // Initialize bucket and fetch files
    initializeAndFetchFiles();
  }, [projectId, currentEmployee, isAuthenticated, navigate]);

  const initializeAndFetchFiles = async () => {
    if (!isAuthenticated || !currentEmployee) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First ensure the storage bucket exists with proper permissions
      console.log("Initializing storage bucket...");
      const bucketResult = await ensureStorageBucket('project_files');
      
      if (!bucketResult.success) {
        console.error("Failed to ensure storage bucket:", bucketResult.error);
        setError(`Storage initialization error: ${bucketResult.error?.message || 'Unknown error'}`);
        toast({
          title: "Storage initialization failed",
          description: "There was a problem setting up file storage. Please try again later.",
          variant: "destructive"
        });
      } else {
        console.log("Storage bucket initialized successfully:", bucketResult.data);
        setBucketInitialized(true);
        await fetchFiles();
      }
    } catch (error: any) {
      console.error("Error in initialization:", error);
      setError(`Initialization error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    if (!isAuthenticated || !currentEmployee) return;
    
    setError(null);
    try {
      console.log("Fetching files from bucket 'project_files' in folder:", projectId);
      
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .list(projectId, {
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        // If the error is because the folder doesn't exist yet, we can safely ignore it
        if (error.message.includes('The resource was not found')) {
          console.log("Project folder doesn't exist yet, will be created on first upload");
          setFiles([]);
        } else {
          console.error("Error fetching files:", error);
          throw error;
        }
      } else {
        // Filter out folders and format file data
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
        
        console.log("Files fetched:", fileObjects.length);
        setFiles(fileObjects);
      }
    } catch (error: any) {
      console.error('Error fetching files:', error);
      setError(`Failed to fetch files: ${error.message}`);
      toast({
        title: "Error",
        description: `Failed to load files: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleUploadClick = () => {
    if (!isAuthenticated || !currentEmployee) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to upload files",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }
    
    if (!bucketInitialized) {
      toast({
        title: "Storage not ready",
        description: "File storage is being initialized. Please try again in a moment.",
        variant: "destructive"
      });
      // Try to initialize bucket again
      initializeAndFetchFiles();
      return;
    }
    
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (!isAuthenticated || !currentEmployee) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      console.log("Starting file uploads for project:", projectId);
      console.log("Current user:", currentEmployee);
      
      // First, ensure bucket is initialized
      if (!bucketInitialized) {
        console.log("Bucket not initialized yet, initializing first...");
        const result = await ensureStorageBucket('project_files');
        if (!result.success) {
          throw new Error(`Failed to initialize storage: ${result.error?.message}`);
        }
        setBucketInitialized(true);
      }
      
      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${projectId}/${fileName}`;
        
        console.log(`Uploading ${i+1}/${selectedFiles.length}: ${fileName}`);
        
        // Update progress
        setUploadProgress(Math.round((i / selectedFiles.length) * 100));
        
        const { error: uploadError } = await supabase
          .storage
          .from('project_files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error(`Error uploading file ${fileName}:`, uploadError);
          throw uploadError;
        }
      }
      
      setUploadProgress(100);
      
      toast({
        title: "Success",
        description: `${selectedFiles.length} file(s) uploaded successfully`,
      });
      
      // Refresh file list
      await fetchFiles(); 
    } catch (error: any) {
      console.error('Error uploading files:', error);
      
      let errorMessage = error.message;
      
      // Check for specific RLS policy error
      if (error.message?.includes('row-level security policy') || 
          error.message?.includes('Permission denied')) {
        errorMessage = 'Permission denied: You may need to log out and log back in to refresh your credentials.';
        
        // Try to refresh the bucket policies
        try {
          await ensureStorageBucket('project_files');
          setBucketInitialized(true);
        } catch (e) {
          console.error("Error refreshing bucket policies:", e);
        }
        
        toast({
          title: "Authentication issue",
          description: "Your session may have expired. Please log out and log back in.",
          variant: "destructive"
        });
      }
      
      setError(`Failed to upload: ${errorMessage}`);
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete || !isAuthenticated || !currentEmployee) return;
    
    try {
      const filePath = `${projectId}/${fileToDelete}`;
      
      const { error } = await supabase
        .storage
        .from('project_files')
        .remove([filePath]);

      if (error) {
        throw error;
      }

      setFiles(prevFiles => prevFiles.filter(file => file.name !== fileToDelete));
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: `Failed to delete file: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setFileToDelete(null);
    }
  };

  const downloadFile = async (fileName: string) => {
    setError(null);
    try {
      const filePath = `${projectId}/${fileName}`;
      
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .download(filePath);

      if (error) {
        throw error;
      }

      let blob: Blob = data;

      // For PDF files, overlay annotations if they exist
      if (fileName.toLowerCase().endsWith('.pdf')) {
        const rawBytes = await data.arrayBuffer();
        const annotatedBytes = await generateAnnotatedPdf(projectId, fileName, rawBytes);
        if (annotatedBytes) {
          blob = new Blob([annotatedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      setError(`Failed to download: ${error.message}`);
      toast({
        title: "Error",
        description: `Failed to download file: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const openFile = async (fileName: string) => {
    setError(null);
    try {
      const filePath = `${projectId}/${fileName}`;

      // For PDF files, generate annotated version and open as blob URL
      if (fileName.toLowerCase().endsWith('.pdf')) {
        const { data: blobData, error: dlError } = await supabase
          .storage
          .from('project_files')
          .download(filePath);
        if (dlError) throw dlError;

        const rawBytes = await blobData.arrayBuffer();
        const annotatedBytes = await generateAnnotatedPdf(projectId, fileName, rawBytes);
        const finalBlob = annotatedBytes
          ? new Blob([annotatedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
          : blobData;
        const url = URL.createObjectURL(finalBlob);
        window.open(url, '_blank');
        // Revoke after a delay so the tab can load
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }

      // Non-PDF: use signed URL
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening file:', error);
      setError(`Failed to open file: ${error.message}`);
      toast({
        title: "Error",
        description: `Failed to open file: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handlePreviewFile = (fileName: string) => {
    setPreviewFileName(fileName);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set isDragging to false if we're leaving the entire card area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isAuthenticated || !currentEmployee) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to upload files",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    // Use the same upload logic as file input
    const fileList = droppedFiles as unknown as FileList;
    const fakeEvent = {
      target: { files: fileList }
    } as React.ChangeEvent<HTMLInputElement>;
    
    await handleFileChange(fakeEvent);
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  // Show a message if not authenticated
  if (!isAuthenticated || !currentEmployee) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Project Files</CardTitle>
          <CardDescription>
            Authentication Required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              You must be logged in to manage project files.
            </AlertDescription>
          </Alert>
          <Button 
            className="w-full mt-4"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Yard Photos Folder */}
      <YardPhotosFolder projectId={projectId} />

      <Card className="w-full">
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
          <CardTitle className="text-sm sm:text-lg">Project Files</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Manage files associated with this project
          </CardDescription>
        </CardHeader>
        <CardContent 
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative px-3 sm:px-6 ${isDragging ? 'border-2 border-dashed border-primary bg-primary/5' : ''}`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10">
              <div className="text-center">
                <FileUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-primary mb-2" />
                <p className="text-sm sm:text-lg font-medium text-primary">Drop files here</p>
              </div>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="mb-4">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="*/*"
            />
            <Button
              onClick={handleUploadClick}
              disabled={uploading}
              className="w-full h-9 sm:h-10 text-xs sm:text-sm"
            >
              {uploading ? (
                <div className="flex items-center justify-center w-full">
                  <Upload className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <FileUp className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Upload Files
                </>
              )}
            </Button>
            
            {uploading && (
              <div className="mt-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-[10px] sm:text-xs text-center mt-1 text-muted-foreground">
                  {uploadProgress}% complete
                </p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="group border border-border/60 rounded-lg sm:rounded-xl p-2.5 sm:p-4 bg-card/50 hover:bg-accent/30 hover:border-primary/30 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* File icon */}
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <File className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    {/* File info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-base truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    {/* Desktop actions */}
                    <div className="hidden sm:flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handlePreviewFile(file.name)} title="Preview" className="h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openFile(file.name)} title="Open" className="h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadFile(file.name)} title="Download" className="h-8 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30" onClick={() => setFileToDelete(file.name)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Mobile actions row */}
                  <div className="flex sm:hidden gap-1.5 mt-2 ml-[42px]">
                    <Button variant="outline" size="sm" onClick={() => handlePreviewFile(file.name)} className="h-7 flex-1 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary">
                      <Eye className="h-3 w-3" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openFile(file.name)} className="h-7 flex-1 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary">
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadFile(file.name)} className="h-7 flex-1 text-[10px] gap-1 hover:bg-green-500/10 hover:text-green-600">
                      <Download className="h-3 w-3" /> Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setFileToDelete(file.name)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No files uploaded yet
            </div>
          )}
        </CardContent>
        {!bucketInitialized && (
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={initializeAndFetchFiles}
            >
              Retry Storage Initialization
            </Button>
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file "{fileToDelete}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteFile}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Preview Dialog */}
      {previewFileName && (
        <FilePreview
          isOpen={!!previewFileName}
          onClose={() => setPreviewFileName(null)}
          projectId={projectId}
          fileName={previewFileName}
        />
      )}
    </div>
  );
};

export default ProjectFileManager;
