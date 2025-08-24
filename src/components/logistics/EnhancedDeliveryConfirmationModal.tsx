import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, Package, MapPin } from 'lucide-react';
import { Order, OrderItem } from '@/types/order';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface EnhancedDeliveryConfirmationModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}

type DeliveryStep = 'confirm' | 'items' | 'camera' | 'uploading';

interface ItemDelivery {
  itemId: string;
  deliveredQuantity: number;
  stockLocation: string;
}

export const EnhancedDeliveryConfirmationModal: React.FC<EnhancedDeliveryConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmed
}) => {
  const [currentStep, setCurrentStep] = useState<DeliveryStep>('confirm');
  const [itemDeliveries, setItemDeliveries] = useState<ItemDelivery[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Fetch order items
  const { data: orderItems = [], isLoading } = useQuery({
    queryKey: ['order-items', order.id],
    queryFn: () => orderService.getOrderItems(order.id),
    enabled: isOpen
  });

  // Initialize item deliveries when order items are loaded
  useEffect(() => {
    if (orderItems.length > 0 && itemDeliveries.length === 0) {
      setItemDeliveries(
        orderItems.map(item => ({
          itemId: item.id,
          deliveredQuantity: item.delivered_quantity || item.quantity,
          stockLocation: item.stock_location || ''
        }))
      );
    }
  }, [orderItems, itemDeliveries.length]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(console.error);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions and ensure you're using HTTPS.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImages([...capturedImages, imageData]);
      }
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(capturedImages.filter((_, i) => i !== index));
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    // Wait a moment for the camera to fully release
    setTimeout(() => {
      startCamera();
    }, 500);
  };

  const updateItemDelivery = (itemId: string, field: 'deliveredQuantity' | 'stockLocation', value: string | number) => {
    setItemDeliveries(prev => 
      prev.map(item => 
        item.itemId === itemId 
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const confirmDelivery = async () => {
    setCurrentStep('uploading');
    
    try {
      // Upload captured images
      for (const imageData of capturedImages) {
        const blob = await fetch(imageData).then(r => r.blob());
        const file = new File([blob], `delivery-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await orderService.uploadOrderAttachment(order.id, file);
      }

      // Update order with delivery data
      await orderService.confirmDelivery(order.id, { itemDeliveries });

      toast({
        title: "Delivery Confirmed",
        description: "Order delivery has been successfully confirmed.",
      });

      onConfirmed();
      handleClose();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast({
        title: "Error",
        description: "Failed to confirm delivery. Please try again.",
        variant: "destructive"
      });
      setCurrentStep('camera');
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImages([]);
    setCurrentStep('confirm');
    setItemDeliveries([]);
    onClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'partially_delivered': return 'bg-blue-100 text-blue-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const allItemsFullyDelivered = itemDeliveries.every((delivery, index) => {
    const item = orderItems[index];
    return item && delivery.deliveredQuantity >= item.quantity;
  });

  const someItemsDelivered = itemDeliveries.some((delivery) => delivery.deliveredQuantity > 0);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div>Loading order items...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Confirm Delivery - {order.supplier}
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'confirm' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-gray-600">Order ID</Label>
                <div className="text-sm">{order.id}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <Badge className={getStatusColor(order.status)}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Expected Delivery</Label>
                <div className="text-sm">{new Date(order.expected_delivery).toLocaleDateString()}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Order Date</Label>
                <div className="text-sm">{new Date(order.order_date).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setCurrentStep('items')}>
                Continue to Items
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'items' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Delivery Details</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {orderItems.map((item, index) => {
                  const delivery = itemDeliveries[index];
                  if (!delivery) return null;

                  return (
                    <div key={item.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.description}</h4>
                          <p className="text-sm text-gray-600">Article: {item.article_code}</p>
                          <p className="text-sm text-gray-600">Ordered: {item.quantity}</p>
                          {item.delivered_quantity > 0 && (
                            <p className="text-sm text-blue-600">Previously delivered: {item.delivered_quantity}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
                            Delivered Quantity
                          </Label>
                          <Input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={delivery.deliveredQuantity}
                            onChange={(e) => updateItemDelivery(item.id, 'deliveredQuantity', parseInt(e.target.value) || 0)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`location-${item.id}`} className="text-sm font-medium flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Stock Location
                          </Label>
                          <Input
                            id={`location-${item.id}`}
                            type="text"
                            value={delivery.stockLocation}
                            onChange={(e) => updateItemDelivery(item.id, 'stockLocation', e.target.value)}
                            placeholder="e.g., A1-B2, Warehouse 1"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('confirm')}>
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('camera')}
                disabled={!someItemsDelivered}
              >
                Continue to Photo
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'camera' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Take Delivery Photos</h3>
              <p className="text-sm text-gray-600">
                Take photos of the delivery note and delivered items
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover"
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(console.error);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-2" />
                      <p>Camera not started</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2">
                {!stream ? (
                  <Button onClick={startCamera}>
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <>
                    <Button onClick={captureImage}>
                      <Camera className="h-4 w-4 mr-2" />
                      Capture Photo
                    </Button>
                    <Button variant="outline" onClick={switchCamera}>
                      Switch Camera
                    </Button>
                  </>
                )}
              </div>

              {capturedImages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Captured Images ({capturedImages.length})</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {capturedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img src={image} alt={`Captured ${index + 1}`} className="w-full h-20 object-cover rounded border" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('items')}>
                Back
              </Button>
              <Button 
                onClick={confirmDelivery}
                disabled={capturedImages.length === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Confirm Delivery
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'uploading' && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div>
              <h3 className="text-lg font-semibold">Processing Delivery</h3>
              <p className="text-sm text-gray-600">Uploading photos and updating order status...</p>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
};