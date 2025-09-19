import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

interface EanBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onEanDetected: (barcode: string) => void;
}

export const EanBarcodeScanner: React.FC<EanBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onEanDetected: onBarcodeDetected
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
        
        // Start scanning for barcodes with higher frequency for automatic detection
        scanIntervalRef.current = setInterval(scanForBarcode, 100);
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
      // Use ZXing library for comprehensive barcode detection
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();
      
      // Try multiple detection methods for better accuracy
      let result = null;
      
      // Method 1: High quality JPEG
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        result = await codeReader.decodeFromImage(dataUrl);
      } catch (e) {
        // Method 2: PNG format
        try {
          const dataUrl = canvas.toDataURL('image/png');
          result = await codeReader.decodeFromImage(dataUrl);
        } catch (e2) {
          // Method 3: Enhanced contrast for difficult barcodes
          const tempCanvas = document.createElement('canvas');
          const tempContext = tempCanvas.getContext('2d');
          if (tempContext) {
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempContext.filter = 'contrast(200%) brightness(120%) grayscale(100%)';
            tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
            const enhancedDataUrl = tempCanvas.toDataURL('image/png');
            result = await codeReader.decodeFromImage(enhancedDataUrl);
          }
        }
      }
      
      if (result) {
        const detectedCode = result.getText();
        const format = result.getBarcodeFormat();
        console.log('Barcode detected:', detectedCode, 'Format:', format);
        
        // Accept any valid barcode with content
        if (detectedCode && detectedCode.length > 0) {
          setIsScanning(false);
          cleanup();
          onBarcodeDetected(detectedCode);
          onClose();
          toast.success(`Barcode scanned: ${detectedCode} (${format})`);
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
            Scan Barcode
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
                Please allow camera access to scan barcodes automatically.
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
                  Position any barcode within the frame for automatic detection
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports EAN, UPC, Code 128, QR codes and more
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};