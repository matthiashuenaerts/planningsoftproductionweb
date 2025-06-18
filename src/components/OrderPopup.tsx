
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface OrderPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onOrderCreated: () => void;
}

export const OrderPopup: React.FC<OrderPopupProps> = ({
  isOpen,
  onClose,
  projectId,
  onOrderCreated
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Order</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>Order creation functionality will be implemented here.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
