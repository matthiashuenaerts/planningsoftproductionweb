import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onQRCodeDetected: (qrCode: string) => void;
  workstationName: string;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  isOpen,
  onClose,
  onQRCodeDetected,
  workstationName
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && videoRef.current) {
      initializeScanner();
    }

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const initializeScanner = async () => {
    if (!videoRef.current) return;

    try {
      // Check if camera permissions are available
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        toast({
          title: 'Camera niet beschikbaar',
          description: 'Geen camera gevonden op dit apparaat.',
          variant: 'destructive'
        });
        return;
      }

      // Initialize the QR scanner
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (result && result.data) {
            handleQRCodeDetected(result.data);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Use back camera if available
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);
      setHasPermission(true);

    } catch (error: any) {
      console.error('Failed to initialize QR scanner:', error);
      
      if (error.name === 'NotAllowedError') {
        setHasPermission(false);
        toast({
          title: 'Camera toegang geweigerd',
          description: 'Geef toestemming voor camera toegang om QR codes te scannen.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Scanner fout',
          description: 'Kon de QR scanner niet initialiseren.',
          variant: 'destructive'
        });
      }
    }
  };

  const handleQRCodeDetected = (qrCode: string) => {
    if (scanning) {
      setScanning(false);
      toast({
        title: 'QR Code gevonden!',
        description: `Zoeken naar "${qrCode}" in onderdelenlijst...`
      });
      onQRCodeDetected(qrCode);
      onClose();
    }
  };

  const cleanup = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
    setHasPermission(null);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      initializeScanner();
    } catch (error) {
      toast({
        title: 'Camera toegang geweigerd',
        description: 'Geef toestemming voor camera toegang in uw browser instellingen.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            QR Code Scanner - {workstationName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {hasPermission === false ? (
            <div className="text-center space-y-4 py-8">
              <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">Camera toegang vereist</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Geef toestemming voor camera toegang om QR codes te scannen.
                </p>
              </div>
              <Button onClick={requestPermission}>
                Camera toegang verlenen
              </Button>
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg bg-black"
                style={{ aspectRatio: '1 / 1' }}
                playsInline
                muted
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="text-white text-center">
                    <div className="animate-pulse">
                      <Camera className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Richt de camera op een QR code</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
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