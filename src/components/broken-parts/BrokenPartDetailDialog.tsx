import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { AlertTriangle, Calendar, User, MapPin, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import NewRushOrderForm from '@/components/rush-orders/NewRushOrderForm';

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
  const [showRushOrderForm, setShowRushOrderForm] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [initialRushOrderValues, setInitialRushOrderValues] = useState<any>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from('broken_parts').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleOpenRushOrderForm = async () => {
    // Convert the image to a File object if it exists
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
    
    setShowRushOrderForm(true);
  };

  const handleRushOrderSuccess = () => {
    setShowRushOrderForm(false);
    toast({
      title: "Rush order created",
      description: "A rush order has been created for this broken part repair.",
    });
    onOpenChange(false);
  };

  // Prepare initial values with attachment
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

  return (
    <>
      {/* Rush Order Form Dialog */}
      <Dialog open={showRushOrderForm} onOpenChange={setShowRushOrderForm}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Rush Order from Broken Part</DialogTitle>
          </DialogHeader>
          {initialRushOrderValues && (
            <NewRushOrderForm 
              onSuccess={handleRushOrderSuccess} 
              initialValues={initialRushOrderValues}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Broken Part Detail Dialog */}
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
                onClick={handleOpenRushOrderForm}
                disabled={!currentEmployee}
                className="w-full"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                Send to Rush Order
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};