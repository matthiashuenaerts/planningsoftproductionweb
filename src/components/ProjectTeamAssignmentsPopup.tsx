
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProjectTeamAssignmentsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onTeamAssigned: () => void;
}

export const ProjectTeamAssignmentsPopup: React.FC<ProjectTeamAssignmentsPopupProps> = ({
  isOpen,
  onClose,
  projectId,
  onTeamAssigned
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Team</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>Team assignment functionality will be implemented here.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
