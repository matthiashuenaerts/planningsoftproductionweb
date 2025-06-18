
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onTeamAssigned}>
            Assign Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
