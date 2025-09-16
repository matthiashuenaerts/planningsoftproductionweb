import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface TaskExtraTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extraMinutes: number) => void;
  taskTitle: string;
  overTimeMinutes: number;
}

const TaskExtraTimeDialog: React.FC<TaskExtraTimeDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  overTimeMinutes
}) => {
  const extraTimeOptions = [30, 60, 90, 120, 150];

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Task Exceeded Expected Time</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-medium text-sm">"{taskTitle}"</p>
            <p>
              This task went over the expected time by{' '}
              <span className="font-semibold text-destructive">
                {formatTime(overTimeMinutes)}
              </span>.
            </p>
            <p>How much extra time should be allocated for this task in the future?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid grid-cols-2 gap-2 my-4">
          {extraTimeOptions.map((minutes) => (
            <Button
              key={minutes}
              variant="outline"
              className="h-12"
              onClick={() => onConfirm(minutes)}
            >
              +{formatTime(minutes)}
            </Button>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Skip
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TaskExtraTimeDialog;