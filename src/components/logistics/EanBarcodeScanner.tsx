import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

interface EanBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onEanDetected: (ean: string) => void;
}

export const EanBarcodeScanner: React.FC<EanBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onEanDetected
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      requestCameraPermission();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen]);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      
      startCamera();
    } catch (error) {
      console.error('Camera permission denied:', error);
      setHasPermission(false);
      toast.error('Camera access denied. Please allow camera access to scan barcodes.');
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          deviceId: cameras[currentCameraIndex]?.deviceId,
          facingMode: cameras.length > 0 ? undefined : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        
        // Start scanning for barcodes
        scanIntervalRef.current = setInterval(scanForBarcode, 500);
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast.error('Failed to start camera');
    }
  };

  const scanForBarcode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Use ZXing library for barcode detection
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();
      
      // Create a data URL from the canvas
      const dataUrl = canvas.toDataURL('image/png');
      const result = await codeReader.decodeFromImage(dataUrl);
      
      if (result) {
        const detectedCode = result.getText();
        console.log('Barcode detected:', detectedCode);
        
        // Check if it's a valid EAN (8 or 13 digits)
        if (/^\d{8}$|^\d{13}$/.test(detectedCode)) {
          setIsScanning(false);
          cleanup();
          onEanDetected(detectedCode);
          onClose();
          toast.success(`EAN code scanned: ${detectedCode}`);
        } else {
          toast.error('Invalid EAN code format. Please scan a valid EAN barcode.');
        }
      }
    } catch (error) {
      // Silently continue scanning if no barcode is detected
    }
  };

  const switchCamera = () => {
    if (cameras.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan EAN Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasPermission === null && (
            <div className="text-center py-8">
              <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600">Requesting camera permission...</p>
            </div>
          )}

          {hasPermission === false && (
            <div className="text-center py-8">
              <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Camera Access Required</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please allow camera access to scan EAN barcodes.
              </p>
              <Button onClick={requestCameraPermission} className="mb-2">
                <Camera className="h-4 w-4 mr-2" />
                Allow Camera Access
              </Button>
            </div>
          )}

          {hasPermission === true && (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-24 border-2 border-blue-500 rounded-lg bg-transparent">
                      <div className="w-full h-full border border-blue-300 border-dashed rounded-lg animate-pulse" />
                    </div>
                  </div>
                )}

                <div className="absolute top-2 right-2 flex gap-2">
                  {cameras.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={switchCamera}
                      className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Position the EAN barcode within the frame to scan
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports EAN-8 and EAN-13 barcodes
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};