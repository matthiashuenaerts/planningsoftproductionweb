
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode.react';
import { Accessory, accessoriesService } from '@/services/accessoriesService';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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
  const [editingStatusAccessoryId, setEditingStatusAccessoryId] = useState<string | null>(null);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState<{status: Accessory['status'], quantity: number}>({status: 'to_check', quantity: 1});

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

  const handleStatusUpdate = async (accessoryId: string, newStatus: Accessory['status'], quantityToOrder: number) => {
    const accessoryToUpdate = accessories.find(a => a.id === accessoryId);
    if (!accessoryToUpdate) return;

    setLoading(true);

    try {
        if (newStatus === 'to_order' && quantityToOrder > 0 && quantityToOrder < accessoryToUpdate.quantity) {
            await accessoriesService.update(accessoryToUpdate.id, {
                quantity: accessoryToUpdate.quantity - quantityToOrder,
            });
            const { id, created_at, updated_at, ...restOfAccessory } = accessoryToUpdate;
            await accessoriesService.create({
                ...restOfAccessory,
                project_id: projectId,
                quantity: quantityToOrder,
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
        setEditingStatusAccessoryId(null);
    }
  };

  if (!accessory) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
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
                <Popover 
                    open={editingStatusAccessoryId === accessory.id} 
                    onOpenChange={(isOpen) => {
                        if (isOpen) {
                            setEditingStatusAccessoryId(accessory.id);
                            setStatusUpdateInfo({ status: accessory.status, quantity: 1 });
                        } else {
                            setEditingStatusAccessoryId(null);
                        }
                    }}
                >
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="capitalize">
                            {accessory.status.replace('_', ' ')}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4 space-y-4">
                        <h4 className="font-medium leading-none">Update Status</h4>
                        <div className="space-y-2">
                            <Label>New Status</Label>
                            <Select 
                                value={statusUpdateInfo.status} 
                                onValueChange={(value: Accessory['status']) => setStatusUpdateInfo(prev => ({ ...prev, status: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="to_check">To Check</SelectItem>
                                    <SelectItem value="in_stock">In Stock</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="to_order">To Order</SelectItem>
                                    <SelectItem value="ordered">Ordered</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {statusUpdateInfo.status === 'to_order' && accessory.quantity > 1 && (
                            <div className="space-y-2">
                                <Label htmlFor="quantity_to_order">Quantity to Order</Label>
                                <Input
                                    id="quantity_to_order"
                                    type="number"
                                    min="1"
                                    max={accessory.quantity}
                                    value={statusUpdateInfo.quantity}
                                    onChange={(e) => setStatusUpdateInfo(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                />
                            </div>
                        )}
                        <Button 
                            onClick={() => handleStatusUpdate(accessory.id, statusUpdateInfo.status, statusUpdateInfo.quantity)}
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                    </PopoverContent>
                </Popover>
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
          <Button onClick={handlePrevious} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <span>{currentIndex + 1} / {accessories.length}</span>
          <Button onClick={handleNext} variant="outline">
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
