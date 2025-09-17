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

interface ItemDelivery {
  itemId: string;
  deliveredQuantity: number;
  stockLocation: string;
  isFullyDelivered: boolean;
  notDeliveredQuantity: number;
}

interface LabelPrintDialogProps {
  order: Order;
  orderItems: OrderItem[];
  itemDeliveries?: ItemDelivery[];
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
  itemDeliveries = [],
  isOpen,
  onClose
}) => {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Create items with delivery information
  const itemsWithDelivery = orderItems.map(item => {
    const delivery = itemDeliveries.find(d => d.itemId === item.id);
    const deliveredQuantity = delivery?.deliveredQuantity || (item.delivered_quantity || 0);
    
    return {
      ...item,
      current_delivered_quantity: deliveredQuantity,
      stock_location: delivery?.stockLocation || item.stock_location
    };
  });

  // Filter only items that have been delivered (either from current session or previously)
  const deliveredItems = itemsWithDelivery.filter(item => item.current_delivered_quantity > 0);

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

      // Create all label content in a single document
      const currentDate = new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });

      const allLabelsContent = deliveredItems.map(item => `
        <div style="width: 89mm; height: 32mm; padding: 1.5mm; font-family: Arial, sans-serif; line-height: 1.1; page-break-after: always; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
            <div style="font-weight: bold; font-size: 9pt;">${projectInfo?.name || 'Unknown Project'}</div>
            <div style="font-size: 8pt;">${order.supplier}</div>
          </div>
          
          ${item.stock_location ? `
          <div style="font-weight: bold; font-size: 14pt; text-align: center; margin: 1mm 0; border: 1px solid #ccc; padding: 1mm; background: #f0f0f0;">
            ${item.stock_location}
          </div>
          ` : ''}
          
          <div style="display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 0.5mm;">
            <div>Art: ${item.article_code}</div>
            <div>Qty: ${item.current_delivered_quantity}</div>
          </div>
          
          <div style="display: flex; justify-content: space-between; font-size: 8pt;">
            <div>Completed: ${currentDate}</div>
            <div>Install: ${installationDate}</div>
          </div>
        </div>
      `).join('');

      // Open single print window with all labels
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Dymo Label Print - ${deliveredItems.length} Labels</title>
              <style>
                @page {
                  size: 89mm 35mm;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  width: 89mm;
                }
                .label {
                  width: 89mm;
                  height: 32mm;
                  page-break-after: always;
                }
                .label:last-child {
                  page-break-after: auto;
                }
              </style>
            </head>
            <body>
              ${allLabelsContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
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
                    Article: {item.article_code} • Qty: {item.current_delivered_quantity}
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
