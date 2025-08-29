import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { AlertTriangle, Calendar, User, MapPin, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useAuth } from '@/context/AuthContext';
import { rushOrderService } from '@/services/rushOrderService';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';

interface BrokenPartDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokenPart: any;
}

export const BrokenPartDetailDialog: React.FC<BrokenPartDetailDialogProps> = ({
  open,
  onOpenChange,
  brokenPart
}) => {
  const [isCreatingRushOrder, setIsCreatingRushOrder] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from('broken_parts').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateRushOrder = async () => {
    if (!currentEmployee || !brokenPart) return;
    
    setIsCreatingRushOrder(true);
    try {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24); // Set deadline to 24 hours from now
      
      const title = `Urgent: Broken part repair - ${brokenPart.projects?.name || 'Project'}`;
      const description = `Broken part reported at workstation: ${brokenPart.workstations?.name || 'Unknown'}

Description: ${brokenPart.description}

Reported by: ${brokenPart.employees?.name}
Date: ${brokenPart.created_at ? format(new Date(brokenPart.created_at), 'MMM d, yyyy HH:mm') : 'Unknown'}

This is an urgent repair request for a broken part that is blocking production.`;

      const rushOrder = await rushOrderService.createRushOrder(
        title,
        description,
        deadline.toISOString(),
        currentEmployee.id,
        undefined, // No attachment for now
        brokenPart.project_id
      );

      if (rushOrder) {
        toast({
          title: "Rush order created",
          description: "A rush order has been created for this broken part repair.",
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error creating rush order:', error);
      toast({
        title: "Error",
        description: "Failed to create rush order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRushOrder(false);
    }
  };

  if (!brokenPart) return null;

  const imageUrl = getImageUrl(brokenPart.image_path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('broken_part_details')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Image */}
          <div className="space-y-4">
            <h3 className="font-medium">Image</h3>
            {imageUrl ? (
              <div className="relative">
                <AspectRatio ratio={4/3}>
                  {imageError ? (
                    <div className="flex items-center justify-center w-full h-full bg-muted rounded-lg">
                      <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt="Broken part"
                      className="object-cover w-full h-full rounded-lg"
                      onError={() => setImageError(true)}
                    />
                  )}
                </AspectRatio>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <p>No image available</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side - Information */}
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">Details</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Project</p>
                    <p className="text-sm text-muted-foreground">
                      {brokenPart.projects?.name || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Workstation</p>
                    <p className="text-sm text-muted-foreground">
                      {brokenPart.workstations?.name || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Reported by</p>
                    <p className="text-sm text-muted-foreground">
                      {brokenPart.employees?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Date reported</p>
                    <p className="text-sm text-muted-foreground">
                      {brokenPart.created_at && format(new Date(brokenPart.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {brokenPart.description}
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleCreateRushOrder}
                disabled={isCreatingRushOrder || !currentEmployee}
                className="w-full"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                {isCreatingRushOrder ? 'Creating Rush Order...' : 'Send to Rush Order'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};