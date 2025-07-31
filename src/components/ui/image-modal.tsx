import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface ImageModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  imageUrl?: string;
  title?: string;
  websiteLink?: string | null;
  // Legacy props for backward compatibility
  src?: string;
  alt?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  open,
  onOpenChange,
  imageUrl,
  title,
  websiteLink,
  // Legacy props
  src,
  alt,
  isOpen,
  onClose
}) => {
  // Support both new and legacy prop formats
  const modalOpen = open ?? isOpen ?? false;
  const modalOnOpenChange = onOpenChange ?? ((open: boolean) => !open && onClose?.());
  const modalImageUrl = imageUrl ?? src ?? '';
  const modalTitle = title ?? alt ?? '';
  
  if (!modalImageUrl) return null;
  return (
    <Dialog open={modalOpen} onOpenChange={modalOnOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{modalTitle}</DialogTitle>
            {websiteLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(websiteLink, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Website
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex justify-center">
          <img
            src={modalImageUrl}
            alt={modalTitle}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};