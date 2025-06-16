
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Edit, X } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

interface OrderPopupProps {
  order: any;
  onClose: () => void;
  onEdit: (order: any) => void;
}

const OrderPopup: React.FC<OrderPopupProps> = ({ order, onClose, onEdit }) => {
  const { t } = useLanguage();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t('order_details')} - {order.supplier}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">{t('supplier')}</label>
              <p className="font-semibold">{order.supplier}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('order_type')}</label>
              <p className="font-semibold">{order.order_type}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('order_date')}</label>
              <p>{format(new Date(order.order_date), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('expected_delivery')}</label>
              <p>{format(new Date(order.expected_delivery), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('status')}</label>
              <p className="capitalize">{order.status}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('items_count')}</label>
              <p>{order.order_items_count || 0} {t('items')}</p>
            </div>
          </div>
          
          {order.notes && (
            <div>
              <label className="text-sm font-medium text-gray-500">{t('notes')}</label>
              <p className="mt-1 text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onEdit(order)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderPopup;
