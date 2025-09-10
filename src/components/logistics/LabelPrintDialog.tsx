import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Package } from 'lucide-react';
import { Order, OrderItem } from '@/types/order';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LabelPrintDialogProps {
  order: Order;
  orderItems: OrderItem[];
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectInfo {
  name: string;
  installation_date?: string;
}

export const LabelPrintDialog: React.FC<LabelPrintDialogProps> = ({
  order,
  orderItems,
  isOpen,
  onClose
}) => {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchProjectInfo = async () => {
      if (!order.project_id || !isOpen) return;
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('name, installation_date')
          .eq('id', order.project_id)
          .single();
        
        if (error) throw error;
        setProjectInfo(data);
      } catch (error) {
        console.error('Error fetching project info:', error);
      }
    };

    fetchProjectInfo();
  }, [order.project_id, isOpen]);

  const generateLabelContent = (item: OrderItem) => {
    const installationDate = projectInfo?.installation_date 
      ? new Date(projectInfo.installation_date).toLocaleDateString()
      : 'Not set';
    
    return {
      project: projectInfo?.name || 'Unknown Project',
      articleCode: item.article_code,
      installationDate,
      description: item.description,
      quantity: item.delivered_quantity || item.quantity
    };
  };

  const printLabel = async () => {
    const item = orderItems.find(i => i.id === selectedItem);
    if (!item) {
      toast({
        title: "Error",
        description: "Please select an item to print",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const labelData = generateLabelContent(item);
      
      // Create a printable format for Dymo 89x36mm
      const labelContent = `
        <div style="width: 89mm; height: 36mm; padding: 2mm; font-family: Arial, sans-serif; font-size: 8pt; line-height: 1.2;">
          <div style="font-weight: bold; font-size: 9pt; margin-bottom: 1mm;">${labelData.project}</div>
          <div style="margin-bottom: 1mm;">Article: ${labelData.articleCode}</div>
          <div style="margin-bottom: 1mm;">Qty: ${labelData.quantity}</div>
          <div style="margin-bottom: 1mm;">Install: ${labelData.installationDate}</div>
        </div>
      `;

      // Open print dialog with label content
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Dymo Label Print</title>
              <style>
                @page {
                  size: 89mm 36mm;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  width: 89mm;
                  height: 36mm;
                }
              </style>
            </head>
            <body>
              ${labelContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }

      toast({
        title: "Label Sent to Printer",
        description: "Label has been sent to your default printer",
      });

      onClose();
    } catch (error) {
      console.error('Error printing label:', error);
      toast({
        title: "Print Error",
        description: "Failed to print label. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedItemData = orderItems.find(item => item.id === selectedItem);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Delivery Label
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2 text-sm">
              <div><strong>Project:</strong> {projectInfo?.name || 'Loading...'}</div>
              <div><strong>Installation Date:</strong> {projectInfo?.installation_date ? new Date(projectInfo.installation_date).toLocaleDateString() : 'Not set'}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-select">Select Item to Print</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item..." />
              </SelectTrigger>
              <SelectContent>
                {orderItems
                  .filter(item => (item.delivered_quantity || 0) > 0)
                  .map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.article_code} - {item.description} (Qty: {item.delivered_quantity || item.quantity})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItemData && (
            <div className="p-3 border rounded-lg bg-blue-50">
              <div className="text-sm font-medium text-blue-900 mb-2">Label Preview:</div>
              <div className="text-xs space-y-1 text-blue-800">
                <div><strong>{projectInfo?.name}</strong></div>
                <div>Article: {selectedItemData.article_code}</div>
                <div>Qty: {selectedItemData.delivered_quantity || selectedItemData.quantity}</div>
                <div>Install: {projectInfo?.installation_date ? new Date(projectInfo.installation_date).toLocaleDateString() : 'Not set'}</div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={printLabel}
              disabled={!selectedItem || isLoading}
            >
              <Package className="h-4 w-4 mr-2" />
              {isLoading ? 'Printing...' : 'Print Label'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};