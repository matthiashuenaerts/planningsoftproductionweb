
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Camera } from 'lucide-react';
import { orderService } from '@/services/orderService';

interface OrderAttachmentUploaderProps {
  orderId: string;
  onUploadSuccess: () => void;
  compact?: boolean;
}

const OrderAttachmentUploader: React.FC<OrderAttachmentUploaderProps> = ({ 
  orderId, 
  onUploadSuccess,
  compact = false
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        await orderService.uploadOrderAttachment(orderId, files[i]);
      }

      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
      
      // Clear the input
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
      // Notify parent component
      onUploadSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to upload: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  // Compact version for smaller UI spaces
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={triggerFileSelect}
          disabled={uploading}
          className="h-8 w-8"
          title="Add file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={triggerCamera}
          disabled={uploading}
          className="h-8 w-8"
          title="Take photo"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        capture="environment"
      />
      <Button 
        variant="outline" 
        size="sm" 
        onClick={triggerFileSelect}
        disabled={uploading}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        {uploading ? "Uploading..." : "Add File"}
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={triggerCamera}
        disabled={uploading}
      >
        <Camera className="mr-2 h-4 w-4" />
        Take Photo
      </Button>
    </div>
  );
};

export default OrderAttachmentUploader;
