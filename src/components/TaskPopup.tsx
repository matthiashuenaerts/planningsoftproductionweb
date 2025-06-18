
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
          {phaseId && <p className="text-sm text-gray-600">Phase ID: {phaseId}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onTaskCreated}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
