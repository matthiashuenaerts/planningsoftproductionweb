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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Generate barcode data - "/" + first 7 digits of project name
  const generateBarcodeData = () => {
    const digits = projectName.replace(/\D/g, ''); // Extract only digits
    const first7Digits = digits.substring(0, 7);
    return `/${first7Digits}`;
  };

  const barcodeData = generateBarcodeData();

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
                  <Copy className="h-4 w-4 mr-2" />
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
              <div className="border border-gray-200 rounded mx-auto inline-block p-4 bg-white">
                <Barcode
                  // @ts-ignore - react-barcode doesn't have official types
                  ref={canvasRef}
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
                />
              </div>
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
