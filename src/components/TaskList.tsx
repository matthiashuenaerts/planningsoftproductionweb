
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/services/dataService';
import { Calendar, User, AlertCircle, Zap, Clock, CheckCircle, Pause, Timer, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { TaskCompletionChecklistDialog } from './TaskCompletionChecklistDialog';

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
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [pendingCompletionTask, setPendingCompletionTask] = useState<ExtendedTask | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-blue-500';
      case 'IN_PROGRESS': return 'bg-yellow-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'HOLD': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TODO': return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS': return <AlertCircle className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'HOLD': return <Pause className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
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
      // Show checklist dialog if standard_task_id exists
      if (task.standard_task_id) {
        setPendingCompletionTask(task);
        setChecklistDialogOpen(true);
        return;
      }
      
      setLoadingTasks(prev => new Set(prev).add(task.id));
    }

    await performTaskStatusUpdate(task, newStatus);
  };

  const performTaskStatusUpdate = async (task: ExtendedTask, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (newStatus === 'COMPLETED') {
      setLoadingTasks(prev => new Set(prev).add(task.id));
    }

    try {
      if (onTaskStatusChange) {
        await onTaskStatusChange(task.id, newStatus);
      } else if (onTaskUpdate) {
        const updatedTask = { ...task, status: newStatus };
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

  const handleCompleteWithChecklist = async () => {
    if (pendingCompletionTask) {
      await performTaskStatusUpdate(pendingCompletionTask, 'COMPLETED');
      setPendingCompletionTask(null);
      setChecklistDialogOpen(false);
    }
  };

  const handleCancelCompletion = () => {
    setPendingCompletionTask(null);
    setChecklistDialogOpen(false);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No tasks found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {tasks.map((task) => {
        const isLoading = loadingTasks.has(task.id);
        const isCompleting = completingTasks.has(task.id);
        
        return (
          <Card 
            key={task.id} 
            className={`
              ${task.is_rush_order && showRushOrderBadge ? 'border-red-500 border-2' : ''} 
              ${task.status === 'HOLD' ? 'border-orange-300' : ''} 
              ${compact ? 'p-2' : ''}
              ${isCompleting ? 'animate-pulse bg-green-50 border-green-300' : ''}
              transition-all duration-300
            `}
          >
            <CardHeader className={compact ? "pb-2" : "pb-3"}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {task.project_name && (
                    <CardTitle className={`${compact ? "text-lg" : "text-xl"} text-primary font-bold mb-1`}>
                      {task.project_name}
                    </CardTitle>
                  )}
                  <h4 className={`${compact ? "text-sm" : "text-base"} font-medium text-gray-700`}>
                    {task.title}
                  </h4>
                  
                  {/* Countdown Timer for IN_PROGRESS tasks */}
                  {task.status === 'IN_PROGRESS' && task.timeRemaining && task.total_duration && (
                    <div className={`mt-2 flex items-center gap-2 text-sm font-mono ${task.isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                      <Timer className="h-4 w-4" />
                      <span className={task.isOvertime ? 'font-bold' : ''}>
                        {task.isOvertime ? 'OVERTIME: ' : 'Time remaining: '}
                        {task.timeRemaining}
                      </span>
                    </div>
                  )}

                  {/* Efficiency data for completed tasks */}
                  {showEfficiencyData && task.status === 'COMPLETED' && task.actual_duration_minutes !== undefined && task.efficiency_percentage !== undefined && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          Planned: {formatDuration(task.actual_duration_minutes)}
                          {task.total_duration && ` / Total: ${formatDuration(task.total_duration)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {task.efficiency_percentage >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-medium ${task.efficiency_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {task.efficiency_percentage >= 0 ? '+' : ''}{task.efficiency_percentage}% efficiency
                        </span>
                        <span className="text-xs text-gray-500">
                          ({task.efficiency_percentage >= 0 ? 'faster' : 'slower'} than planned)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {task.is_rush_order && showRushOrderBadge && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Rush Order
                    </Badge>
                  )}
                  <Badge 
                    className={`${getPriorityColor(task.priority)} text-white`}
                  >
                    {task.priority}
                  </Badge>
                  <Badge 
                    className={`${getStatusColor(task.status)} text-white flex items-center gap-1`}
                  >
                    {getStatusIcon(task.status)}
                    {task.status === 'HOLD' ? 'On Hold' : task.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {task.description && !compact && (
                <p className="text-gray-600 mb-4">{task.description}</p>
              )}
              
              {task.status === 'HOLD' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                  <p className="text-orange-800 text-sm flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    This task is on hold because required limit phases are not yet completed.
                  </p>
                </div>
              )}
              
              {!compact && (
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                  {task.status === 'IN_PROGRESS' && task.assignee_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Started by: {task.assignee_name}</span>
                    </div>
                  )}
                  {task.total_duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Duration: {task.total_duration}min</span>
                    </div>
                  )}
                </div>
              )}
              
              {(onTaskUpdate || onTaskStatusChange) && (
                <div className="flex gap-2">
                  {task.status === 'TODO' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange(task, 'IN_PROGRESS')}
                      >
                        Start Task
                      </Button>
                      {showCompleteButton && (
                        <Button 
                          size="sm" 
                          onClick={() => handleStatusChange(task, 'COMPLETED')}
                          className="bg-green-600 hover:bg-green-700 relative"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader className="h-4 w-4 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            'Complete'
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange(task, 'COMPLETED')}
                        className="bg-green-600 hover:bg-green-700 relative"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          'Complete'
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange(task, 'TODO')}
                      >
                        Back to Todo
                      </Button>
                    </>
                  )}
                  {task.status === 'COMPLETED' && task.completed_at && (
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-500">
                        Completed: {new Date(task.completed_at).toLocaleString()}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange(task, 'TODO')}
                      >
                        Back to Todo
                      </Button>
                    </div>
                  )}
                  {task.status === 'HOLD' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled
                      className="opacity-50"
                    >
                      Waiting for Limit Phases
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Task Completion Checklist Dialog */}
      {pendingCompletionTask && (
        <TaskCompletionChecklistDialog
          isOpen={checklistDialogOpen}
          onOpenChange={setChecklistDialogOpen}
          taskId={pendingCompletionTask.id}
          standardTaskId={pendingCompletionTask.standard_task_id || ''}
          taskTitle={pendingCompletionTask.title}
          onComplete={handleCompleteWithChecklist}
          onCancel={handleCancelCompletion}
        />
      )}
    </div>
  );
};

export default TaskList;
