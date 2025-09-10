import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Upload, X, Package, MapPin, Printer } from 'lucide-react';
import { Order, OrderItem } from '@/types/order';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { LabelPrintDialog } from './LabelPrintDialog';

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
  isFullyDelivered: boolean;
  notDeliveredQuantity: number;
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
  const [showLabelDialog, setShowLabelDialog] = useState(false);
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
        orderItems.map(item => {
          const remainingQuantity = item.quantity - (item.delivered_quantity || 0);
          return {
            itemId: item.id,
            deliveredQuantity: 0, // Default to 0 - user must confirm
            stockLocation: item.stock_location || '',
            isFullyDelivered: false, // Default unchecked
            notDeliveredQuantity: remainingQuantity
          };
        })
      );
    }
  }, [orderItems, itemDeliveries.length]);

  const startCamera = async () => {
    try {
      console.log('Starting camera with facingMode:', facingMode);
      
      // Stop any existing stream first
      stopCamera();
      
      const constraints = {
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      console.log('Requesting camera with constraints:', constraints);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', mediaStream);
      
      setStream(mediaStream);
      
      // Wait a moment then set the video source
      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          console.log('Setting video srcObject');
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded, attempting to play');
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => console.log('Video playing successfully'))
                .catch(error => console.error('Error playing video:', error));
            }
          };
        }
      }, 100);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: `Camera failed: ${error.message}. Please try again.`,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera');
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('Stopping track:', track);
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
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

  const updateItemDelivery = (itemId: string, field: 'deliveredQuantity' | 'stockLocation' | 'isFullyDelivered', value: string | number | boolean) => {
    setItemDeliveries(prev => 
      prev.map(item => {
        if (item.itemId === itemId) {
          if (field === 'isFullyDelivered') {
            const orderItem = orderItems.find(oi => oi.id === itemId);
            const remainingQuantity = orderItem ? orderItem.quantity - (orderItem.delivered_quantity || 0) : 0;
            return {
              ...item,
              isFullyDelivered: value as boolean,
              deliveredQuantity: value ? remainingQuantity : 0,
              notDeliveredQuantity: value ? 0 : remainingQuantity
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
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

      // Transform itemDeliveries to include cumulative delivered quantities
      const deliveryData = {
        itemDeliveries: itemDeliveries.map(delivery => {
          const orderItem = orderItems.find(item => item.id === delivery.itemId);
          const previouslyDelivered = orderItem?.delivered_quantity || 0;
          const totalDelivered = previouslyDelivered + delivery.deliveredQuantity;
          
          return {
            itemId: delivery.itemId,
            deliveredQuantity: totalDelivered, // Total cumulative quantity
            stockLocation: delivery.stockLocation
          };
        })
      };

      // Update order with delivery data
      await orderService.confirmDelivery(order.id, deliveryData);

      toast({
        title: "Delivery Confirmed",
        description: "Order delivery has been successfully confirmed.",
      });

      // Show label dialog immediately
      setShowLabelDialog(true);

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

                  const remainingQuantity = item.quantity - (item.delivered_quantity || 0);

                  return (
                    <div key={item.id} className="p-6 border rounded-lg">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 space-y-3">
                          <div>
                            <h4 className="text-lg font-semibold">{item.description}</h4>
                            <p className="text-base text-muted-foreground">Article: {item.article_code}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Ordered:</span> {item.quantity}
                            </div>
                            {item.delivered_quantity > 0 && (
                              <div>
                                <span className="font-medium text-blue-600">Previously delivered:</span> {item.delivered_quantity}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-green-600">Remaining:</span> {remainingQuantity}
                            </div>
                          </div>

                          {!delivery.isFullyDelivered && (
                            <div className="space-y-2">
                              <Label htmlFor={`delivered-${item.id}`} className="text-sm font-medium text-green-600">
                                How many items are being delivered now?
                              </Label>
                              <Input
                                id={`delivered-${item.id}`}
                                type="number"
                                min="0"
                                max={remainingQuantity}
                                value={delivery.deliveredQuantity}
                                onChange={(e) => updateItemDelivery(item.id, 'deliveredQuantity', parseInt(e.target.value) || 0)}
                                className="w-32"
                                placeholder="0"
                              />
                              <p className="text-xs text-muted-foreground">
                                Out of {remainingQuantity} remaining items
                              </p>
                            </div>
                          )}

                          {(delivery.isFullyDelivered || delivery.deliveredQuantity > 0) && (
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
                          )}
                        </div>
                        
                        <div className="flex flex-col items-center space-y-3">
                          <div className="flex flex-col items-center space-y-2">
                            <Label className="text-sm font-medium text-center">All articles received</Label>
                            <Checkbox
                              id={`full-delivery-${item.id}`}
                              checked={delivery.isFullyDelivered}
                              onCheckedChange={(checked) => updateItemDelivery(item.id, 'isFullyDelivered', checked)}
                              className="w-8 h-8 rounded-md"
                            />
                          </div>
                          
                          {delivery.isFullyDelivered && (
                            <div className="text-center">
                              <div className="text-sm font-medium text-green-600">✓ All {remainingQuantity} items</div>
                            </div>
                          )}
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
                    className="w-full h-80 object-cover"
                    style={{ background: '#000' }}
                    onLoadedData={() => {
                      console.log('Video data loaded');
                      if (videoRef.current) {
                        console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                      }
                    }}
                    onPlay={() => console.log('Video started playing')}
                    onError={(e) => console.error('Video error:', e)}
                  />
                ) : (
                  <div className="w-full h-80 flex items-center justify-center text-white">
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
                        <img src={image} alt={`Captured ${index + 1}`} className="w-full h-32 object-cover rounded border" />
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

        <LabelPrintDialog
          order={order}
          orderItems={orderItems}
          isOpen={showLabelDialog}
          onClose={() => {
            setShowLabelDialog(false);
            onConfirmed();
            handleClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};