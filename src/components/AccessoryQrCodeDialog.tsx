import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode.react';
import { Accessory, accessoriesService } from '@/services/accessoriesService';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AccessoryQrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessories: Accessory[];
  startIndex?: number;
  projectId: string;
  onAccessoryUpdate: () => void;
}

export const AccessoryQrCodeDialog = ({ open, onOpenChange, accessories, startIndex = 0, projectId, onAccessoryUpdate }: AccessoryQrCodeDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isToOrderDialogOpen, setIsToOrderDialogOpen] = useState(false);
  const [quantityToOrder, setQuantityToOrder] = useState(1);

  useEffect(() => {
    if (open) {
      setCurrentIndex(startIndex);
    }
  }, [startIndex, open]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % accessories.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + accessories.length) % accessories.length);
  };

  const accessory = accessories[currentIndex];

  const getDialogClassName = (status: Accessory['status']) => {
    switch (status) {
      case 'in_stock':
      case 'delivered':
        return 'bg-green-50';
      case 'to_order':
        return 'bg-red-50';
      case 'ordered':
        return 'bg-blue-50';
      case 'to_check':
        return 'bg-yellow-50';
      default:
        return '';
    }
  };

  const handleStatusUpdate = async (accessoryId: string, newStatus: Accessory['status'], quantityToUpdate: number) => {
    const accessoryToUpdate = accessories.find(a => a.id === accessoryId);
    if (!accessoryToUpdate) return;

    setLoading(true);

    try {
        if (newStatus === 'to_order' && quantityToUpdate > 0 && quantityToUpdate < accessoryToUpdate.quantity) {
            await accessoriesService.update(accessoryToUpdate.id, {
                quantity: accessoryToUpdate.quantity - quantityToUpdate,
            });
            const { id, created_at, updated_at, ...restOfAccessory } = accessoryToUpdate;
            await accessoriesService.create({
                ...restOfAccessory,
                project_id: projectId,
                quantity: quantityToUpdate,
                status: 'to_order',
            });
            toast({ title: "Success", description: "Accessory status updated and new 'to order' item created." });
        } else {
            await accessoriesService.update(accessoryToUpdate.id, { status: newStatus });
            toast({ title: "Success", description: "Accessory status updated successfully" });
        }
        onAccessoryUpdate();
    } catch (error: any) {
        toast({ title: "Error", description: `Failed to update status: ${error.message}`, variant: "destructive" });
    } finally {
        setLoading(false);
        setIsToOrderDialogOpen(false);
    }
  };
  
  const handleStatusSelect = (newStatus: Accessory['status']) => {
    if (!accessory) return;
    if (newStatus === 'to_order' && accessory.quantity > 1) {
      setQuantityToOrder(1);
      setIsToOrderDialogOpen(true);
    } else {
      handleStatusUpdate(accessory.id, newStatus, accessory.quantity);
    }
  };

  const handleConfirmToOrder = () => {
    if (!accessory) return;
    handleStatusUpdate(accessory.id, 'to_order', quantityToOrder);
  };

  if (!accessory) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("sm:max-w-4xl", getDialogClassName(accessory.status))}>
          <DialogHeader>
            <DialogTitle>Accessory QR Code</DialogTitle>
            <DialogDescription>
              Scan the QR code to get accessory details. Use arrows to navigate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-8 py-4">
            <div className="text-left space-y-2">
              <h3 className="text-xl font-semibold">{accessory.article_name}</h3>
              <p className="text-base text-muted-foreground">{accessory.article_code}</p>
              <p className="text-base">{accessory.article_description}</p>
              <p className="text-base">Quantity: {accessory.quantity}</p>
              <p className="text-base">Location: {accessory.stock_location || '-'}</p>
              <p className="text-base">Supplier: {accessory.supplier || '-'}</p>
              <p className="text-base">QR Text: {accessory.qr_code_text || '-'}</p>
              <div className="flex items-center gap-2 pt-2">
                  <p className="text-base">Status:</p>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="capitalize w-32 justify-start" disabled={loading}>
                              {loading ? '...' : accessory.status.replace(/_/g, ' ')}
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => handleStatusSelect('to_check')}>To Check</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusSelect('in_stock')}>In Stock</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusSelect('delivered')}>Delivered</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusSelect('ordered')}>Ordered</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleStatusSelect('to_order')}>To Order</DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                {accessory.qr_code_text ? (
                  <QRCode value={accessory.qr_code_text} size={256} />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg">
                    No QR code text provided.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button onClick={handlePrevious} variant="outline" disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <span>{currentIndex + 1} / {accessories.length}</span>
            <Button onClick={handleNext} variant="outline" disabled={loading}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isToOrderDialogOpen} onOpenChange={setIsToOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantity to Order</DialogTitle>
            <DialogDescription>
              How many of the {accessory?.quantity} units of {accessory?.article_name} should be marked as 'to order'?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="quantity_to_order">Quantity to Order</Label>
            <Input
              id="quantity_to_order"
              type="number"
              min="1"
              max={accessory?.quantity}
              value={quantityToOrder}
              onChange={(e) => setQuantityToOrder(Math.max(1, Math.min(accessory?.quantity || 1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsToOrderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmToOrder} disabled={loading}>
              {loading ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
