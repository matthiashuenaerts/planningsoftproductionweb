
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode.react';
import { Accessory, accessoriesService } from '@/services/accessoriesService';
import { ArrowLeft, ArrowRight, MapPin, Hash, Truck, QrCode, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ProductImageDisplay } from '@/components/ProductImageDisplay';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [localAccessories, setLocalAccessories] = useState<Accessory[]>(accessories);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      setCurrentIndex(startIndex);
    }
  }, [startIndex, open]);

  useEffect(() => {
    setLocalAccessories(accessories);
  }, [accessories]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % localAccessories.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + localAccessories.length) % localAccessories.length);
  };

  const accessory = localAccessories[currentIndex];

  const getStatusColor = (status: Accessory['status']) => {
    switch (status) {
      case 'in_stock':
      case 'delivered':
        return 'bg-emerald-50 dark:bg-emerald-950/30';
      case 'to_order':
        return 'bg-red-50 dark:bg-red-950/30';
      case 'ordered':
        return 'bg-blue-50 dark:bg-blue-950/30';
      case 'to_check':
        return 'bg-amber-50 dark:bg-amber-950/30';
      default:
        return '';
    }
  };

  const getStatusBadgeVariant = (status: Accessory['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'in_stock':
      case 'delivered':
        return 'default';
      case 'to_order':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleStatusUpdate = async (accessoryId: string, newStatus: Accessory['status'], quantityToUpdate: number) => {
    const accessoryToUpdate = localAccessories.find(a => a.id === accessoryId);
    if (!accessoryToUpdate) return;

    setLoading(true);

    try {
        const updatedAccessories = [...localAccessories];
        const accessoryIndex = updatedAccessories.findIndex(a => a.id === accessoryId);
        
        if (newStatus === 'to_order' && quantityToUpdate > 0 && quantityToUpdate < accessoryToUpdate.quantity) {
            updatedAccessories[accessoryIndex] = {
                ...accessoryToUpdate,
                quantity: accessoryToUpdate.quantity - quantityToUpdate,
            };
            
            const newAccessory = {
                ...accessoryToUpdate,
                id: `temp-${Date.now()}`,
                quantity: quantityToUpdate,
                status: 'to_order' as const,
            };
            updatedAccessories.push(newAccessory);
            
            setLocalAccessories(updatedAccessories);
            
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
            updatedAccessories[accessoryIndex] = {
                ...accessoryToUpdate,
                status: newStatus,
            };
            setLocalAccessories(updatedAccessories);
            
            await accessoriesService.update(accessoryToUpdate.id, { status: newStatus });
            toast({ title: "Success", description: "Accessory status updated successfully" });
        }
        onAccessoryUpdate();
    } catch (error: any) {
        setLocalAccessories(accessories);
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

  const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium break-words min-w-0">{value}</span>
    </div>
  );

  const StatusDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs capitalize rounded-lg" disabled={loading}>
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
  );

  const NavigationBar = () => (
    <div className="flex items-center justify-between pt-2">
      <Button onClick={handlePrevious} variant="ghost" size="sm" disabled={loading} className="h-8 rounded-lg active:scale-[0.97] transition-transform">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Prev
      </Button>
      <span className="text-xs text-muted-foreground font-medium">{currentIndex + 1} / {localAccessories.length}</span>
      <Button onClick={handleNext} variant="ghost" size="sm" disabled={loading} className="h-8 rounded-lg active:scale-[0.97] transition-transform">
        Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const ContentBody = () => (
    <div className={cn("space-y-4", isMobile ? "" : "grid md:grid-cols-2 gap-6 space-y-0")}>
      {/* Info section */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold leading-tight">{accessory.article_name}</h3>
          {accessory.article_code && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{accessory.article_code}</p>
          )}
        </div>

        {accessory.article_description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{accessory.article_description}</p>
        )}

        <div className={cn("rounded-lg p-3 space-y-0.5", getStatusColor(accessory.status))}>
          <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Qty" value={String(accessory.quantity)} />
          <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={accessory.stock_location || '-'} />
          <DetailRow icon={<Truck className="h-3.5 w-3.5" />} label="Supplier" value={accessory.supplier || '-'} />
          {accessory.qr_code_text && (
            <DetailRow icon={<QrCode className="h-3.5 w-3.5" />} label="QR" value={accessory.qr_code_text} />
          )}
        </div>

        {accessory.article_code && (
          <ProductImageDisplay articleCode={accessory.article_code} />
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <StatusDropdown />
        </div>
      </div>

      {/* QR Code section */}
      <div className="flex flex-col items-center justify-center">
        <div className="p-3 bg-white rounded-xl shadow-sm border border-border/40">
          {accessory.qr_code_text ? (
            <QRCode value={accessory.qr_code_text} size={isMobile ? 180 : 220} />
          ) : (
            <div className={cn(
              "flex flex-col items-center justify-center text-muted-foreground rounded-lg bg-muted/30",
              isMobile ? "w-[180px] h-[180px]" : "w-[220px] h-[220px]"
            )}>
              <QrCode className="h-8 w-8 mb-2 opacity-30" />
              <span className="text-xs">No QR code</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const mainContent = (
    <>
      <ContentBody />
      <NavigationBar />
    </>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className={cn("rounded-t-2xl max-h-[92vh] overflow-y-auto px-4 pb-6", getStatusColor(accessory.status))}>
            <SheetHeader className="mb-3">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                Accessory Details
              </SheetTitle>
            </SheetHeader>
            {mainContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className={cn("sm:max-w-3xl", getStatusColor(accessory.status))}>
            <DialogHeader>
              <DialogTitle className="text-sm">Accessory QR Code</DialogTitle>
              <DialogDescription className="text-xs">
                Scan the QR code to get accessory details. Use arrows to navigate.
              </DialogDescription>
            </DialogHeader>
            {mainContent}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isToOrderDialogOpen} onOpenChange={setIsToOrderDialogOpen}>
        <DialogContent className={isMobile ? "max-w-[calc(100vw-1.5rem)]" : ""}>
          <DialogHeader>
            <DialogTitle className="text-sm">Quantity to Order</DialogTitle>
            <DialogDescription className="text-xs">
              How many of the {accessory?.quantity} units should be marked as 'to order'?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="quantity_to_order" className="text-xs">Quantity</Label>
            <Input
              id="quantity_to_order"
              type="number"
              min="1"
              max={accessory?.quantity}
              value={quantityToOrder}
              onChange={(e) => setQuantityToOrder(Math.max(1, Math.min(accessory?.quantity || 1, parseInt(e.target.value) || 1)))}
              className="h-9 rounded-lg"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsToOrderDialogOpen(false)} className="h-9 rounded-lg">Cancel</Button>
            <Button onClick={handleConfirmToOrder} disabled={loading} className="h-9 rounded-lg">
              {loading ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
