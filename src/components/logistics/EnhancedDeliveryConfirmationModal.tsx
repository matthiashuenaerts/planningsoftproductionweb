import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Camera, Upload, X, Package, MapPin, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Order, OrderItem } from '@/types/order';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { LabelPrintDialog } from './LabelPrintDialog';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

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
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState<DeliveryStep>('confirm');
  const [itemDeliveries, setItemDeliveries] = useState<ItemDelivery[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<{[key: string]: string[]}>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const { data: orderItems = [], isLoading } = useQuery({
    queryKey: ['order-items', order.id],
    queryFn: () => orderService.getOrderItems(order.id),
    enabled: isOpen
  });

  const fetchLocationSuggestions = async (itemId: string) => {
    if (!order.project_id || locationSuggestions[itemId]) return;

    try {
      const { data: projectLocations, error: projectError } = await supabase
        .from('order_items')
        .select(`
          stock_location,
          orders!inner(project_id)
        `)
        .eq('orders.project_id', order.project_id)
        .not('stock_location', 'is', null)
        .neq('stock_location', '');

      if (projectError) throw projectError;

      const projectLocationsList = [...new Set(projectLocations.map(item => item.stock_location).filter(Boolean))];

      if (projectLocationsList.length > 0) {
        setLocationSuggestions(prev => ({ ...prev, [itemId]: projectLocationsList }));
      } else {
        const [stockLocationsResult, usedLocationsResult] = await Promise.all([
          supabase.from('stock_locations').select('name').eq('is_active', true).order('display_order'),
          supabase.from('order_items').select('stock_location').not('stock_location', 'is', null).neq('stock_location', '')
        ]);

        if (stockLocationsResult.error) throw stockLocationsResult.error;
        if (usedLocationsResult.error) throw usedLocationsResult.error;

        const allLocations = stockLocationsResult.data.map(loc => loc.name);
        const usedLocations = new Set(usedLocationsResult.data.map(item => item.stock_location));
        const freeLocations = allLocations.filter(loc => !usedLocations.has(loc));

        setLocationSuggestions(prev => ({ ...prev, [itemId]: freeLocations }));
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
    }
  };

  useEffect(() => {
    if (orderItems.length > 0 && itemDeliveries.length === 0) {
      setItemDeliveries(
        orderItems.map(item => {
          const remainingQuantity = item.quantity - (item.delivered_quantity || 0);
          return {
            itemId: item.id,
            deliveredQuantity: 0,
            stockLocation: item.stock_location || '',
            isFullyDelivered: false,
            notDeliveredQuantity: remainingQuantity
          };
        })
      );
    }
  }, [orderItems, itemDeliveries.length]);

  const startCamera = async () => {
    try {
      stopCamera();
      const constraints = { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(error => console.error('Error playing video:', error));
          };
        }
      }, 100);
    } catch (error: any) {
      toast({
        title: t('ed_camera_error'),
        description: (t('ed_camera_error_desc') || '').replace('{{message}}', error.message),
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
    setTimeout(() => startCamera(), 500);
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
      for (const imageData of capturedImages) {
        const blob = await fetch(imageData).then(r => r.blob());
        const file = new File([blob], `delivery-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await orderService.uploadOrderAttachment(order.id, file);
      }

      const deliveryData = {
        itemDeliveries: itemDeliveries.map(delivery => {
          const orderItem = orderItems.find(item => item.id === delivery.itemId);
          const previouslyDelivered = orderItem?.delivered_quantity || 0;
          return {
            itemId: delivery.itemId,
            deliveredQuantity: previouslyDelivered + delivery.deliveredQuantity,
            stockLocation: delivery.stockLocation
          };
        })
      };

      await orderService.confirmDelivery(order.id, deliveryData);

      toast({
        title: t('ed_delivery_confirmed'),
        description: t('ed_delivery_confirmed_desc'),
      });

      setShowLabelDialog(true);
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast({
        title: t('error'),
        description: t('ed_delivery_error'),
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

  const someItemsDelivered = itemDeliveries.some((delivery) => delivery.deliveredQuantity > 0);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div>{t('ed_loading')}</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${isMobile ? 'max-w-[95vw] p-3' : 'max-w-4xl'}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
            <Package className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span className="truncate">
              {(t('ed_confirm_delivery') || '').replace('{{supplier}}', order.supplier)}
            </span>
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'confirm' && (
          <div className={isMobile ? 'space-y-3' : 'space-y-6'}>
            <div className={`grid grid-cols-2 gap-3 ${isMobile ? 'p-3 text-xs' : 'p-4'} bg-muted/50 rounded-lg`}>
              <div className="min-w-0">
                <Label className={`font-medium text-muted-foreground ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{t('ed_order_id')}</Label>
                <div className={`truncate ${isMobile ? 'text-[11px]' : 'text-sm'}`}>{order.id}</div>
              </div>
              <div>
                <Label className={`font-medium text-muted-foreground ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{t('ed_status')}</Label>
                <div>
                  <Badge className={`${getStatusColor(order.status)} ${isMobile ? 'text-[10px] px-1.5 py-0' : ''}`}>
                    {order.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className={`font-medium text-muted-foreground ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{t('ed_expected_delivery')}</Label>
                <div className={isMobile ? 'text-[11px]' : 'text-sm'}>{new Date(order.expected_delivery).toLocaleDateString()}</div>
              </div>
              <div>
                <Label className={`font-medium text-muted-foreground ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{t('ed_order_date')}</Label>
                <div className={isMobile ? 'text-[11px]' : 'text-sm'}>{new Date(order.order_date).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleClose} size={isMobile ? 'sm' : 'default'}>
                {t('ed_cancel')}
              </Button>
              <Button onClick={() => setCurrentStep('items')} size={isMobile ? 'sm' : 'default'}>
                {t('ed_continue_items')}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'items' && (
          <div className={isMobile ? 'space-y-3' : 'space-y-6'}>
            <div className={isMobile ? 'space-y-2' : 'space-y-4'}>
              <h3 className={`font-semibold ${isMobile ? 'text-sm' : 'text-lg'}`}>{t('ed_delivery_details')}</h3>
              <div className={`space-y-3 overflow-y-auto ${isMobile ? 'max-h-[55vh]' : 'max-h-96'}`}>
                {orderItems.map((item, index) => {
                  const delivery = itemDeliveries[index];
                  if (!delivery) return null;
                  const remainingQuantity = item.quantity - (item.delivered_quantity || 0);

                  return (
                    <div key={item.id} className={`border rounded-lg ${isMobile ? 'p-3' : 'p-4 md:p-6'}`}>
                      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-start sm:justify-between gap-4'}`}>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div>
                            <h4 className={`font-semibold truncate ${isMobile ? 'text-xs' : 'text-base md:text-lg'}`}>{item.description}</h4>
                            <p className={`text-muted-foreground truncate ${isMobile ? 'text-[10px]' : 'text-sm'}`}>{t('ed_article')}: {item.article_code}</p>
                          </div>

                          <div className={`grid grid-cols-2 gap-1 ${isMobile ? 'text-[11px]' : 'text-sm'}`}>
                            <div>
                              <span className="font-medium">{t('ed_ordered')}:</span> {item.quantity}
                            </div>
                            <div>
                              <span className="font-medium text-green-600">{t('ed_remaining')}:</span> {remainingQuantity}
                            </div>
                          </div>

                          {!delivery.isFullyDelivered && (
                            <div className="space-y-1">
                              <Label htmlFor={`delivered-${item.id}`} className={`font-medium text-green-600 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                                {t('ed_how_many_delivered')}
                              </Label>
                              <Input
                                id={`delivered-${item.id}`}
                                type="number"
                                min="0"
                                max={remainingQuantity}
                                value={delivery.deliveredQuantity}
                                onChange={(e) => updateItemDelivery(item.id, 'deliveredQuantity', parseInt(e.target.value) || 0)}
                                className={isMobile ? 'w-24 h-8 text-sm' : 'w-32'}
                                placeholder="0"
                              />
                              <p className={`text-muted-foreground ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                                {(t('ed_out_of_remaining') || '').replace('{{count}}', String(remainingQuantity))}
                              </p>
                            </div>
                          )}

                          {(delivery.isFullyDelivered || delivery.deliveredQuantity > 0) && (
                            <div>
                              <Label htmlFor={`location-${item.id}`} className={`font-medium flex items-center gap-1 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                                <MapPin className={isMobile ? 'h-3 w-3' : 'h-4 w-4'} />
                                {t('ed_stock_location')}
                              </Label>
                              <div className="flex gap-1.5 mt-1">
                                <Input
                                  id={`location-${item.id}`}
                                  type="text"
                                  value={delivery.stockLocation}
                                  onChange={(e) => updateItemDelivery(item.id, 'stockLocation', e.target.value)}
                                  placeholder={t('ed_location_placeholder')}
                                  className={`flex-1 ${isMobile ? 'h-8 text-xs' : ''}`}
                                />
                                {order.project_id && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchLocationSuggestions(item.id)}
                                        className={isMobile ? 'h-8 px-2' : 'px-3'}
                                      >
                                        <ChevronDown className={isMobile ? 'h-3 w-3' : 'h-4 w-4'} />
                                        {!isMobile && <span className="hidden sm:inline ml-1">{t('ed_suggestions')}</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-60 p-0">
                                      <div className="p-2">
                                        <div className="text-sm font-medium mb-2 text-muted-foreground">
                                          {locationSuggestions[item.id]?.some(loc =>
                                            orderItems.some(oi => oi.stock_location === loc)
                                          ) ? t('ed_project_locations') : t('ed_free_locations')}
                                        </div>
                                        {locationSuggestions[item.id]?.length > 0 ? (
                                          <div className="space-y-1">
                                            {locationSuggestions[item.id].map((location, idx) => (
                                              <Button
                                                key={idx}
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start text-left"
                                                onClick={() => updateItemDelivery(item.id, 'stockLocation', location)}
                                              >
                                                <MapPin className="h-3 w-3 mr-2" />
                                                {location}
                                              </Button>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-sm text-muted-foreground py-2">
                                            {t('ed_no_locations')}
                                          </div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className={`flex ${isMobile ? 'flex-row items-center gap-2' : 'flex-row sm:flex-col items-center gap-3'}`}>
                          <Checkbox
                            id={`full-delivery-${item.id}`}
                            checked={delivery.isFullyDelivered}
                            onCheckedChange={(checked) => updateItemDelivery(item.id, 'isFullyDelivered', checked)}
                            className={isMobile ? 'w-6 h-6 rounded' : 'w-8 h-8 rounded-md'}
                          />
                          <Label className={`font-medium ${isMobile ? 'text-[10px]' : 'text-sm text-center'}`}>{t('ed_all_received')}</Label>
                          {delivery.isFullyDelivered && (
                            <span className={`font-medium text-green-600 ${isMobile ? 'text-[10px]' : 'text-sm'}`}>
                              ✓ {remainingQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('confirm')} size={isMobile ? 'sm' : 'default'}>
                {t('ed_back')}
              </Button>
              <Button
                onClick={() => setCurrentStep('camera')}
                disabled={!someItemsDelivered}
                size={isMobile ? 'sm' : 'default'}
              >
                {t('ed_continue_photo')}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'camera' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">{t('ed_take_photos')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('ed_photos_description')}
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
                    className="w-full h-60 sm:h-80 object-cover"
                    style={{ background: '#000' }}
                  />
                ) : (
                  <div className="w-full h-60 sm:h-80 flex items-center justify-center text-white">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-2" />
                      <p>{t('ed_camera_not_started')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {!stream ? (
                  <Button onClick={startCamera} size="sm">
                    <Camera className="h-4 w-4 mr-2" />
                    {t('ed_start_camera')}
                  </Button>
                ) : (
                  <>
                    <Button onClick={captureImage} size="sm">
                      <Camera className="h-4 w-4 mr-2" />
                      {t('ed_capture_photo')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={switchCamera}>
                      {t('ed_switch_camera')}
                    </Button>
                  </>
                )}
              </div>

              {capturedImages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
                    {(t('ed_captured_images') || '').replace('{{count}}', String(capturedImages.length))}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {capturedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img src={image} alt={`Captured ${index + 1}`} className="w-full h-24 sm:h-32 object-cover rounded border" />
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
                {t('ed_back')}
              </Button>
              <Button
                onClick={confirmDelivery}
                disabled={capturedImages.length === 0}
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('ed_confirm_delivery_btn')}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'uploading' && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div>
              <h3 className="text-lg font-semibold">{t('ed_processing')}</h3>
              <p className="text-sm text-muted-foreground">{t('ed_processing_desc')}</p>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <LabelPrintDialog
          order={order}
          orderItems={orderItems}
          itemDeliveries={itemDeliveries}
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
