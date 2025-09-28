import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/services/dataService';
import { Calendar, User, AlertCircle, Zap, Clock, CheckCircle, Pause, Timer, Loader, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { differenceInDays, isBefore } from 'date-fns';
import TaskCompletionChecklistDialog from './TaskCompletionChecklistDialog';
import { checklistService } from '@/services/checklistService';
interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  actual_duration_minutes?: number;
  efficiency_percentage?: number;
  total_duration?: number;
}
interface TaskListProps {
  tasks: ExtendedTask[];
  onTaskUpdate?: (task: ExtendedTask) => void;
  showRushOrderBadge?: boolean;
  title?: string;
  compact?: boolean;
  showCountdownTimer?: boolean;
  showCompleteButton?: boolean;
  showEfficiencyData?: boolean;
  onTaskStatusChange?: (taskId: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => Promise<void>;
}
const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onTaskUpdate,
  showRushOrderBadge = false,
  title,
  compact = false,
  showCountdownTimer = false,
  showCompleteButton = false,
  showEfficiencyData = false,
  onTaskStatusChange
}) => {
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [checklistDialogTask, setChecklistDialogTask] = useState<{
    taskId: string;
    standardTaskId: string;
    taskName: string;
  } | null>(null);
  const getUrgencyClass = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = differenceInDays(due, today);
    if (isBefore(due, today)) {
      return {
        class: 'overdue',
        label: 'Overdue',
        variant: 'destructive' as const
      };
    } else if (daysUntilDue <= 1) {
      return {
        class: 'critical',
        label: 'Critical',
        variant: 'destructive' as const
      };
    } else if (daysUntilDue <= 3) {
      return {
        class: 'urgent',
        label: 'Urgent',
        variant: 'default' as const
      };
    } else if (daysUntilDue <= 7) {
      return {
        class: 'high',
        label: 'High',
        variant: 'secondary' as const
      };
    } else {
      return {
        class: 'normal',
        label: 'Normal',
        variant: 'outline' as const
      };
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-blue-500';
      case 'IN_PROGRESS':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'HOLD':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TODO':
        return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS':
        return <AlertCircle className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      case 'HOLD':
        return <Pause className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  const handleStatusChange = async (task: ExtendedTask, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (newStatus === 'COMPLETED') {
      // Check if task has a standard_task_id and checklist items before completing
      if (task.standard_task_id) {
        try {
          const checklistItems = await checklistService.getChecklistItems(task.standard_task_id);
          if (checklistItems.length > 0) {
            // Show checklist dialog - user must complete checklist before task completion
            setChecklistDialogTask({
              taskId: task.id,
              standardTaskId: task.standard_task_id,
              taskName: task.title
            });
            return; // Don't complete the task yet - wait for checklist completion
          }
        } catch (error) {
          console.error('Error checking checklist items:', error);
          // Continue with normal completion if checklist check fails
        }
      }

      // No checklist or empty checklist - proceed with normal completion
      setLoadingTasks(prev => new Set(prev).add(task.id));
    }
    try {
      if (onTaskStatusChange) {
        await onTaskStatusChange(task.id, newStatus);
      } else if (onTaskUpdate) {
        const updatedTask = {
          ...task,
          status: newStatus
        };
        if (newStatus === 'COMPLETED') {
          updatedTask.completed_at = new Date().toISOString();
        }
        onTaskUpdate(updatedTask);
      }
      if (newStatus === 'COMPLETED') {
        // Show completion animation
        setLoadingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.id);
          return newSet;
        });
        setCompletingTasks(prev => new Set(prev).add(task.id));

        // Remove completion animation after 1 second
        setTimeout(() => {
          setCompletingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(task.id);
            return newSet;
          });
        }, 1000);
      }
    } catch (error) {
      // Remove loading state on error
      if (newStatus === 'COMPLETED') {
        setLoadingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(task.id);
          return newSet;
        });
      }
      throw error;
    }
  };
  const handleChecklistComplete = async () => {
    if (!checklistDialogTask) return;
    try {
      setLoadingTasks(prev => new Set(prev).add(checklistDialogTask.taskId));
      if (onTaskStatusChange) {
        await onTaskStatusChange(checklistDialogTask.taskId, 'COMPLETED');
      } else if (onTaskUpdate) {
        const task = tasks.find(t => t.id === checklistDialogTask.taskId);
        if (task) {
          const updatedTask = {
            ...task,
            status: 'COMPLETED' as const,
            completed_at: new Date().toISOString()
          };
          onTaskUpdate(updatedTask);
        }
      }

      // Show completion animation
      setLoadingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(checklistDialogTask.taskId);
        return newSet;
      });
      setCompletingTasks(prev => new Set(prev).add(checklistDialogTask.taskId));

      // Remove completion animation after 1 second
      setTimeout(() => {
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(checklistDialogTask.taskId);
          return newSet;
        });
      }, 1000);
      setChecklistDialogTask(null);
    } catch (error) {
      console.error('Error completing task:', error);
      setLoadingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(checklistDialogTask.taskId);
        return newSet;
      });
    }
  };
  if (tasks.length === 0) {
    return <div className="text-center text-gray-500 py-8">
        No tasks found
      </div>;
  }
  return;
};
export default TaskList;