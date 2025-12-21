import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, File, FileText, FileImage, FileVideo, FileAudio, AudioLines } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import PDFViewerEditor from '@/components/PDFViewerEditor';

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

  React.useEffect(() => {
    if (isOpen) {
      loadFile();
    }
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
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

      if (downloadError) throw downloadError;
      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
    } catch (error: any) {
      console.error('Error loading file preview:', error);
      setError(`Failed to load preview: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getMimeType = () => {
    if (fileType) return fileType;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
      'pdf': 'application/pdf', 'mp4': 'video/mp4', 'webm': 'video/webm',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'txt': 'text/plain',
      'csv': 'text/csv', 'html': 'text/html', 'json': 'application/json',
    };
    return mimeMap[ext] || 'application/octet-stream';
  };

  const getFileIcon = () => {
    const mimeType = getMimeType();
    if (mimeType.startsWith('image/')) return <FileImage className="h-6 w-6 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="h-6 w-6 text-red-500" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="h-6 w-6 text-green-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-6 w-6 text-red-500" />;
    return <File className="h-6 w-6 text-muted-foreground" />;
  };

  const isPDF = () => getMimeType() === 'application/pdf';

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
          <File className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No preview available</p>
        </div>
      );
    }
    
    const mimeType = getMimeType();
    
    if (mimeType === 'application/pdf') {
      return (
        <PDFViewerEditor
          pdfUrl={previewUrl}
          projectId={projectId}
          fileName={fileName}
          onSave={() => loadFile()}
          onClose={onClose}
        />
      );
    }
    
    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex justify-center p-4">
          <img src={previewUrl} alt={fileName} className="max-h-[70vh] max-w-full object-contain" />
        </div>
      );
    }
    
    if (mimeType.startsWith('video/')) {
      return (
        <video controls className="w-full max-h-[70vh]">
          <source src={previewUrl} type={mimeType} />
        </video>
      );
    }
    
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center p-4">
          <AudioLines className="h-24 w-24 text-green-500 mb-4" />
          <audio controls className="w-full">
            <source src={previewUrl} type={mimeType} />
          </audio>
        </div>
      );
    }
    
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return <iframe src={previewUrl} className="w-full h-[70vh] border rounded" title={fileName} />;
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {getFileIcon()}
        <p className="mt-4 mb-2">Preview not available</p>
        <a href={previewUrl} download={fileName} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
          Download File
        </a>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon()} {fileName}
          </DialogTitle>
          <DialogDescription>
            {isPDF() ? 'PDF Viewer - Click "Edit PDF" to annotate' : 'File Preview'}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto max-h-[calc(95vh-80px)]">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
