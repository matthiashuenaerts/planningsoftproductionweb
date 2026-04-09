
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/services/dataService';
import { Calendar, User, AlertCircle, Zap, Clock, CheckCircle, Pause, Timer, Loader, TrendingUp, TrendingDown, AlertTriangle, Users } from 'lucide-react';
import { differenceInDays, isBefore } from 'date-fns';
import TaskCompletionChecklistDialog from './TaskCompletionChecklistDialog';
import TaskExtraTimeDialog from './TaskExtraTimeDialog';
import { checklistService } from '@/services/checklistService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  actual_duration_minutes?: number;
  efficiency_percentage?: number;
  total_duration?: number;
  completed_by_employee?: { name: string };
  started_by_employee?: { name: string };
  is_workstation_task?: boolean;
  estimated_duration?: number;
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
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [checklistDialogTask, setChecklistDialogTask] = useState<{
    taskId: string;
    standardTaskId: string;
    taskName: string;
  } | null>(null);
  const [activeUsersPerTask, setActiveUsersPerTask] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [activeRegistrationsPerTask, setActiveRegistrationsPerTask] = useState<Map<string, { start_time: string; id: string }>>(new Map());
  const [showExtraTimeDialog, setShowExtraTimeDialog] = useState(false);
  const [pendingBackToTodoTask, setPendingBackToTodoTask] = useState<{
    task: ExtendedTask;
    overTimeMinutes: number;
    elapsedMinutes: number;
  } | null>(null);

  // Track active users on tasks via realtime subscription
  useEffect(() => {
    const fetchActiveUsers = async () => {
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length === 0) return;

      const { data, error } = await supabase
        .from('time_registrations')
        .select(`
          id,
          task_id,
          workstation_task_id,
          employee_id,
          start_time,
          employees:employee_id (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .in('task_id', taskIds);

      if (!error && data) {
        const usersMap = new Map<string, Array<{ id: string; name: string }>>();
        const regsMap = new Map<string, { start_time: string; id: string }>();
        data.forEach((reg: any) => {
          const taskId = reg.task_id || reg.workstation_task_id;
          if (taskId) {
            if (!usersMap.has(taskId)) {
              usersMap.set(taskId, []);
            }
            usersMap.get(taskId)!.push({
              id: reg.employees.id,
              name: reg.employees.name
            });
            // Store first registration info per task for timer checks
            if (!regsMap.has(taskId)) {
              regsMap.set(taskId, { start_time: reg.start_time, id: reg.id });
            }
          }
        });
        setActiveUsersPerTask(usersMap);
        setActiveRegistrationsPerTask(regsMap);
      }
    };

    fetchActiveUsers();

    // Set up realtime subscription
    const channel = supabase
      .channel('task-active-users')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_registrations'
        },
        () => {
          fetchActiveUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tasks]);

  const getUrgencyClass = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = differenceInDays(due, today);
    
    if (isBefore(due, today)) {
      return {
        class: 'overdue',
        label: t('urgency_overdue'),
        variant: 'destructive' as const
      };
    } else if (daysUntilDue <= 1) {
      return {
        class: 'critical',
        label: t('urgency_critical'),
        variant: 'destructive' as const
      };
    } else if (daysUntilDue <= 3) {
      return {
        class: 'urgent',
        label: t('urgency_urgent'),
        variant: 'default' as const
      };
    } else if (daysUntilDue <= 7) {
      return {
        class: 'high',
        label: t('tl_urgency_high'),
        variant: 'secondary' as const
      };
    } else {
      return {
        class: 'normal',
        label: t('urgency_normal'),
        variant: 'outline' as const
      };
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

  const handleJoinTask = async (taskId: string) => {
    if (!currentEmployee) {
      toast({
        title: t('error'),
        description: t('tl_no_tasks_found'),
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const currentTask = tasks.find(task => task.id === taskId);
      if (currentTask?.is_workstation_task) {
        await timeRegistrationService.startWorkstationTask(currentEmployee.id, taskId);
        toast({
          title: t('workstation_task_started'),
          description: t('timer_started_ws_desc')
        });
      } else {
        const remainingDuration = currentTask?.duration;
        await timeRegistrationService.startTask(currentEmployee.id, taskId, remainingDuration);
        toast({
          title: t('timer_started'),
          description: t('timer_started_desc')
        });
      }
      // Trigger refresh if callback exists
      if (onTaskUpdate && currentTask) {
        onTaskUpdate(currentTask);
      }
    } catch (error) {
      console.error('Error joining task:', error);
      toast({
        title: t('error'),
        description: t('failed_to_start_timer_error'),
        variant: 'destructive'
      });
    }
  };

  const handleBackToTodo = async (task: ExtendedTask) => {
    // Check if the task has an active registration with negative time
    const regInfo = activeRegistrationsPerTask.get(task.id);
    if (regInfo && task.duration) {
      const start = new Date(regInfo.start_time);
      const now = new Date();
      const elapsedMs = now.getTime() - start.getTime();
      const activeUsers = activeUsersPerTask.get(task.id) || [];
      const adjustedDurationMs = task.duration * 60 * 1000 / Math.max(1, activeUsers.length);
      const remainingMs = adjustedDurationMs - elapsedMs;
      
      if (remainingMs < 0) {
        const overTimeMinutes = Math.floor(Math.abs(remainingMs) / (1000 * 60));
        const actualElapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
        setPendingBackToTodoTask({
          task,
          overTimeMinutes,
          elapsedMinutes: actualElapsedMinutes
        });
        setShowExtraTimeDialog(true);
        return;
      }
    }
    
    // No negative time, proceed normally
    await handleStatusChange(task, 'TODO');
  };

  const handleExtraTimeConfirmForBackToTodo = async (totalMinutes: number) => {
    if (!pendingBackToTodoTask) return;
    const { task } = pendingBackToTodoTask;
    
    try {
      // First stop registrations and update actual duration (handled by stopActiveRegistrationsForTask)
      await timeRegistrationService.stopActiveRegistrationsForTask(task.id);
      
      // Update the task duration for the next session
      await supabase
        .from('tasks')
        .update({ 
          duration: totalMinutes,
          status: 'TODO',
          status_changed_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      toast({
        title: t('task_updated'),
        description: t('task_updated_desc', { status: 'TODO' })
      });
      
      // Trigger refresh
      if (onTaskUpdate) {
        onTaskUpdate({ ...task, status: 'TODO' as any });
      }
      // Also call onTaskStatusChange callback to refresh parent (but skip the default stop logic)
      if (onTaskStatusChange) {
        // We already handled everything, just refresh
        await onTaskStatusChange(task.id, 'TODO');
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    }
    
    setShowExtraTimeDialog(false);
    setPendingBackToTodoTask(null);
  };

  const handleStatusChange = async (task: ExtendedTask, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (newStatus === 'COMPLETED') {
      // Check if multiple users are active on this task
      const activeUsers = activeUsersPerTask.get(task.id) || [];
      if (activeUsers.length > 1) {
        toast({
          title: t('tl_cannot_complete_task'),
          description: t('tl_multiple_users_working', { count: String(activeUsers.length) }),
          variant: 'destructive'
        });
        return;
      }

      // Check if current user is the only active user
      if (activeUsers.length === 1 && currentEmployee && activeUsers[0].id !== currentEmployee.id) {
        toast({
          title: t('tl_cannot_complete_task'),
          description: t('tl_only_active_user_can_complete', { name: activeUsers[0].name }),
          variant: 'destructive'
        });
        return;
      }

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

  const handleChecklistComplete = async () => {
    if (!checklistDialogTask) return;
    
    try {
      setLoadingTasks(prev => new Set(prev).add(checklistDialogTask.taskId));
      
      if (onTaskStatusChange) {
        await onTaskStatusChange(checklistDialogTask.taskId, 'COMPLETED');
      } else if (onTaskUpdate) {
        const task = tasks.find(t => t.id === checklistDialogTask.taskId);
        if (task) {
          const updatedTask = { ...task, status: 'COMPLETED' as const, completed_at: new Date().toISOString() };
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
    return (
      <div className="text-center text-muted-foreground py-8">
        {t('tl_no_tasks_found')}
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {title && <h3 className="text-base sm:text-lg font-semibold">{title}</h3>}
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
              transition-all duration-300 overflow-hidden
            `}
          >
            <CardHeader className={`${compact ? "pb-2" : "pb-2 sm:pb-3"} px-3 sm:px-6 pt-3 sm:pt-6`}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  {task.project_name && (
                    <CardTitle className={`${compact ? "text-base" : "text-base sm:text-xl"} text-primary font-bold mb-0.5 sm:mb-1 truncate`}>
                      {task.project_name}
                    </CardTitle>
                  )}
                  <h4 className={`${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"} font-medium text-gray-700 dark:text-gray-300`}>
                    {task.title}
                  </h4>
                  
                  {/* Active Users Display */}
                  {task.status === 'IN_PROGRESS' && (() => {
                    const activeUsers = activeUsersPerTask.get(task.id) || [];
                    if (activeUsers.length > 0) {
                      return (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm">
                          <Users className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-blue-600 font-medium truncate">
                            {activeUsers.length === 1 ? t('tl_active_users_single') : t('tl_active_users_multi', { count: String(activeUsers.length) })}
                            {activeUsers.map(u => u.name).join(', ')}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Countdown Timer for IN_PROGRESS tasks */}
                  {task.status === 'IN_PROGRESS' && task.timeRemaining && task.total_duration && (
                    <div className={`mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm font-mono ${task.isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                      <Timer className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className={task.isOvertime ? 'font-bold' : ''}>
                        {task.isOvertime ? t('tl_overtime') : t('tl_time_remaining')}
                        {task.timeRemaining}
                      </span>
                    </div>
                  )}

                  {/* Efficiency data for completed tasks */}
                  {showEfficiencyData && task.status === 'COMPLETED' && task.actual_duration_minutes !== undefined && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <Clock className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {task.estimated_duration ? `${t('tl_estimated', { duration: formatDuration(task.estimated_duration) })} / ` : ''}
                          {t('tl_actual', { duration: formatDuration(task.actual_duration_minutes) })}
                        </span>
                      </div>
                      {task.efficiency_percentage !== undefined && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                          {task.efficiency_percentage >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${task.efficiency_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {task.efficiency_percentage >= 0 ? '+' : ''}{t('tl_efficiency', { value: String(task.efficiency_percentage) })}
                          </span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            ({task.efficiency_percentage >= 0 ? t('tl_faster_than_expected') : t('tl_slower_than_expected')})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Badges - horizontal scroll on mobile */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 sm:flex-nowrap">
                  {task.is_rush_order && showRushOrderBadge && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-[10px] sm:text-xs h-5 sm:h-auto">
                      <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      {t('tl_rush_order')}
                    </Badge>
                  )}
                  {task.due_date && (() => {
                    const urgency = getUrgencyClass(task.due_date);
                    return (
                      <Badge variant={urgency.variant} className="flex items-center gap-1 text-[10px] sm:text-xs h-5 sm:h-auto">
                        {urgency.class === 'overdue' && <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        {urgency.label}
                      </Badge>
                    );
                  })()}
                  <Badge 
                    className={`${getStatusColor(task.status)} text-white flex items-center gap-1 text-[10px] sm:text-xs h-5 sm:h-auto`}
                  >
                    {getStatusIcon(task.status)}
                    {task.status === 'HOLD' ? t('tl_on_hold_status') : task.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {!compact && (
                <p className="text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-4">
                  {task.estimated_duration && t('tl_duration_label', { duration: String(task.estimated_duration) })}
                  {task.actual_duration_minutes != null && task.actual_duration_minutes > 0 && (
                    <> · {t('tl_actual', { duration: formatDuration(task.actual_duration_minutes) })}</>
                  )}
                  {(task.estimated_duration || (task.actual_duration_minutes != null && task.actual_duration_minutes > 0)) && task.description && '\n'}
                  {task.description}
                </p>
              )}
              
              {task.status === 'HOLD' && (
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4">
                  <p className="text-orange-800 dark:text-orange-300 text-xs sm:text-sm flex items-center gap-1.5">
                    <Pause className="h-3.5 w-3.5 flex-shrink-0" />
                    {t('tl_on_hold_message')}
                  </p>
                </div>
              )}
              
              {!compact && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-2 sm:mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{t('tl_due_label', { date: new Date(task.due_date).toLocaleDateString() })}</span>
                  </div>
                  {task.started_by_employee?.name && (
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{t('tl_started_by', { name: task.started_by_employee.name })}</span>
                    </div>
                  )}
                  {!task.started_by_employee?.name && task.status === 'IN_PROGRESS' && task.assignee_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{t('tl_started_by', { name: task.assignee_name })}</span>
                    </div>
                  )}
                  {task.total_duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{t('tl_duration_short', { duration: String(task.total_duration) })}</span>
                    </div>
                  )}
                </div>
              )}
              
              {(onTaskUpdate || onTaskStatusChange) && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {task.status === 'TODO' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange(task, 'IN_PROGRESS')}
                        className="h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        {t('tl_start_task')}
                      </Button>
                      {showCompleteButton && (
                        <Button 
                          size="sm" 
                          onClick={() => handleStatusChange(task, 'COMPLETED')}
                          className="bg-green-600 hover:bg-green-700 relative h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              {t('tl_processing')}
                            </>
                          ) : (
                            t('tl_complete')
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  {task.status === 'IN_PROGRESS' && (() => {
                    const activeUsers = activeUsersPerTask.get(task.id) || [];
                    const canComplete = activeUsers.length === 0 || 
                                      (activeUsers.length === 1 && currentEmployee && activeUsers[0].id === currentEmployee.id);
                    
                    return (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => handleJoinTask(task.id)}
                          className="bg-blue-500 hover:bg-blue-600 h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                          {t('join_task')}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleStatusChange(task, 'COMPLETED')}
                          className="bg-green-600 hover:bg-green-700 relative h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                          disabled={isLoading || !canComplete}
                          title={!canComplete ? t('tl_multiple_users_tooltip') : ''}
                        >
                          {isLoading ? (
                            <>
                              <Loader className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              {t('tl_processing')}
                            </>
                          ) : (
                            t('tl_complete')
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleBackToTodo(task)}
                          className="h-8 text-xs sm:text-sm"
                        >
                          {t('tl_back_to_todo')}
                        </Button>
                      </>
                    );
                  })()}
                  {task.status === 'COMPLETED' && task.completed_at && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                      <div className="text-xs sm:text-sm text-gray-500">
                        {t('tl_completed_at', { date: new Date(task.completed_at).toLocaleString() })}
                        {task.completed_by_employee?.name && (
                          <span className="ml-1">{t('tl_completed_by', { name: task.completed_by_employee.name })}</span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange(task, 'TODO')}
                        className="h-8 text-xs sm:text-sm"
                      >
                        {t('tl_back_to_todo')}
                      </Button>
                    </div>
                  )}
                  {task.status === 'HOLD' && (
                    <div className="flex gap-1.5 sm:gap-2 items-center w-full">
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled
                        className="opacity-50 h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        {t('tl_waiting_for_limit_phases')}
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={async () => {
                          await handleStatusChange(task, 'IN_PROGRESS');
                          await handleJoinTask(task.id);
                        }}
                        className="bg-blue-500 hover:bg-blue-600 h-8 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        {t('tl_start_task')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      {/* Checklist Dialog */}
      {checklistDialogTask && (
        <TaskCompletionChecklistDialog
          open={!!checklistDialogTask}
          onOpenChange={(open) => {
            if (!open) setChecklistDialogTask(null);
          }}
          standardTaskId={checklistDialogTask.standardTaskId}
          taskName={checklistDialogTask.taskName}
          onComplete={handleChecklistComplete}
        />
      )}
      
      {/* Extra Time Dialog for Back to Todo with negative timer */}
      {pendingBackToTodoTask && (
        <TaskExtraTimeDialog
          isOpen={showExtraTimeDialog}
          onClose={() => {
            setShowExtraTimeDialog(false);
            setPendingBackToTodoTask(null);
          }}
          onConfirm={handleExtraTimeConfirmForBackToTodo}
          taskTitle={pendingBackToTodoTask.task.title}
          overTimeMinutes={pendingBackToTodoTask.overTimeMinutes}
          elapsedMinutes={pendingBackToTodoTask.elapsedMinutes}
        />
      )}
    </div>
  );
};

export default TaskList;
