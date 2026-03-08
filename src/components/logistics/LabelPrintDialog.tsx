import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Order, OrderItem } from '@/types/order';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { t } = useLanguage();
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const itemsWithDelivery = orderItems.map(item => {
    const delivery = itemDeliveries.find(d => d.itemId === item.id);
    const deliveredQuantity = delivery?.deliveredQuantity || (item.delivered_quantity || 0);
    return {
      ...item,
      current_delivered_quantity: deliveredQuantity,
      stock_location: delivery?.stockLocation || item.stock_location
    };
  });

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
        title: t('lp_no_items'),
        description: t('lp_no_items_desc'),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const installationDate = projectInfo?.installation_date
        ? new Date(projectInfo.installation_date).toLocaleDateString()
        : t('lp_not_set');

      const currentDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const allLabelsContent = deliveredItems.map(item => `
        <div style="
          width: 89mm; height: 32mm; padding: 1.5mm; font-family: Arial, sans-serif;
          line-height: 1.1; page-break-after: always; box-sizing: border-box;
          display: flex; flex-direction: column; justify-content: space-between;
        ">
          <div style="width: 100%; text-align: center; font-weight: bold;
            font-size: clamp(10pt, 5vw, 16pt); line-height: 1.1;
            word-wrap: break-word; overflow-wrap: break-word; margin-bottom: 1mm; white-space: normal;">
            ${projectInfo?.name || 'Unknown Project'}
          </div>
          ${item.stock_location ? `
          <div style="font-weight: bold; font-size: 14pt; text-align: center;
            border: 1px solid #ccc; padding: 1mm; background: #f0f0f0; margin-bottom: 1mm;">
            ${item.stock_location}
          </div>` : ''}
          <div style="font-size: 8pt; display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
            <div>Art: ${item.article_code}</div>
            <div>${t('lp_qty')}: ${item.current_delivered_quantity}</div>
          </div>
          <div style="font-size: 8pt; display: flex; justify-content: space-between;">
            <div>${t('lp_completed')}: ${currentDate}</div>
            <div>${t('lp_install')}: ${installationDate}</div>
          </div>
          <div style="font-size: 8pt; text-align: right; margin-top: 1mm;
            border-top: 1px solid #ccc; padding-top: 0.5mm;">
            ${order.supplier || ''}
          </div>
        </div>
      `).join('');

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Dymo Label Print - ${deliveredItems.length} Labels</title>
              <style>
                @page { size: 89mm 35mm; margin: 0; }
                body { margin: 0; padding: 0; width: 89mm; }
                .label { width: 89mm; height: 32mm; page-break-after: always; }
                .label:last-child { page-break-after: auto; }
              </style>
            </head>
            <body>${allLabelsContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }

      toast({
        title: t('lp_sent_to_printer'),
        description: (t('lp_sent_desc') || '').replace('{{count}}', String(deliveredItems.length)),
      });

      onClose();
    } catch (error) {
      console.error('Error printing labels:', error);
      toast({
        title: t('lp_print_error'),
        description: t('lp_print_error_desc'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {t('lp_print_labels')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2 text-sm">
              <div><strong>{t('lp_project')}:</strong> {projectInfo?.name || t('lp_loading')}</div>
              <div><strong>{t('lp_installation_date')}:</strong> {projectInfo?.installation_date ? new Date(projectInfo.installation_date).toLocaleDateString() : t('lp_not_set')}</div>
            </div>
          </div>

          <div>
            <p className="text-sm mb-3">
              {(t('lp_print_question') || '').replace('{{count}}', String(deliveredItems.length))}
            </p>

            <div className="space-y-2">
              {deliveredItems.map((item) => (
                <div key={item.id} className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 truncate">{item.description}</div>
                  <div className="text-xs text-blue-700">
                    {t('lp_article')}: {item.article_code} • {t('lp_qty')}: {item.current_delivered_quantity}
                    {item.stock_location && ` • ${t('lp_location')}: ${item.stock_location}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('lp_no_skip')}
            </Button>
            <Button
              onClick={printLabels}
              disabled={deliveredItems.length === 0 || isLoading}
              size="sm"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isLoading ? t('lp_printing') : t('lp_yes_print')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
