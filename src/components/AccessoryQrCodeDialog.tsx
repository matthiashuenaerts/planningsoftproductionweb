
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode.react';
import { Accessory } from '@/services/accessoriesService';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface AccessoryQrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessories: Accessory[];
  startIndex?: number;
}

export const AccessoryQrCodeDialog = ({ open, onOpenChange, accessories, startIndex = 0 }: AccessoryQrCodeDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

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

  if (!accessory) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Accessory QR Code</DialogTitle>
          <DialogDescription>
            Scan the QR code to get accessory details. Use arrows to navigate.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg">
            {accessory.qr_code_text ? (
              <QRCode value={accessory.qr_code_text} size={256} />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg">
                No QR code text provided.
              </div>
            )}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">{accessory.article_name}</h3>
            <p className="text-sm text-muted-foreground">{accessory.article_code}</p>
            <p className="text-sm">{accessory.article_description}</p>
            <p className="text-sm">Quantity: {accessory.quantity}</p>
            <p className="text-sm">Location: {accessory.stock_location || '-'}</p>
            <p className="text-sm">Supplier: {accessory.supplier || '-'}</p>
             <p className="text-sm">QR Text: {accessory.qr_code_text || '-'}</p>
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
