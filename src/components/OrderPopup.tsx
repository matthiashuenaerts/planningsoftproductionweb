
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onOrderCreated}>
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
