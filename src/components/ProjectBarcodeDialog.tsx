
import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Barcode as BarcodeIcon, Download, Copy, AlertCircle } from 'lucide-react';
import Barcode from 'react-barcode';

interface ProjectBarcodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export const ProjectBarcodeDialog: React.FC<ProjectBarcodeDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName
}) => {
  const barcodeContainerRef = useRef<HTMLDivElement>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const { toast } = useToast();

  // Generate barcode data - "/" + first 7 digits of project name
  const generateBarcodeData = () => {
    const digits = projectName.replace(/\D/g, ''); // Extract only digits
    const first7Digits = digits.substring(0, 7);
    const barcodeData = `/${first7Digits}`;
    
    // Validate barcode data
    if (first7Digits.length === 0) {
      setBarcodeError('Geen cijfers gevonden in projectnaam');
      return null;
    }
    
    if (first7Digits.length < 3) {
      setBarcodeError('Niet genoeg cijfers voor barcode (minimaal 3 vereist)');
      return null;
    }
    
    setBarcodeError(null);
    return barcodeData;
  };

  const barcodeData = generateBarcodeData();

  // Reset error when dialog opens
  useEffect(() => {
    if (isOpen) {
      setBarcodeError(null);
    }
  }, [isOpen]);

  const handleCopyData = () => {
    if (!barcodeData) return;
    
    navigator.clipboard.writeText(barcodeData);
    toast({
      title: 'Gekopieerd',
      description: 'Barcode data gekopieerd naar klembord'
    });
  };

  const handleDownload = () => {
    if (!barcodeData || !barcodeContainerRef.current) return;
    
    // Wait a bit for the canvas to be rendered
    setTimeout(() => {
      const canvas = barcodeContainerRef.current?.querySelector('canvas');
      if (!canvas) {
        toast({
          title: 'Fout',
          description: 'Kon barcode canvas niet vinden om te downloaden.',
          variant: 'destructive'
        });
        return;
      }
      
      const link = document.createElement('a');
      link.download = `barcode-${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: 'Gedownload',
        description: 'Barcode afbeelding gedownload'
      });
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarcodeIcon className="h-5 w-5" />
            Project Barcode - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barcode</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {barcodeError ? (
                <div className="border border-red-200 rounded p-8 bg-red-50">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">{barcodeError}</p>
                  <p className="text-red-600 text-sm mt-1">
                    Projectnaam: "{projectName}"
                  </p>
                </div>
              ) : barcodeData ? (
                <>
                  <div 
                    ref={barcodeContainerRef} 
                    className="border border-gray-200 rounded mx-auto inline-block p-4 bg-white"
                  >
                    <Barcode
                      value={barcodeData}
                      format="CODE39"
                      renderer="canvas"
                      width={2}
                      height={60}
                      displayValue={true}
                      font="monospace"
                      fontSize={16}
                      textAlign="center"
                      textMargin={2}
                      margin={10}
                      background="#ffffff"
                      lineColor="#000000"
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-gray-600">
                      Barcode waarde: <span className="font-mono font-medium">{barcodeData}</span>
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleCopyData} variant="outline">
                        <Copy className="h-4 w-4 mr-2" />
                        Kopieer Data
                      </Button>
                      <Button onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border border-gray-200 rounded p-8 bg-gray-50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-gray-600">Barcode laden...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
