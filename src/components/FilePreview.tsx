import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, File, FileText, Image, FileImage, FileVideo, Video, FileAudio, AudioLines, Edit } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import EnhancedPDFEditor from '@/components/EnhancedPDFEditor';

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  fileName: string;
  fileType?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({ 
  isOpen,
  onClose,
  projectId,
  fileName,
  fileType
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Load the file when the dialog opens
  React.useEffect(() => {
    if (isOpen) {
      loadFile();
    }
    
    // Cleanup on close
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setEditMode(false);
    };
  }, [isOpen, projectId, fileName]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filePath = `${projectId}/${fileName}`;
      
      const { data, error: downloadError } = await supabase
        .storage
        .from('project_files')
        .download(filePath);

      if (downloadError) {
        throw downloadError;
      }

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
    } catch (error: any) {
      console.error('Error loading file preview:', error);
      setError(`Failed to load preview: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get the mime type based on file name or provided file type
  const getMimeType = () => {
    if (fileType) return fileType;
    
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Map extensions to mime types
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'html': 'text/html',
      'json': 'application/json',
    };
    
    return mimeMap[ext] || 'application/octet-stream';
  };

  // Get appropriate icon for the file type
  const getFileIcon = () => {
    const mimeType = getMimeType();
    
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-16 w-16 text-blue-500" />;
    } else if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-16 w-16 text-red-500" />;
    } else if (mimeType.startsWith('audio/')) {
      return <FileAudio className="h-16 w-16 text-green-500" />;
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return <FileText className="h-16 w-16 text-yellow-500" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-16 w-16 text-red-500" />;
    } else {
      return <File className="h-16 w-16 text-gray-500" />;
    }
  };

  const isPDF = () => {
    return getMimeType() === 'application/pdf';
  };

  // Render the preview based on file type
  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      );
    }
    
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    
    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <File className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-muted-foreground">No preview available</p>
        </div>
      );
    }
    
    const mimeType = getMimeType();
    
    // PDF preview with enhanced edit mode
    if (mimeType === 'application/pdf') {
      if (editMode) {
        return (
          <EnhancedPDFEditor
            pdfUrl={previewUrl}
            projectId={projectId}
            fileName={fileName}
            onSave={() => {
              // Optionally show a success message
            }}
          />
        );
      } else {
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Button
                onClick={() => setEditMode(true)}
                className="mb-4"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit PDF
              </Button>
            </div>
            <iframe 
              src={previewUrl} 
              className="w-full h-[70vh]" 
              title={fileName}
            />
          </div>
        );
      }
    }
    
    // Image preview
    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex justify-center">
          <img 
            src={previewUrl} 
            alt={fileName} 
            className="max-h-[70vh] max-w-full object-contain"
          />
        </div>
      );
    }
    
    // Video preview
    if (mimeType.startsWith('video/')) {
      return (
        <video 
          controls 
          className="w-full max-h-[70vh]"
        >
          <source src={previewUrl} type={mimeType} />
          Your browser does not support the video tag.
        </video>
      );
    }
    
    // Audio preview
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center p-4">
          <AudioLines className="h-24 w-24 text-green-500 mb-4" />
          <audio controls className="w-full">
            <source src={previewUrl} type={mimeType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }
    
    // Text preview (including JSON, HTML, etc.)
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return (
        <iframe 
          src={previewUrl} 
          className="w-full h-[70vh] border rounded" 
          title={fileName}
        />
      );
    }
    
    // Default: No preview, show icon and download link
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {getFileIcon()}
        <p className="mt-4 mb-2">Preview not available for this file type</p>
        <p className="text-sm text-muted-foreground mb-4">You can download the file to view its contents</p>
        <a 
          href={previewUrl} 
          download={fileName}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Download File
        </a>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon()} {fileName}
            {isPDF() && !editMode && (
              <Button
                onClick={() => setEditMode(true)}
                size="sm"
                variant="outline"
                className="ml-auto"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {editMode && (
              <Button
                onClick={() => setEditMode(false)}
                size="sm"
                variant="outline"
                className="ml-auto"
              >
                View Only
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {editMode ? 'Enhanced PDF Editor - Draw, add text, and edit annotations' : 'File Preview'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
