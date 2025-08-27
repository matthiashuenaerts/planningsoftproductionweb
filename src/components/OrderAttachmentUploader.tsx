
import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Camera, Check, X, RotateCcw } from 'lucide-react';
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
  const [cameraStep, setCameraStep] = useState<'none' | 'camera' | 'preview' | 'uploading'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraStep('camera');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImages(prev => [...prev, imageDataUrl]);
    stopCamera();
    setCameraStep('preview');
  };

  const addAnotherPhoto = () => {
    startCamera();
  };

  const removeImage = (index: number) => {
    const newImages = capturedImages.filter((_, i) => i !== index);
    setCapturedImages(newImages);
    if (newImages.length === 0) {
      setCameraStep('none');
    }
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const confirmDeliveryPhotos = async () => {
    if (capturedImages.length === 0) return;

    setCameraStep('uploading');
    setUploading(true);
    
    try {
      // Upload all images with delivery prefix
      for (const image of capturedImages) {
        const response = await fetch(image);
        const blob = await response.blob();
        
        const file = new File([blob], `DELIVERY_CONFIRMED_${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });

        await orderService.uploadOrderAttachment(orderId, file);
      }

      toast({
        title: "Delivery Confirmed!",
        description: `${capturedImages.length} delivery photo(s) uploaded successfully.`,
      });

      // Call the delivery confirmation handler
      onDeliveryConfirm?.();
      handleCameraClose();
      onUploadSuccess();
    } catch (error: any) {
      console.error('Error uploading delivery photos:', error);
      toast({
        title: "Error",
        description: `Failed to upload photos: ${error.message}`,
        variant: "destructive"
      });
      setCameraStep('preview');
    } finally {
      setUploading(false);
    }
  };

  const handleCameraClose = () => {
    stopCamera();
    setCapturedImages([]);
    setCameraStep('none');
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Compact version for smaller UI spaces
  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
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
            onClick={startCamera}
            disabled={uploading}
            className="h-8 w-8"
            title="Take delivery note photo"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
        
        <Dialog open={cameraStep !== 'none'} onOpenChange={handleCameraClose}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Take Delivery Note Photo</DialogTitle>
            </DialogHeader>

            {cameraStep === 'camera' && (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={switchCamera}
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="lg"
                      onClick={captureImage}
                      className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16"
                    >
                      <Camera className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCameraClose}
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {cameraStep === 'preview' && capturedImages.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2 bg-gray-100 rounded-lg">
                  {capturedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Delivery note ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg aspect-square"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  {capturedImages.length} photo(s) captured. Add more or confirm to upload.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={addAnotherPhoto}>
                    <Camera className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                  <Button 
                    onClick={confirmDeliveryPhotos} 
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700" 
                    disabled={capturedImages.length === 0}
                  >
                    <Check className="h-4 w-4" />
                    Upload Photos
                  </Button>
                </div>
              </div>
            )}

            {cameraStep === 'uploading' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600">Uploading delivery photos...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
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
          onClick={startCamera}
          disabled={uploading}
        >
          <Camera className="mr-2 h-4 w-4" />
          Take Photo
        </Button>
      </div>
      
      <Dialog open={cameraStep !== 'none'} onOpenChange={handleCameraClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Take Delivery Note Photo</DialogTitle>
          </DialogHeader>

          {cameraStep === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={switchCamera}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    onClick={captureImage}
                    className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16"
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCameraClose}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {cameraStep === 'preview' && capturedImages.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2 bg-gray-100 rounded-lg">
                {capturedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Delivery note ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg aspect-square"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                {capturedImages.length} photo(s) captured. Add more or confirm to upload.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={addAnotherPhoto}>
                  <Camera className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
                <Button 
                  onClick={confirmDeliveryPhotos} 
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700" 
                  disabled={capturedImages.length === 0}
                >
                  <Check className="h-4 w-4" />
                  Upload Photos
                </Button>
              </div>
            </div>
          )}

          {cameraStep === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600">Uploading delivery photos...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderAttachmentUploader;
