
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Camera } from 'lucide-react';
import { orderService } from '@/services/orderService';

interface OrderAttachmentUploaderProps {
  orderId: string;
  onUploadSuccess: () => void;
  compact?: boolean;
  showDeliveryConfirm?: boolean;
  onDeliveryConfirm?: () => void;
}

const OrderAttachmentUploader: React.FC<OrderAttachmentUploaderProps> = ({ 
  orderId, 
  onUploadSuccess,
  compact = false,
  showDeliveryConfirm = false,
  onDeliveryConfirm
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const deliveryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isDeliveryConfirm = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        // Add a prefix to delivery confirmation photos
        const file = files[i];
        if (isDeliveryConfirm) {
          const newFile = new File([file], `DELIVERY_CONFIRMED_${Date.now()}_${file.name}`, {
            type: file.type,
            lastModified: file.lastModified
          });
          await orderService.uploadOrderAttachment(orderId, newFile);
        } else {
          await orderService.uploadOrderAttachment(orderId, file);
        }
      }

      if (isDeliveryConfirm) {
        toast({
          title: "Delivery Confirmed!",
          description: "Delivery note photo uploaded successfully. Order marked as delivered.",
        });
        // Call the delivery confirmation handler
        onDeliveryConfirm?.();
      } else {
        toast({
          title: "Success",
          description: `${files.length} file(s) uploaded successfully`,
        });
      }
      
      // Clear the input
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (deliveryInputRef.current) deliveryInputRef.current.value = '';
      
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

  const triggerDeliveryCamera = () => {
    deliveryInputRef.current?.click();
  };

  // Compact version for smaller UI spaces
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileChange(e, false)}
          className="hidden"
          multiple
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={(e) => handleFileChange(e, false)}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
        {showDeliveryConfirm && (
          <input
            type="file"
            ref={deliveryInputRef}
            onChange={(e) => handleFileChange(e, true)}
            className="hidden"
            accept="image/*"
            capture="environment"
          />
        )}
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
        {showDeliveryConfirm && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={triggerDeliveryCamera}
            disabled={uploading}
            className="h-8 w-8 bg-green-100 hover:bg-green-200 text-green-700"
            title="Confirm delivery with photo"
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e, false)}
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => handleFileChange(e, false)}
        className="hidden"
        accept="image/*"
        capture="environment"
      />
      {showDeliveryConfirm && (
        <input
          type="file"
          ref={deliveryInputRef}
          onChange={(e) => handleFileChange(e, true)}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
      )}
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
      {showDeliveryConfirm && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={triggerDeliveryCamera}
          disabled={uploading}
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <Camera className="mr-2 h-4 w-4" />
          Confirm Delivery
        </Button>
      )}
    </div>
  );
};

export default OrderAttachmentUploader;
