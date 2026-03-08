import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Package, Check, X, RotateCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface MatchingOrderItem {
  itemId: string;
  orderId: string;
  supplier: string;
  projectName: string;
  expectedDelivery: string;
  articleCode: string;
  ean: string | null;
  description: string;
  quantity: number;
  deliveredQuantity: number;
  remaining: number;
}

interface ScannedArticle {
  id: string;
  barcode: string;
  timestamp: Date;
  status: 'pending' | 'received' | 'not_found';
  matchedItem?: MatchingOrderItem;
  matchingItems?: MatchingOrderItem[];
}

interface BatchReceiptsScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptsConfirmed: () => void;
}

export const BatchReceiptsScanner: React.FC<BatchReceiptsScannerProps> = ({
  isOpen,
  onClose,
  onReceiptsConfirmed,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scannedArticles, setScannedArticles] = useState<ScannedArticle[]>([]);
  const [selectingOrderFor, setSelectingOrderFor] = useState<ScannedArticle | null>(null);
  const [confirming, setConfirming] = useState(false);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      requestCameraPermission();
    } else {
      cleanup();
      setScannedArticles([]);
      setSelectingOrderFor(null);
    }
    return () => cleanup();
  }, [isOpen]);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      startCamera();
    } catch {
      setHasPermission(false);
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameras[currentCameraIndex]?.deviceId,
          facingMode: cameras.length > 0 ? undefined : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        scanIntervalRef.current = setInterval(scanForBarcode, 600);
      }
    } catch {
      // ignore
    }
  };

  const scanForBarcode = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();
      let result = null;

      try {
        result = await reader.decodeFromVideoElement(video);
      } catch {
        try {
          result = await reader.decodeFromImageUrl(canvas.toDataURL('image/jpeg', 0.95));
        } catch {
          // no detection
        }
      }

      if (result) {
        const code = result.getText();
        const now = Date.now();
        // Debounce: same code within 3 seconds
        if (code === lastScannedRef.current && now - lastScannedTimeRef.current < 3000) return;
        lastScannedRef.current = code;
        lastScannedTimeRef.current = now;

        await handleBarcodeDetected(code);
      }
    } catch {
      // continue scanning
    }
  };

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    // Find matching undelivered order items
    const normalize = (s: string) => s.replace(/[\s-]/g, '').toLowerCase();
    const normalizedBarcode = normalize(barcode);

    const { data: items, error } = await supabase
      .from('order_items')
      .select(`
        id,
        description,
        quantity,
        delivered_quantity,
        article_code,
        ean,
        order_id,
        orders!inner(
          id,
          supplier,
          expected_delivery,
          status,
          project_id
        )
      `)
      .not('orders.status', 'in', '("delivered","charged","canceled")');

    if (error) {
      console.error('Error fetching order items:', error);
      return;
    }

    // Filter items that match the barcode and still need delivery
    const matching: MatchingOrderItem[] = [];
    for (const item of items || []) {
      const delivered = item.delivered_quantity || 0;
      const remaining = item.quantity - delivered;
      if (remaining <= 0) continue;

      const matchesEan = item.ean && normalize(item.ean).includes(normalizedBarcode);
      const matchesArticle = item.article_code && normalize(item.article_code).includes(normalizedBarcode);

      if (matchesEan || matchesArticle) {
        const order = (item as any).orders;
        // Fetch project name
        let projectName = order.project_id || '';
        if (order.project_id) {
          const { data: proj } = await supabase
            .from('projects')
            .select('name')
            .eq('id', order.project_id)
            .single();
          if (proj) projectName = proj.name;
        }

        matching.push({
          itemId: item.id,
          orderId: order.id,
          supplier: order.supplier,
          projectName,
          expectedDelivery: order.expected_delivery,
          articleCode: item.article_code,
          ean: item.ean,
          description: item.description,
          quantity: item.quantity,
          deliveredQuantity: delivered,
          remaining,
        });
      }
    }

    // Sort by urgency (earliest expected delivery first)
    matching.sort((a, b) => new Date(a.expectedDelivery).getTime() - new Date(b.expectedDelivery).getTime());

    const newArticle: ScannedArticle = {
      id: crypto.randomUUID(),
      barcode,
      timestamp: new Date(),
      status: matching.length === 0 ? 'not_found' : 'pending',
      matchingItems: matching.length > 1 ? matching : undefined,
      matchedItem: matching.length === 1 ? matching[0] : undefined,
    };

    if (matching.length > 1) {
      // Show order selection dialog
      setSelectingOrderFor(newArticle);
    }

    setScannedArticles(prev => [newArticle, ...prev]);

    if (matching.length === 0) {
      toast({ title: barcode, description: t('br_not_found'), variant: 'destructive' });
    } else if (matching.length === 1) {
      toast({ title: barcode, description: (t('br_article_received') || '').replace('{{supplier}}', matching[0].supplier) });
    }
  }, [t, toast]);

  const handleSelectOrder = (article: ScannedArticle, item: MatchingOrderItem) => {
    setScannedArticles(prev =>
      prev.map(a =>
        a.id === article.id ? { ...a, matchedItem: item, matchingItems: undefined, status: 'pending' as const } : a
      )
    );
    setSelectingOrderFor(null);
    toast({ title: article.barcode, description: (t('br_article_received') || '').replace('{{supplier}}', item.supplier) });
  };

  const handleConfirmAll = async () => {
    const pendingArticles = scannedArticles.filter(a => a.status === 'pending' && a.matchedItem);
    if (pendingArticles.length === 0) {
      toast({ title: t('br_no_pending'), variant: 'destructive' });
      return;
    }

    setConfirming(true);
    try {
      for (const article of pendingArticles) {
        const item = article.matchedItem!;
        const newDelivered = item.deliveredQuantity + 1;

        await supabase
          .from('order_items')
          .update({ delivered_quantity: newDelivered })
          .eq('id', item.itemId);

        // Check if all items in order are now delivered
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity, delivered_quantity')
          .eq('order_id', item.orderId);

        // Update the item we just changed in our local check
        const updatedItems = orderItems?.map(oi => 
          oi === orderItems.find(x => (x as any).id === item.itemId) 
            ? { ...oi, delivered_quantity: newDelivered } 
            : oi
        );

        const allDelivered = orderItems?.every(oi => {
          const del = oi === orderItems.find(() => false) ? newDelivered : (oi.delivered_quantity || 0);
          return del >= oi.quantity;
        });
        const someDelivered = orderItems?.some(oi => (oi.delivered_quantity || 0) > 0);

        if (allDelivered) {
          await supabase.from('orders').update({ status: 'delivered' }).eq('id', item.orderId);
        } else if (someDelivered) {
          await supabase.from('orders').update({ status: 'partially_delivered' }).eq('id', item.orderId);
        }

        setScannedArticles(prev =>
          prev.map(a => (a.id === article.id ? { ...a, status: 'received' as const } : a))
        );
      }

      toast({
        title: (t('br_confirmed_count') || '').replace('{{count}}', String(pendingArticles.length)),
      });
      onReceiptsConfirmed();
    } catch (error: any) {
      console.error('Error confirming receipts:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  const switchCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((currentCameraIndex + 1) % cameras.length);
      startCamera();
    }
  };

  const cleanup = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const pendingCount = scannedArticles.filter(a => a.status === 'pending' && a.matchedItem).length;
  const receivedCount = scannedArticles.filter(a => a.status === 'received').length;

  return (
    <>
      <Dialog open={isOpen && !selectingOrderFor} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5" />
              {t('br_batch_receipts')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{t('br_scan_articles')}</p>
          </DialogHeader>

          <div className="px-4 space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Camera */}
            {hasPermission === true && (
              <div className="relative rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-40 bg-black object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-20 border-2 border-primary rounded-lg">
                      <div className="w-full h-full border border-primary/50 border-dashed rounded-lg animate-pulse" />
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {cameras.length > 1 && (
                    <Button variant="outline" size="icon" onClick={switchCamera} className="h-7 w-7 bg-black/50 text-white border-white/20">
                      <RotateCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/70">{t('br_scan_instruction')}</p>
              </div>
            )}

            {hasPermission === false && (
              <div className="text-center py-6">
                <Camera className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <Button size="sm" onClick={requestCameraPermission}>
                  <Camera className="h-4 w-4 mr-1" /> Allow Camera
                </Button>
              </div>
            )}

            {hasPermission === null && (
              <div className="text-center py-6 text-sm text-muted-foreground">Requesting camera...</div>
            )}

            {/* Scanned articles list */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('br_scanned_articles')}</h3>
              <div className="flex gap-2">
                {receivedCount > 0 && <Badge variant="default" className="text-xs">{receivedCount} ✓</Badge>}
                {pendingCount > 0 && <Badge variant="secondary" className="text-xs">{pendingCount} {t('br_pending')}</Badge>}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[280px]">
              {scannedArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('br_no_scans_yet')}</p>
              ) : (
                <div className="space-y-2 pr-2">
                  {scannedArticles.map(article => (
                    <Card key={article.id} className={`overflow-hidden ${article.status === 'received' ? 'opacity-60' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium truncate">{article.barcode}</p>
                            {article.matchedItem && (
                              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                <p className="truncate">{article.matchedItem.description}</p>
                                <p>{article.matchedItem.supplier} · {article.matchedItem.projectName}</p>
                              </div>
                            )}
                            {article.status === 'not_found' && (
                              <p className="text-xs text-destructive mt-0.5">{t('br_not_found')}</p>
                            )}
                            {article.matchingItems && article.matchingItems.length > 1 && !article.matchedItem && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => setSelectingOrderFor(article)}
                              >
                                {t('br_select_order')} ({article.matchingItems.length})
                              </Button>
                            )}
                          </div>
                          <div className="shrink-0">
                            {article.status === 'received' && (
                              <Badge className="bg-green-100 text-green-800 text-xs"><Check className="h-3 w-3 mr-1" />{t('br_received')}</Badge>
                            )}
                            {article.status === 'pending' && article.matchedItem && (
                              <Badge variant="secondary" className="text-xs">{t('br_pending')}</Badge>
                            )}
                            {article.status === 'not_found' && (
                              <Badge variant="destructive" className="text-xs"><X className="h-3 w-3" /></Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Confirm button */}
          <div className="p-4 border-t">
            <Button
              onClick={handleConfirmAll}
              disabled={pendingCount === 0 || confirming}
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              {t('br_confirm_all')} ({pendingCount})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order selection dialog */}
      <Dialog open={!!selectingOrderFor} onOpenChange={() => setSelectingOrderFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t('br_select_order')}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t('br_choose_order')}</p>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {selectingOrderFor?.matchingItems?.map((item, idx) => (
                <Card
                  key={item.itemId}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectOrder(selectingOrderFor!, item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.supplier}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('br_expected')}: {format(new Date(item.expectedDelivery), 'PP')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(t('br_remaining') || '').replace('{{remaining}}', String(item.remaining)).replace('{{total}}', String(item.quantity))}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {idx === 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {t('br_most_urgent')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
