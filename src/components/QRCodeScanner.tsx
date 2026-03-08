import React, { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, RotateCcw, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { qrCodeService } from '@/services/qrCodeService';
import { partTrackingService } from '@/services/partTrackingService';
import { supabase } from '@/integrations/supabase/client';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onQRCodeDetected: (qrCode: string) => void;
  workstationName: string;
  workstationId?: string;
}

interface ScanResult {
  code: string;
  status: 'success' | 'not_found' | 'error';
  message: string;
  partsCompleted?: number;
}

const SCAN_COOLDOWN_MS = 1500;
const SUCCESS_DISPLAY_MS = 1200;

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  isOpen,
  onClose,
  onQRCodeDetected,
  workstationName,
  workstationId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastScannedRef = useRef<string>('');
  const cooldownRef = useRef<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<'environment' | 'user'>('environment');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  const processQRCode = useCallback(async (rawCode: string) => {
    // Remove first character (barcode prefix)
    const code = rawCode.length > 1 ? rawCode.substring(1) : rawCode;

    // Cooldown: ignore same code scanned within SCAN_COOLDOWN_MS
    const now = Date.now();
    if (code === lastScannedRef.current && now - cooldownRef.current < SCAN_COOLDOWN_MS) {
      return;
    }
    if (processing) return;

    lastScannedRef.current = code;
    cooldownRef.current = now;
    setProcessing(true);

    try {
      // 1. Find the part
      const part = await qrCodeService.findPartByQRCode(code);

      if (!part) {
        setLastResult({ code, status: 'not_found', message: `"${code}" niet gevonden` });
        setProcessing(false);
        // Auto-clear after a moment
        setTimeout(() => setLastResult(null), SUCCESS_DISPLAY_MS);
        return;
      }

      // 2. Update workstation_name_status on the part
      await qrCodeService.updatePartWorkstationStatus(part.id, workstationName);

      // 3. Complete part_workstation_tracking for this workstation
      let partsCompleted = 0;
      if (workstationId) {
        const { data, error } = await supabase
          .from('part_workstation_tracking')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('part_id', part.id)
          .eq('workstation_id', workstationId)
          .eq('status', 'pending')
          .select();

        if (!error && data) {
          partsCompleted = data.length;
        }
      }

      setScanCount(prev => prev + 1);
      setLastResult({
        code,
        status: 'success',
        message: `✓ ${code}`,
        partsCompleted,
      });

      onQRCodeDetected(code);

      // Auto-clear result after brief display
      setTimeout(() => setLastResult(null), SUCCESS_DISPLAY_MS);
    } catch (error: any) {
      console.error('Error processing QR code:', error);
      setLastResult({ code, status: 'error', message: 'Verwerkingsfout' });
      setTimeout(() => setLastResult(null), SUCCESS_DISPLAY_MS);
    } finally {
      setProcessing(false);
    }
  }, [workstationName, workstationId, onQRCodeDetected, processing]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      // Request permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentCamera, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      // Stop the test stream — QrScanner will open its own
      stream.getTracks().forEach(t => t.stop());
      setHasPermission(true);

      // Clean up existing
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result: QrScanner.ScanResult) => {
          const qrData = result.data?.trim() || '';
          if (qrData) {
            processQRCode(qrData);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: currentCamera,
          maxScansPerSecond: 5,
          calculateScanRegion: (video) => ({
            x: 0,
            y: 0,
            width: video.videoWidth,
            height: video.videoHeight,
          }),
        },
      );

      scanner.setInversionMode('both');
      scannerRef.current = scanner;
      await scanner.start();
      setCameraStarted(true);
    } catch (error: any) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setHasPermission(false);
      }
      toast({
        title: 'Camera fout',
        description: error.message || 'Kon camera niet starten',
        variant: 'destructive',
      });
    }
  }, [currentCamera, processQRCode, toast]);

  const switchCamera = async () => {
    const next = currentCamera === 'environment' ? 'user' : 'environment';
    setCurrentCamera(next);
    if (cameraStarted) {
      // Will restart with new camera on next render
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
      setCameraStarted(false);
      // Small delay then restart
      setTimeout(() => startCamera(), 200);
    }
  };

  const cleanup = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setCameraStarted(false);
    setHasPermission(null);
    setLastResult(null);
    setProcessing(false);
    setScanCount(0);
    lastScannedRef.current = '';
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95vw] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg leading-tight">
            <Camera className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            QR Scanner - {workstationName}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Scan onderdelen om ze te registreren op dit werkstation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hasPermission === false ? (
            <div className="text-center space-y-4 py-8">
              <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">Camera toegang vereist</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Geef toestemming voor camera toegang om QR codes te scannen.
                </p>
              </div>
              <Button onClick={startCamera}>Camera toegang verlenen</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  style={{ aspectRatio: '4 / 3' }}
                  playsInline
                  muted
                />

                {/* Start overlay */}
                {!cameraStarted && !lastResult && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                    <div className="text-white text-center">
                      <Camera className="h-12 w-12 mx-auto mb-4" />
                      <p className="text-sm mb-4">Klik om te beginnen</p>
                      <Button
                        onClick={startCamera}
                        variant="outline"
                        className="text-white border-white hover:bg-white hover:text-black"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                    </div>
                  </div>
                )}

                {/* Scan result overlay */}
                {lastResult && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity duration-200 ${
                      lastResult.status === 'success'
                        ? 'bg-green-500/80'
                        : lastResult.status === 'not_found'
                        ? 'bg-orange-500/80'
                        : 'bg-red-500/80'
                    }`}
                  >
                    <div className="text-white text-center px-4">
                      {lastResult.status === 'success' ? (
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                      ) : (
                        <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                      )}
                      <p className="text-lg font-semibold">{lastResult.message}</p>
                      {lastResult.partsCompleted != null && lastResult.partsCompleted > 0 && (
                        <p className="text-sm mt-1 opacity-90">
                          {lastResult.partsCompleted} tracking record(s) afgerond
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Scan counter & controls */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {scanCount > 0 ? `${scanCount} gescand` : 'Klaar om te scannen'}
                </span>
                {cameraStarted && (
                  <div className="flex gap-2">
                    <Button onClick={switchCamera} variant="outline" size="sm">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {currentCamera === 'environment' ? 'Voorcamera' : 'Achtercamera'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" />
              Sluiten
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
