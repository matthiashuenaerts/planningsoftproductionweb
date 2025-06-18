
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TaskPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phaseId?: string | null;
  onTaskCreated: () => void;
}

export const TaskPopup: React.FC<TaskPopupProps> = ({
  isOpen,
  onClose,
  projectId,
  phaseId,
  onTaskCreated
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>Task creation functionality will be implemented here.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
