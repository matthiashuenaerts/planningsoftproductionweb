
import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Barcode as BarcodeIcon, Download, Copy } from 'lucide-react';
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
  const { toast } = useToast();

  // Generate barcode data - "/" + first 7 digits of project name
  const generateBarcodeData = () => {
    const digits = projectName.replace(/\D/g, ''); // Extract only digits
    const first7Digits = digits.substring(0, 7);
    
    // If we don't have enough digits, pad with zeros or use project ID
    if (first7Digits.length < 7) {
      const projectIdDigits = projectId.replace(/\D/g, '');
      const combinedDigits = (first7Digits + projectIdDigits).substring(0, 7);
      return `/${combinedDigits.padEnd(7, '0')}`;
    }
    
    return `/${first7Digits}`;
  };

  const barcodeData = generateBarcodeData();

  const handleCopyData = () => {
    navigator.clipboard.writeText(barcodeData);
    toast({
      title: 'Gekopieerd',
      description: 'Barcode data gekopieerd naar klembord'
    });
  };

  const handleDownload = () => {
    if (!barcodeContainerRef.current) return;
    
    const canvas = barcodeContainerRef.current.querySelector('canvas');
    if (!canvas) {
      toast({
        title: 'Fout',
        description: 'Kan barcode canvas niet vinden om te downloaden.',
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg leading-tight break-words">
            <BarcodeIcon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            Project Barcode - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="px-3 py-2 sm:px-6 sm:py-4">
              <CardTitle className="text-base sm:text-lg">Barcode</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-2 sm:px-6">
              <div ref={barcodeContainerRef} className="border border-gray-200 rounded mx-auto inline-block p-2 sm:p-4 bg-white overflow-x-auto max-w-full">
                <Barcode
                  value={barcodeData}
                  format="CODE39"
                  renderer="canvas"
                  width={1.5}
                  height={50}
                  displayValue={true}
                  font="monospace"
                  fontSize={12}
                  textAlign="center"
                  textMargin={2}
                  margin={6}
                  background="#ffffff"
                  lineColor="#000000"
                />
              </div>
              <div className="mt-3 sm:mt-4 flex gap-2 justify-center flex-wrap">
                <Button onClick={handleCopyData} variant="outline" size="sm" className="text-xs sm:text-sm">
                  <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                  Kopieer Data
                </Button>
                <Button onClick={handleDownload} size="sm" className="text-xs sm:text-sm">
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                  Download PNG
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
