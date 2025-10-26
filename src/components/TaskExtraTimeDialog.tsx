import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface TaskExtraTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalMinutes: number) => void;
  taskTitle: string;
  overTimeMinutes: number;
  elapsedMinutes: number;
}

const TaskExtraTimeDialog: React.FC<TaskExtraTimeDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  overTimeMinutes,
  elapsedMinutes
}) => {
  // Generate duration options based on elapsed time, rounded up to nearest 30 min interval
  const baseTime = Math.ceil(elapsedMinutes / 30) * 30;
  const durationOptions = [
    baseTime,
    baseTime + 30,
    baseTime + 60,
    baseTime + 90,
    baseTime + 120
  ];

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Set Task Duration</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-medium text-sm">"{taskTitle}"</p>
            <p>
              This task went over the expected time by{' '}
              <span className="font-semibold text-destructive">
                {formatTime(overTimeMinutes)}
              </span>.
            </p>
            <p className="font-medium">Select the total duration for this task:</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid grid-cols-2 gap-2 my-4">
          {durationOptions.map((minutes) => (
            <Button
              key={minutes}
              variant="outline"
              className="h-12"
              onClick={() => onConfirm(minutes)}
            >
              {formatTime(minutes)}
            </Button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TaskExtraTimeDialog;