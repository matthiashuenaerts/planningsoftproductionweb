import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AlertTriangle, Calendar, User, MapPin, Zap, ImageOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import NewRushOrderForm from '@/components/rush-orders/NewRushOrderForm';

interface BrokenPartDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokenPart: any;
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

export const BrokenPartDetailDialog: React.FC<BrokenPartDetailDialogProps> = ({
  open,
  onOpenChange,
  brokenPart
}) => {
  const [showRushOrderForm, setShowRushOrderForm] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [initialRushOrderValues, setInitialRushOrderValues] = useState<any>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from('broken_parts').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleOpenRushOrderForm = async () => {
    setShowRushOrderForm(true);
  };

  const handleRushOrderSuccess = () => {
    setShowRushOrderForm(false);
    toast({
      title: t('bp_rush_order_created') || "Rush order created",
      description: t('bp_rush_order_created_desc') || "A rush order has been created for this broken part repair.",
    });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!brokenPart) return;
    
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);
    
    const prepareInitialValues = async () => {
      let attachmentFile: File | undefined = undefined;
      
      if (brokenPart.image_path) {
        try {
          const imageUrl = getImageUrl(brokenPart.image_path);
          if (imageUrl) {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const fileName = brokenPart.image_path.split('/').pop() || 'broken-part-image.jpg';
            attachmentFile = new File([blob], fileName, { type: blob.type });
          }
        } catch (error) {
          console.error('Error loading image:', error);
        }
      }

      setInitialRushOrderValues({
        title: `Urgent: Broken part repair - ${brokenPart.projects?.name || 'Project'}`,
        description: `Broken part reported at workstation: ${brokenPart.workstations?.name || 'Unknown'}

Description: ${brokenPart.description}

Reported by: ${brokenPart.employees?.name}
Date: ${brokenPart.created_at ? format(new Date(brokenPart.created_at), 'MMM d, yyyy HH:mm') : 'Unknown'}

This is an urgent repair request for a broken part that is blocking production.`,
        deadline: deadline,
        projectId: brokenPart.project_id || '',
        selectedTasks: [],
        assignedUsers: [],
        attachment: attachmentFile
      });
    };

    prepareInitialValues();
  }, [brokenPart]);

  if (!brokenPart) return null;

  const imageUrl = getImageUrl(brokenPart.image_path);

  const content = (
    <div className={`flex flex-col gap-4 ${isMobile ? '' : 'grid grid-cols-2 gap-6'}`}>
      {/* Image Section */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          {t('bp_image') || 'Image'}
        </h3>
        {imageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border/60">
            <AspectRatio ratio={4/3}>
              {imageError ? (
                <div className="flex flex-col items-center justify-center w-full h-full bg-muted/50">
                  <ImageOff className="h-10 w-10 text-muted-foreground/50" />
                </div>
              ) : (
                <img
                  src={imageUrl}
                  alt={t('broken_parts') || 'Broken part'}
                  className="object-cover w-full h-full"
                  onError={() => setImageError(true)}
                />
              )}
            </AspectRatio>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 bg-muted/30 rounded-xl border border-dashed border-border/60">
            <ImageOff className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">{t('bp_no_image') || 'No image available'}</p>
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('bp_details') || 'Details'}
        </h3>

        <div className="flex flex-col gap-2">
          <DetailRow
            icon={<MapPin className="h-4 w-4" />}
            label={t('bp_project') || 'Project'}
            value={brokenPart.projects?.name || t('bp_not_specified') || 'Not specified'}
          />
          <DetailRow
            icon={<MapPin className="h-4 w-4" />}
            label={t('bp_workstation') || 'Workstation'}
            value={brokenPart.workstations?.name || t('bp_not_specified') || 'Not specified'}
          />
          <DetailRow
            icon={<User className="h-4 w-4" />}
            label={t('bp_reported_by') || 'Reported by'}
            value={brokenPart.employees?.name}
          />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label={t('bp_date_reported') || 'Date reported'}
            value={brokenPart.created_at ? format(new Date(brokenPart.created_at), 'MMM d, yyyy HH:mm') : ''}
          />
        </div>

        {/* Description */}
        <div className="p-3 rounded-xl bg-muted/50">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {t('bp_description') || 'Description'}
          </p>
          <p className="text-sm text-foreground leading-relaxed break-words">
            {brokenPart.description}
          </p>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleOpenRushOrderForm}
          disabled={!currentEmployee}
          className="w-full mt-1 rounded-xl h-11"
          size="lg"
        >
          <Zap className="mr-2 h-4 w-4" />
          {t('bp_send_rush_order') || 'Send to Rush Order'}
        </Button>
      </div>
    </div>
  );

  const titleContent = (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </div>
      <span>{t('broken_part_details') || 'Broken Part Details'}</span>
    </div>
  );

  return (
    <>
      {/* Rush Order Form Dialog */}
      <Dialog open={showRushOrderForm} onOpenChange={setShowRushOrderForm}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('bp_create_rush_from_broken') || 'Create Rush Order from Broken Part'}</DialogTitle>
          </DialogHeader>
          {initialRushOrderValues && (
            <NewRushOrderForm 
              onSuccess={handleRushOrderSuccess} 
              initialValues={initialRushOrderValues}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Main Detail: Sheet on mobile, Dialog on desktop */}
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto px-4 pb-8 pt-4">
            <SheetHeader className="pb-3">
              <SheetTitle>{titleContent}</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{titleContent}</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
