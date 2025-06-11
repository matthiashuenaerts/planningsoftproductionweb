
import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Barcode as BarcodeIcon, Download, Copy } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Generate barcode data - "/" + first 7 digits of project name
  const generateBarcodeData = () => {
    const digits = projectName.replace(/\D/g, ''); // Extract only digits
    const first7Digits = digits.substring(0, 7);
    return `/${first7Digits}`;
  };

  const barcodeData = generateBarcodeData();

  // Simple Code 39 barcode implementation
  const drawBarcode = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 100;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Code 39 character encoding (simplified)
    const code39 = {
      '/': '101001101',
      '0': '101001101',
      '1': '110100101',
      '2': '101100101',
      '3': '110110100',
      '4': '101001110',
      '5': '110100110',
      '6': '101100110',
      '7': '101010011',
      '8': '110101001',
      '9': '101101001',
      '*': '100101101' // Start/stop character
    };

    // Start and end with asterisk
    const fullData = '*' + barcodeData + '*';
    
    let x = 20;
    const barHeight = 60;
    const barWidth = 2;
    const gap = 1;

    ctx.fillStyle = 'black';

    for (let i = 0; i < fullData.length; i++) {
      const char = fullData[i];
      const pattern = code39[char as keyof typeof code39] || code39['0'];
      
      for (let j = 0; j < pattern.length; j++) {
        if (pattern[j] === '1') {
          ctx.fillRect(x, 20, barWidth, barHeight);
        }
        x += barWidth + gap;
      }
      
      // Gap between characters
      x += gap * 2;
    }

    // Draw text below barcode
    ctx.fillStyle = 'black';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(barcodeData, width / 2, height - 10);
  };

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(drawBarcode, 100);
    }
  }, [isOpen, barcodeData]);

  const handleCopyData = () => {
    navigator.clipboard.writeText(barcodeData);
    toast({
      title: 'Copied',
      description: 'Barcode data copied to clipboard'
    });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `barcode-${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
    
    toast({
      title: 'Downloaded',
      description: 'Barcode image downloaded'
    });
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
              <CardTitle className="text-lg">Barcode Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg">{barcodeData}</span>
                <Button variant="outline" size="sm" onClick={handleCopyData}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Code 39 format: "/" + first 7 digits of project name
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barcode</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <canvas
                ref={canvasRef}
                className="border border-gray-200 rounded mx-auto"
                style={{ maxWidth: '100%' }}
              />
              <div className="mt-4">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
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
