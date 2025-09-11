import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureStorageBucket } from '@/integrations/supabase/createBucket';
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
import { Trash2, FileUp, File, Download, AlertCircle, Upload, Eye, ExternalLink } from 'lucide-react';
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

      // Create a download link and trigger it
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
      
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .createSignedUrl(filePath, 60); // URL valid for 60 seconds

      if (error) {
        throw error;
      }

      if (data?.signedUrl) {
        // Open the signed URL in a new tab
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
    <div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Project Files</CardTitle>
          <CardDescription>
            Manage files associated with this project
          </CardDescription>
        </CardHeader>
        <CardContent 
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative ${isDragging ? 'border-2 border-dashed border-primary bg-primary/5' : ''}`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10">
              <div className="text-center">
                <FileUp className="mx-auto h-12 w-12 text-primary mb-2" />
                <p className="text-lg font-medium text-primary">Drop files here to upload</p>
              </div>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
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
              className="w-full"
            >
              {uploading ? (
                <div className="flex items-center justify-center w-full">
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload Files
                </>
              )}
            </Button>
            
            {uploading && (
              <div className="mt-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center mt-1 text-muted-foreground">
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
            <div className="space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between border p-3 rounded-md"
                >
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
                      onClick={() => handlePreviewFile(file.name)}
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-red-600 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setFileToDelete(file.name)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
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
