
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
      </DialogContent>
    </Dialog>
  );
};
