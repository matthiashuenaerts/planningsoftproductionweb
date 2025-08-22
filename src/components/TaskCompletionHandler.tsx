import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import TaskCompletionChecklistDialog from './TaskCompletionChecklistDialog';
import { checklistService } from '@/services/checklistService';

interface TaskCompletionHandlerProps {
  children: (props: {
    handleTaskCompletion: (taskId: string, standardTaskId?: string, taskName?: string) => Promise<void>;
    checklistDialog: React.ReactNode;
  }) => React.ReactNode;
  onTaskComplete: (taskId: string) => Promise<void>;
}

const TaskCompletionHandler: React.FC<TaskCompletionHandlerProps> = ({
  children,
  onTaskComplete
}) => {
  const [checklistDialogTask, setChecklistDialogTask] = useState<{
    taskId: string;
    standardTaskId: string;
    taskName: string;
  } | null>(null);
  const { toast } = useToast();

  const handleTaskCompletion = async (taskId: string, standardTaskId?: string, taskName?: string) => {
    try {
      // Check if task has checklist items before completing
      if (standardTaskId) {
        const checklistItems = await checklistService.getChecklistItems(standardTaskId);
        
        if (checklistItems.length > 0) {
          // Show checklist dialog
          setChecklistDialogTask({ 
            taskId, 
            standardTaskId, 
            taskName: taskName || 'Task' 
          });
          return; // Don't complete the task yet
        }
      }
      
      // No checklist or empty checklist - proceed with normal completion
      await onTaskComplete(taskId);
    } catch (error) {
      console.error('Error checking checklist items:', error);
      // Continue with normal completion if checklist check fails
      await onTaskComplete(taskId);
    }
  };

  const handleChecklistComplete = async () => {
    if (!checklistDialogTask) return;
    
    try {
      await onTaskComplete(checklistDialogTask.taskId);
      setChecklistDialogTask(null);
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const checklistDialog = checklistDialogTask && (
    <TaskCompletionChecklistDialog
      open={!!checklistDialogTask}
      onOpenChange={(open) => {
        if (!open) setChecklistDialogTask(null);
      }}
      standardTaskId={checklistDialogTask.standardTaskId}
      taskName={checklistDialogTask.taskName}
      onComplete={handleChecklistComplete}
    />
  );

  return (
    <>
      {children({ handleTaskCompletion, checklistDialog })}
    </>
  );
};

export default TaskCompletionHandler;