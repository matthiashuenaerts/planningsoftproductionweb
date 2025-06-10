
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Order } from '@/types/order';
import { orderService } from '@/services/orderService';
import { Camera, Check, X, RotateCcw } from 'lucide-react';

interface DeliveryConfirmationModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}

export const DeliveryConfirmationModal: React.FC<DeliveryConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmed,
}) => {
  const [step, setStep] = useState<'confirm' | 'camera' | 'preview' | 'uploading'>('confirm');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

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
      setStep('camera');
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
    setCapturedImage(imageDataUrl);
    stopCamera();
    setStep('preview');
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const confirmDelivery = async () => {
    if (!capturedImage) return;

    setStep('uploading');
    
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Create a file from the blob
      const file = new File([blob], `delivery-note-${order.id}-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });

      // Upload the image as an attachment
      await orderService.uploadOrderAttachment(order.id, file);
      
      // Update order status to delivered
      await orderService.updateOrderStatus(order.id, 'delivered');

      toast({
        title: "Delivery Confirmed",
        description: "Order has been marked as delivered and photo uploaded.",
      });

      onConfirmed();
      handleClose();
    } catch (error: any) {
      console.error('Error confirming delivery:', error);
      toast({
        title: "Error",
        description: `Failed to confirm delivery: ${error.message}`,
        variant: "destructive"
      });
      setStep('preview');
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setStep('confirm');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Delivery</DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium">Order Details</h3>
              <p className="text-sm text-gray-600">Supplier: {order.supplier}</p>
              <p className="text-sm text-gray-600">Project: {order.project_id}</p>
              <p className="text-sm text-gray-600">Expected: {new Date(order.expected_delivery).toLocaleDateString()}</p>
            </div>
            <p className="text-sm text-gray-600">
              Please take a photo of the delivery note to confirm this delivery.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={startCamera} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
            </div>
          </div>
        )}

        {step === 'camera' && (
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
                  onClick={() => {
                    stopCamera();
                    setStep('confirm');
                  }}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === 'preview' && capturedImage && (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured delivery note"
                className="w-full rounded-lg max-h-96 object-contain bg-gray-100"
              />
            </div>
            <p className="text-sm text-gray-600">
              Photo captured successfully. Confirm to mark this order as delivered.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={retakePhoto}>
                Retake Photo
              </Button>
              <Button onClick={confirmDelivery} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" />
                Confirm Delivery
              </Button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-sm text-gray-600">Uploading photo and confirming delivery...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
