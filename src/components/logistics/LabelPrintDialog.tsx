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
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Filter only delivered items
  const deliveredItems = orderItems.filter(item => (item.delivered_quantity || 0) > 0);

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

  const printLabels = async () => {
    if (deliveredItems.length === 0) {
      toast({
        title: "No Items",
        description: "No delivered items to print labels for",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const installationDate = projectInfo?.installation_date 
        ? new Date(projectInfo.installation_date).toLocaleDateString()
        : 'Not set';

      for (const item of deliveredItems) {
        const labelContent = `
          <div style="width: 89mm; height: 32mm; padding: 2mm; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.2;">
            <div style="font-weight: bold; font-size: 11pt; margin-bottom: 1mm;">${projectInfo?.name || 'Unknown Project'}</div>
            <div style="margin-bottom: 1mm;">Article: ${item.article_code}</div>
            <div style="margin-bottom: 1mm;">Qty: ${item.delivered_quantity}</div>
            <div style="margin-bottom: 1mm;">Install: ${installationDate}</div>
            ${item.stock_location ? `<div>Location: ${item.stock_location}</div>` : ''}
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
                    size: 89mm 35mm;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    width: 89mm;
                    height: 35mm;
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
      }

      toast({
        title: "Labels Sent to Printer",
        description: `${deliveredItems.length} label(s) sent to printer`,
      });

      onClose();
    } catch (error) {
      console.error('Error printing labels:', error);
      toast({
        title: "Print Error",
        description: "Failed to print labels. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Delivery Labels
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2 text-sm">
              <div><strong>Project:</strong> {projectInfo?.name || 'Loading...'}</div>
              <div><strong>Installation Date:</strong> {projectInfo?.installation_date ? new Date(projectInfo.installation_date).toLocaleDateString() : 'Not set'}</div>
            </div>
          </div>

          <div>
            <p className="text-sm mb-3">
              Do you want to print labels for the {deliveredItems.length} delivered item(s)?
            </p>
            
            <div className="space-y-2">
              {deliveredItems.map((item) => (
                <div key={item.id} className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">{item.description}</div>
                  <div className="text-xs text-blue-700">
                    Article: {item.article_code} • Qty: {item.delivered_quantity}
                    {item.stock_location && ` • Location: ${item.stock_location}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={onClose}>
              No, Skip
            </Button>
            <Button 
              onClick={printLabels}
              disabled={deliveredItems.length === 0 || isLoading}
            >
              <Printer className="h-4 w-4 mr-2" />
              {isLoading ? 'Printing...' : 'Yes, Print Labels'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
