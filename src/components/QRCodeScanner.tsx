import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, RotateCcw, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { qrCodeService } from '@/services/qrCodeService';

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
  const [cameraStarted, setCameraStarted] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<'environment' | 'user'>('environment');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [isOpen]);

  const startCamera = async () => {
    if (!videoRef.current) {
      console.log('Video ref not available');
      return;
    }

    try {
      console.log('Starting camera with facing mode:', currentCamera);
      
      // First request camera permissions explicitly
      try {
        await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: currentCamera,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        console.log('Camera permissions granted');
        setHasPermission(true);
      } catch (permError) {
        console.error('Camera permission error:', permError);
        setHasPermission(false);
        toast({
          title: 'Camera toegang geweigerd',
          description: 'Geef toestemming voor camera toegang om QR codes te scannen.',
          variant: 'destructive'
        });
        return;
      }

      // Check if camera is available
      const hasCamera = await QrScanner.hasCamera();
      console.log('Has camera:', hasCamera);
      
      if (!hasCamera) {
        toast({
          title: 'Camera niet beschikbaar',
          description: 'Geen camera gevonden op dit apparaat.',
          variant: 'destructive'
        });
        return;
      }

      // Clean up existing scanner
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }

      // Initialize the QR scanner
      console.log('Creating QR scanner instance...');
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR code detected:', result);
          if (result && result.data) {
            handleQRCodeDetected(result.data);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: currentCamera,
          maxScansPerSecond: 5,
        }
      );

      scannerRef.current = scanner;
      console.log('Starting QR scanner...');
      await scanner.start();
      console.log('QR scanner started successfully');
      
      setScanning(true);
      setCameraStarted(true);

    } catch (error: any) {
      console.error('Failed to start camera:', error);
      console.error('Error details:', error.message, error.name);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setHasPermission(false);
        toast({
          title: 'Camera toegang geweigerd',
          description: 'Geef toestemming voor camera toegang om QR codes te scannen.',
          variant: 'destructive'
        });
      } else if (error.name === 'NotFoundError') {
        toast({
          title: 'Camera niet gevonden',
          description: 'Geen camera gevonden op dit apparaat.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Scanner fout',
          description: `Kon de QR scanner niet initialiseren: ${error.message}`,
          variant: 'destructive'
        });
      }
    }
  };

  const switchCamera = async () => {
    const newCamera = currentCamera === 'environment' ? 'user' : 'environment';
    setCurrentCamera(newCamera);
    
    if (cameraStarted) {
      // Restart camera with new facing mode
      await startCamera();
    }
  };

  const handleQRCodeDetected = async (qrCode: string) => {
    if (scanning && !processing) {
      setScanning(false);
      setProcessing(true);
      
      // Show green success screen for 2 seconds
      setSuccessMessage(`QR Code gevonden: ${qrCode}`);
      setShowSuccess(true);
      
      setTimeout(async () => {
        try {
          // Search for the QR code in parts list
          const part = await qrCodeService.findPartByQRCode(qrCode);
          
          if (part) {
            // Update the workstation status
            await qrCodeService.updatePartWorkstationStatus(part.id, workstationName);
            
            toast({
              title: 'Succes!',
              description: `Onderdeel "${qrCode}" toegewezen aan workstation "${workstationName}"`,
            });
            
            onQRCodeDetected(qrCode);
          } else {
            toast({
              title: 'Onderdeel niet gevonden',
              description: `"${qrCode}" werd niet gevonden in de onderdelenlijst`,
              variant: 'destructive'
            });
          }
        } catch (error) {
          console.error('Error processing QR code:', error);
          toast({
            title: 'Fout bij verwerken',
            description: 'Er is een fout opgetreden bij het verwerken van de QR code',
            variant: 'destructive'
          });
        } finally {
          setShowSuccess(false);
          setProcessing(false);
          onClose();
        }
      }, 2000);
    }
  };

  const cleanup = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
    setCameraStarted(false);
    setHasPermission(null);
    setShowSuccess(false);
    setProcessing(false);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      await startCamera();
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
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  style={{ aspectRatio: '1 / 1' }}
                  playsInline
                  muted
                />
                {!cameraStarted && !showSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="text-white text-center">
                      <Camera className="h-12 w-12 mx-auto mb-4" />
                      <p className="text-sm mb-4">Klik op "Start Camera" om te beginnen</p>
                      <Button onClick={startCamera} variant="outline" className="text-white border-white hover:bg-white hover:text-black">
                        <Play className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                    </div>
                  </div>
                )}
                {showSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/90 rounded-lg">
                    <div className="text-white text-center">
                      <div className="animate-pulse">
                        <div className="h-12 w-12 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
                          <div className="h-6 w-6 bg-green-500 rounded-full"></div>
                        </div>
                        <p className="text-lg font-semibold">{successMessage}</p>
                        <p className="text-sm mt-2">Verwerken...</p>
                      </div>
                    </div>
                  </div>
                )}
                {scanning && !showSuccess && (
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
              
              {cameraStarted && (
                <div className="flex gap-2 justify-center">
                  <Button onClick={switchCamera} variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {currentCamera === 'environment' ? 'Voorcamera' : 'Achtercamera'}
                  </Button>
                  <Button onClick={startCamera} variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Herstart Camera
                  </Button>
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