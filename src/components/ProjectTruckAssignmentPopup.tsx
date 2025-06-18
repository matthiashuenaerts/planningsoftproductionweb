
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ProjectTruckAssignmentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onTruckAssigned: () => void;
}

export const ProjectTruckAssignmentPopup: React.FC<ProjectTruckAssignmentPopupProps> = ({
  isOpen,
  onClose,
  projectId,
  onTruckAssigned
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Truck</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>Truck assignment functionality will be implemented here.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onTruckAssigned}>
            Assign Truck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
