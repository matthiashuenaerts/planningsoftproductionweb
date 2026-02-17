import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskList from './TaskList';
import { Task } from '@/services/dataService';
import { taskService } from '@/services/dataService';
import { rushOrderService } from '@/services/rushOrderService';
import { workstationService } from '@/services/workstationService';
import { standardTasksService } from '@/services/standardTasksService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { workstationTasksService } from '@/services/workstationTasksService';
import { checklistService } from '@/services/checklistService';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, Clock, Users, FileText, AlertTriangle, ExternalLink, Package, Barcode, Loader2, CheckCircle, ScanBarcode } from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListViewer } from '@/components/PartsListViewer';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import TaskCompletionChecklistDialog from '@/components/TaskCompletionChecklistDialog';
import TaskExtraTimeDialog from '@/components/TaskExtraTimeDialog';
import { useLanguage } from '@/context/LanguageContext';
import { partTrackingService } from '@/services/partTrackingService';

interface WorkstationViewProps {
  workstationName?: string;
  workstationId?: string;
  onBack?: () => void;
  is_workstation_task?: boolean;
}

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  active_workers?: number;
  active_users?: Array<{ id: string; name: string }>;
  project_id?: string;
  is_workstation_task?: boolean;
  isCompleting?: boolean;
}

// Small helper component for parts count badge
const PartsCountBadge: React.FC<{ workstationId: string }> = ({ workstationId }) => {
  const { data: count = 0 } = useQuery({
    queryKey: ['partsCount', workstationId],
    queryFn: () => partTrackingService.getBufferedPartCount(workstationId),
    refetchInterval: 30000,
  });
  if (count === 0) return null;
  return (
    <Badge variant="secondary" className="text-lg px-3 py-1 gap-1">
      <Package className="h-4 w-4" />
      {count} parts
    </Badge>
  );
};

const WorkstationView: React.FC<WorkstationViewProps> = ({
  workstationName,
  workstationId,
  onBack,
  is_workstation_task
}) => {
  const [actualWorkstationName, setActualWorkstationName] = useState<string>('');
  const [componentError, setComponentError] = useState<string | null>(null);
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [showPartsListViewer, setShowPartsListViewer] = useState(false);
  const [selectedTaskForParts, setSelectedTaskForParts] = useState<ExtendedTask | null>(null);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [standardTasks, setStandardTasks] = useState<Record<string, any>>({});
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [checklistDialogTask, setChecklistDialogTask] = useState<{
    taskId: string;
    standardTaskId: string;
    taskName: string;
  } | null>(null);
  const [activeUsersPerTask, setActiveUsersPerTask] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showExtraTimeDialog, setShowExtraTimeDialog] = useState(false);
  const [pendingNewTaskId, setPendingNewTaskId] = useState<string | null>(null);
  const [pendingStopData, setPendingStopData] = useState<{
    registrationId: string;
    taskDetails: any;
    overTimeMinutes: number;
    elapsedMinutes: number;
  } | null>(null);
  
  const {
    toast
  } = useToast();
  const {
    currentEmployee
  } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    t,
    createLocalizedPath
  } = useLanguage();
  
  // Query active time registration for current employee
  const { data: activeRegistration } = useQuery({
    queryKey: ['activeTimeRegistration', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return null;
      const { data, error } = await supabase
        .from('time_registrations')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentEmployee?.id
  });

  // Get task details for active registration
  const { data: activeTaskDetails } = useQuery({
    queryKey: ['activeTaskDetails', activeRegistration?.task_id],
    queryFn: async () => {
      if (!activeRegistration?.task_id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select('title, duration')
        .eq('id', activeRegistration.task_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRegistration?.task_id
  });

  useEffect(() => {
    loadStandardTasks();
  }, []);
  
  const loadStandardTasks = async () => {
    try {
      const allStandardTasks = await standardTasksService.getAll();
      const standardTasksMap: Record<string, any> = {};
      allStandardTasks.forEach(task => {
        standardTasksMap[task.id] = task;
      });
      setStandardTasks(standardTasksMap);
    } catch (error) {
      console.error('Error loading standard tasks:', error);
    }
  };
  
  const getTaskColor = (task: ExtendedTask): string | null => {
    if (task.standard_task_id && standardTasks[task.standard_task_id]) {
      return standardTasks[task.standard_task_id].color || null;
    }
    return null;
  };
  
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
        label: t('urgency_high'),
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
  
  const {
    data: fetchedTasks = [],
    isLoading: loading,
    error: queryError,
    refetch: loadTasks
  } = useQuery<ExtendedTask[], Error>({
    queryKey: ['workstationTasks', actualWorkstationName],
    queryFn: async () => {
      if (!actualWorkstationName) return [];
      
      const regularTasks = await taskService.getByWorkstation(actualWorkstationName);
      const activeTasks = regularTasks.filter(task => task.status === 'TODO' || task.status === 'IN_PROGRESS');
      
      const tasksWithProjectInfo = await Promise.all(activeTasks.map(async (task) => {
        try {
          const { data: phaseData, error: phaseError } = await supabase
            .from('phases')
            .select('project_id, name')
            .eq('id', task.phase_id)
            .single();
          
          if (phaseError) throw phaseError;
          
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('name')
            .eq('id', phaseData.project_id)
            .single();
          
          if (projectError) throw projectError;
          
          let assigneeName = null;
          if (task.status === 'IN_PROGRESS' && task.assignee_id) {
            const { data: employeeData, error: employeeError } = await supabase
              .from('employees')
              .select('name')
              .eq('id', task.assignee_id)
              .single();
            
            if (!employeeError && employeeData) {
              assigneeName = employeeData.name;
            }
          }
          
          let activeWorkers = 0;
          if (task.status === 'IN_PROGRESS') {
            const { data: activeRegistrations, error: regError } = await supabase
              .from('time_registrations')
              .select('id')
              .eq('task_id', task.id)
              .eq('is_active', true);
            
            if (!regError && activeRegistrations) {
              activeWorkers = activeRegistrations.length;
            }
          }
          
          return {
            ...task,
            project_name: projectData.name,
            project_id: phaseData.project_id,
            assignee_name: assigneeName,
            active_workers: activeWorkers,
            is_workstation_task: false
          } as ExtendedTask;
        } catch (error) {
          console.error('Error fetching project info for task:', error);
          return {
            ...task,
            project_name: 'Unknown Project',
            project_id: '',
            active_workers: 0,
            is_workstation_task: false
          } as ExtendedTask;
        }
      }));
      
      let workstationDbId = workstationId;
      if (!workstationDbId && actualWorkstationName) {
        const { data: workstationData, error: workstationError } = await supabase
          .from('workstations')
          .select('id')
          .eq('name', actualWorkstationName)
          .single();
        
        if (workstationError) throw workstationError;
        workstationDbId = workstationData.id;
      }
      
      let allTasks = [...tasksWithProjectInfo];
      
      if (workstationDbId) {
        const rushOrders = await rushOrderService.getRushOrdersForWorkstation(workstationDbId);
        if (rushOrders.length > 0) {
          for (const rushOrder of rushOrders) {
            if (rushOrder.tasks && rushOrder.tasks.length > 0) {
              const tasksWithRushOrderInfo = await Promise.all(
                rushOrder.tasks.map(async (taskLink: any) => {
                  try {
                    const { data: task, error: taskError } = await supabase
                      .from('tasks')
                      .select('*')
                      .eq('id', taskLink.standard_task_id)
                      .single();
                    
                    if (taskError) throw taskError;
                    
                    const { data: rushOrderInfo, error: rushOrderError } = await supabase
                      .from('rush_orders')
                      .select('title')
                      .eq('id', taskLink.rush_order_id)
                      .neq('status', 'completed')
                      .single();
                    
                    if (rushOrderError) {
                      return null;
                    }
                    
                    const validateTaskStatus = (status: string): "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD" => {
                      if (['TODO', 'IN_PROGRESS', 'COMPLETED', 'HOLD'].includes(status)) {
                        return status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD";
                      }
                      return 'TODO';
                    };
                    
                    const status = validateTaskStatus(task.status);
                    
                    if (status !== 'TODO' && status !== 'IN_PROGRESS') {
                      return null;
                    }
                    
                    return {
                      ...task,
                      status,
                      is_rush_order: true,
                      rush_order_id: taskLink.rush_order_id,
                      title: task.title,
                      project_name: rushOrderInfo.title,
                      active_workers: 0,
                      is_workstation_task: false
                    } as ExtendedTask;
                  } catch (error) {
                    console.error('Error processing rush order task:', error);
                    return null;
                  }
                })
              );
              
              const validRushOrderTasks = tasksWithRushOrderInfo.filter(task => task !== null) as ExtendedTask[];
              allTasks = [...allTasks, ...validRushOrderTasks];
            }
          }
        }
      }
      
      return allTasks;
    },
    enabled: !!actualWorkstationName
  });
  
  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  
  useEffect(() => {
    if (fetchedTasks) {
      setTasks(fetchedTasks);
    }
  }, [fetchedTasks]);
  
  // Track active users on tasks via realtime subscription
  useEffect(() => {
    const fetchActiveUsers = async () => {
      if (!fetchedTasks || fetchedTasks.length === 0) return;
      
      const taskIds = fetchedTasks.map(t => t.id).filter(Boolean);
      if (taskIds.length === 0) return;

      const { data, error } = await supabase
        .from('time_registrations')
        .select(`
          id,
          task_id,
          workstation_task_id,
          employee_id,
          employees:employee_id (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .in('task_id', taskIds);

      if (!error && data) {
        const usersMap = new Map<string, Array<{ id: string; name: string }>>();
        data.forEach((reg: any) => {
          const taskId = reg.task_id || reg.workstation_task_id;
          if (taskId && reg.employees) {
            if (!usersMap.has(taskId)) {
              usersMap.set(taskId, []);
            }
            usersMap.get(taskId)!.push({
              id: reg.employees.id,
              name: reg.employees.name
            });
          }
        });
        setActiveUsersPerTask(usersMap);
      }
    };

    fetchActiveUsers();

    // Set up realtime subscription
    const channel = supabase
      .channel('workstation-active-users')
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
  }, [fetchedTasks]);
  
  const queryErrorMessage = queryError ? t('failed_to_load_projects', { message: '' }) : null;
  const error = componentError || queryErrorMessage;
  
  const startTimerMutation = useMutation({
    mutationFn: ({ employeeId, taskId, remainingDuration }: { employeeId: string; taskId: string; remainingDuration?: number }) => 
      timeRegistrationService.startTask(employeeId, taskId, remainingDuration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: t('timer_started'),
        description: t('timer_started_desc')
      });
      loadTasks();
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: t('failed_to_start_timer_error'),
        variant: 'destructive'
      });
      console.error('Start timer error:', error);
    }
  });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prevTasks => 
        prevTasks.map(task => {
          if (task.status === 'IN_PROGRESS' && task.status_changed_at && task.duration !== null && task.duration !== undefined) {
            const startTime = new Date(task.status_changed_at);
            const now = new Date();
            const elapsedMs = now.getTime() - startTime.getTime();
            const durationMs = task.duration * 60 * 1000;
            const remainingMs = durationMs - elapsedMs;
            
            if (remainingMs > 0) {
              const hours = Math.floor(remainingMs / (1000 * 60 * 60));
              const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
              
              return {
                ...task,
                timeRemaining: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
                isOvertime: false
              };
            } else {
              const overtimeMs = Math.abs(remainingMs);
              const hours = Math.floor(overtimeMs / (1000 * 60 * 60));
              const minutes = Math.floor((overtimeMs % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((overtimeMs % (1000 * 60)) / 1000);
              
              return {
                ...task,
                timeRemaining: `-${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
                isOvertime: true
              };
            }
          }
          return task;
        })
      );
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    const resolveWorkstationName = async () => {
      if (workstationName) {
        setActualWorkstationName(workstationName);
        return;
      }
      
      if (workstationId) {
        try {
          const workstation = await workstationService.getById(workstationId);
          if (workstation) {
            setActualWorkstationName(workstation.name);
          } else {
            setComponentError(t('workstation_not_found_error'));
          }
        } catch (error) {
          console.error('Error fetching workstation:', error);
          setComponentError(t('failed_to_load_workstation_details_error'));
        }
      }
    };
    
    resolveWorkstationName();
  }, [workstationName, workstationId, t]);
  
  const checkAndUpdateLimitPhases = async (completedTask: ExtendedTask) => {
    try {
      if (!completedTask.standard_task_id) return;
      
      const { data: phaseData, error: phaseError } = await supabase
        .from('phases')
        .select('project_id')
        .eq('id', completedTask.phase_id)
        .single();
      
      if (phaseError || !phaseData) return;
      
      const projectId = phaseData.project_id;
      
      const { data: holdTasks, error: holdError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(project_id)
        `)
        .eq('phases.project_id', projectId)
        .eq('status', 'HOLD')
        .not('standard_task_id', 'is', null);
      
      if (holdError || !holdTasks) return;
      
      for (const holdTask of holdTasks) {
        if (holdTask.standard_task_id) {
          const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(
            holdTask.standard_task_id,
            projectId
          );
          
          if (limitPhasesSatisfied) {
            await supabase
              .from('tasks')
              .update({
                status: 'TODO',
                updated_at: new Date().toISOString()
              })
              .eq('id', holdTask.id);
            
            console.log(`Task ${holdTask.id} updated from HOLD to TODO due to satisfied limit phases`);
          }
        }
      }
      
      await loadTasks();
    } catch (error) {
      console.error('Error checking limit phases:', error);
    }
  };
  
  // Direct task completion without checklist checks (used after checklist is completed)
  const completeTaskDirectly = async (taskId: string) => {
    try {
      setCompletingTasks(prev => new Set(prev).add(taskId));
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      
      toast({
        title: t('success'),
        description: t('task_completed_successfully')
      });
      
      await timeRegistrationService.completeTask(taskId, currentEmployee?.id);
      const completedTask = fetchedTasks.find(task => task.id === taskId);
      if (completedTask) {
        await checkAndUpdateLimitPhases(completedTask);
      } else {
        await loadTasks();
      }
      
      setCompletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: t('error'),
        description: t('failed_to_complete_task_error'),
        variant: 'destructive'
      });
      setCompletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // Handle extra time confirmation when starting a new task with negative timer
  const handleExtraTimeConfirm = async (totalMinutes: number) => {
    if (!pendingStopData || !currentEmployee) return;

    try {
      // Update the current task's duration
      if (activeRegistration?.task_id) {
        await supabase
          .from('tasks')
          .update({ duration: totalMinutes })
          .eq('id', activeRegistration.task_id);
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['activeTaskDetails'] });

      // Stop the current time registration
      await timeRegistrationService.stopTask(pendingStopData.registrationId);

      // Invalidate active registration
      await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });

      toast({
        title: t('task_duration_updated') || 'Task Duration Updated',
        description: `${t('task_paused_with_new_duration') || 'Task paused with new duration:'} ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      });

      // Now start the new task if there's a pending one
      if (pendingNewTaskId) {
        const newTask = fetchedTasks.find(task => task.id === pendingNewTaskId);
        const remainingDuration = newTask?.duration;
        
        startTimerMutation.mutate({
          employeeId: currentEmployee.id,
          taskId: pendingNewTaskId,
          remainingDuration: remainingDuration
        });

        // Also update the task status to IN_PROGRESS
        await supabase
          .from('tasks')
          .update({
            status: 'IN_PROGRESS',
            updated_at: new Date().toISOString()
          })
          .eq('id', pendingNewTaskId);

        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === pendingNewTaskId ? { ...task, status: 'IN_PROGRESS' } : task
          )
        );
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failed_to_update_task_duration') || 'Failed to update task duration',
        variant: 'destructive',
      });
      console.error('Update task duration error:', error);
    }

    setShowExtraTimeDialog(false);
    setPendingStopData(null);
    setPendingNewTaskId(null);
  };

  const handleTaskUpdate = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    try {
      if (newStatus === 'COMPLETED') {
        // Check if multiple users are active on this task
        const activeUsers = activeUsersPerTask.get(taskId) || [];
        if (activeUsers.length > 1) {
          toast({
            title: t('error'),
            description: `${activeUsers.length} users are currently working on this task. Only one user can complete it.`,
            variant: 'destructive'
          });
          return;
        }

        // Check if current user is the only active user
        if (activeUsers.length === 1 && currentEmployee && activeUsers[0].id !== currentEmployee.id) {
          toast({
            title: t('error'),
            description: `Only ${activeUsers[0].name} can complete this task as they are currently working on it.`,
            variant: 'destructive'
          });
          return;
        }

        // Find the task to check for standard_task_id
        const currentTask = fetchedTasks.find(task => task.id === taskId);
        
        // Check if task has a standard_task_id and checklist items before completing
        if (currentTask?.standard_task_id) {
          try {
            const checklistItems = await checklistService.getChecklistItems(currentTask.standard_task_id);
            
            if (checklistItems.length > 0) {
              // Show checklist dialog - user must complete checklist before task completion
              setChecklistDialogTask({ 
                taskId: taskId, 
                standardTaskId: currentTask.standard_task_id, 
                taskName: currentTask.title 
              });
              return; // Don't complete the task yet - wait for checklist completion
            }
          } catch (error) {
            console.error('Error checking checklist items:', error);
            // Continue with normal completion if checklist check fails
          }
        }
        
        // No checklist or empty checklist - proceed with normal completion
        setCompletingTasks(prev => new Set(prev).add(taskId));
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        
        toast({
          title: t('success'),
          description: t('task_completed_successfully')
        });
        
        await timeRegistrationService.completeTask(taskId, currentEmployee?.id);
        const completedTask = fetchedTasks.find(task => task.id === taskId);
        if (completedTask) {
          await checkAndUpdateLimitPhases(completedTask);
        } else {
          await loadTasks();
        }
        
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        return;
      }
      
      if (newStatus === 'IN_PROGRESS') {
        if (currentEmployee) {
          // Check if there's an active registration with negative time
          if (activeRegistration?.is_active && activeTaskDetails?.duration && activeRegistration.start_time) {
            const start = new Date(activeRegistration.start_time);
            const now = new Date();
            const elapsedMs = now.getTime() - start.getTime();
            const durationMs = activeTaskDetails.duration * 60 * 1000;
            const remainingMs = durationMs - elapsedMs;
            
            if (remainingMs < 0) {
              // Current timer is negative - must handle this first
              const overTimeMinutes = Math.floor(Math.abs(remainingMs) / (1000 * 60));
              
              // Reset start_time to NOW so elapsed becomes 0
              await supabase
                .from('time_registrations')
                .update({ start_time: new Date().toISOString() })
                .eq('id', activeRegistration.id);
              
              // Invalidate to refresh the registration with new start_time
              await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
              
              setPendingNewTaskId(taskId);
              setPendingStopData({
                registrationId: activeRegistration.id,
                taskDetails: activeTaskDetails,
                overTimeMinutes,
                elapsedMinutes: 0
              });
              setShowExtraTimeDialog(true);
              return; // Don't start new task yet - wait for dialog
            }
          }
          
          const currentTask = fetchedTasks.find(task => task.id === taskId);
          const remainingDuration = currentTask?.duration;
          startTimerMutation.mutate({
            employeeId: currentEmployee.id,
            taskId: taskId,
            remainingDuration: remainingDuration
          });
        }
      }
      
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
      
      if (error) throw error;
      
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );
      
      toast({
        title: t('success'),
        description: t('task_updated')
      });
    } catch (error) {
      console.error('Error updating task:', error);
      
      if (newStatus === 'COMPLETED') {
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        await loadTasks();
      }
      
      toast({
        title: t('error'),
        description: t('failed_to_update_task_error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleJoinTask = async (taskId: string) => {
    if (!currentEmployee) return;
    
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
        await startTimerMutation.mutateAsync({
          employeeId: currentEmployee.id,
          taskId: taskId,
          remainingDuration: remainingDuration
        });
      }
      loadTasks();
    } catch (error) {
      console.error('Error joining task:', error);
      toast({
        title: t('error'),
        description: t('failed_to_start_ws_task_timer_error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleGoToFiles = (task: ExtendedTask) => {
    if (task.project_id && task.project_name) {
      setSelectedProjectId(task.project_id);
      setSelectedProjectName(task.project_name);
      setShowProjectFiles(true);
    } else {
      toast({
        title: t('error'),
        description: t('project_info_not_available_error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleShowProjectParts = (task: ExtendedTask) => {
    if (task.project_id) {
      setSelectedProjectId(task.project_id);
      setSelectedProjectName(task.project_name || 'Unknown Project');
      setShowPartsListDialog(true);
    } else {
      toast({
        title: t('error'),
        description: t('project_info_not_available_error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleShowBarcode = (task: ExtendedTask) => {
    if (task.project_id) {
      setSelectedProjectId(task.project_id);
      setSelectedProjectName(task.project_name || 'Unknown Project');
      setShowBarcodeDialog(true);
    } else {
      toast({
        title: t('error'),
        description: t('project_info_not_available_error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleShowPartsList = (task: ExtendedTask) => {
    setSelectedTaskForParts(task);
    setShowPartsListViewer(true);
  };
  
  const handleStartWorkstationTask = async (workstationTask: any) => {
    if (!currentEmployee) return;
    
    try {
      await timeRegistrationService.startWorkstationTask(currentEmployee.id, workstationTask.id);
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: t('workstation_task_started'),
        description: t('workstation_task_started_desc', { taskName: workstationTask.task_name })
      });
    } catch (error) {
      console.error('Error starting workstation task:', error);
      toast({
        title: t('error'),
        description: t('failed_to_start_ws_task_error'),
        variant: 'destructive'
      });
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('priority_high_label')}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('priority_medium_label')}</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('priority_low_label')}</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };
  
  const sortTasks = (tasksToSort: ExtendedTask[]) => {
    return tasksToSort.sort((a, b) => {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      const dateComparison = dateA.getTime() - dateB.getTime();
      
      if (dateComparison !== 0) {
        return dateComparison;
      }
      
      return (a.project_name || '').localeCompare(b.project_name || '');
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        <p>{error}</p>
      </div>
    );
  }
  
  const inProgressTasks = sortTasks(tasks.filter(task => task.status === 'IN_PROGRESS' && !task.is_workstation_task));
  const todoTasks = sortTasks(tasks.filter(task => task.status === 'TODO' && !task.is_workstation_task));
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('workstation_view_title', { name: actualWorkstationName })}</h1>
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              {t('back')}
            </Button>
          )}
          <div className="flex gap-2 items-center">
            {(() => {
              const wsId = workstationId;
              if (!wsId) return null;
              return <PartsCountBadge workstationId={wsId} />;
            })()}
            <Badge variant="outline" className="text-lg px-3 py-1">
              {t('active_tasks', { count: tasks.length.toString() })}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              {t('in_progress_tasks', { count: inProgressTasks.length.toString() })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inProgressTasks.length > 0 ? (
              <div className="space-y-3">
                {inProgressTasks.map((task) => {
                  const urgency = task.due_date ? getUrgencyClass(task.due_date) : null;
                  const taskColor = getTaskColor(task);
                  const isCompleting = completingTasks.has(task.id);
                  
                  return (
                    <div
                      key={task.id}
                      className={`group border border-border/60 rounded-xl p-4 relative transition-all duration-200 bg-card/50 hover:bg-accent/30 hover:border-primary/30 shadow-sm hover:shadow-md ${isCompleting ? 'opacity-50' : ''}`}
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: taskColor || 'hsl(var(--border))',
                        borderLeftStyle: 'solid'
                      }}
                    >
                      {/* Task Info Section */}
                      <div className="space-y-2 mb-4">
                        <h3 className="font-semibold text-base sm:text-lg leading-tight text-foreground">{task.project_name}</h3>
                        <p className="text-sm text-muted-foreground">{task.title}</p>
                        
                        {task.assignee_name && (
                          <p className="text-sm text-primary font-medium">
                            {t('assigned_to_label', { name: task.assignee_name })}
                          </p>
                        )}
                        
                        {/* Active Users Display */}
                        {(() => {
                          const activeUsers = activeUsersPerTask.get(task.id) || [];
                          if (activeUsers.length > 0) {
                            return (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">
                                  {activeUsers.length === 1 ? 'Active: ' : `${activeUsers.length} users active: `}
                                  {activeUsers.map(u => u.name).join(', ')}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {task.due_date && (
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-muted-foreground">
                              {t('due_date_label', { date: format(new Date(task.due_date), 'MMM dd, yyyy') })}
                            </p>
                            {urgency && (
                              <Badge variant={urgency.variant} className="text-xs">
                                {urgency.class === 'overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {urgency.label}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {task.timeRemaining && (
                          <p className={`text-sm font-mono font-semibold ${task.isOvertime ? 'text-destructive' : 'text-green-600'}`}>
                            {t('time_remaining_label', { time: task.timeRemaining })}
                          </p>
                        )}
                      </div>
                      
                      {/* Action Buttons - Grid on mobile, row on desktop */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowProjectParts(task)}
                          title={t('view_parts')}
                          className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          <Package className="h-4 w-4" />
                          <span className="text-xs sm:text-sm">{t('view_parts')}</span>
                        </Button>
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGoToFiles(task)}
                            title={t('view_files')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('view_files')}</span>
                          </Button>
                        )}
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowBarcode(task)}
                            title={t('show_barcode')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <Barcode className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('show_barcode')}</span>
                          </Button>
                        )}
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(createLocalizedPath(`/projects/${task.project_id}`))}
                            title={t('go_to_project')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('go_to_project')}</span>
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleJoinTask(task.id)}
                          disabled={isCompleting}
                          className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <PlayCircle className="h-4 w-4" />
                          <span className="text-xs sm:text-sm">{t('join_task')}</span>
                        </Button>
                        
                        {(() => {
                          const activeUsers = activeUsersPerTask.get(task.id) || [];
                          const canComplete = activeUsers.length === 0 || 
                                            (activeUsers.length === 1 && currentEmployee && activeUsers[0].id === currentEmployee.id);
                          
                          return (
                            <Button
                              onClick={() => handleTaskUpdate(task.id, 'COMPLETED')}
                              disabled={isCompleting || !canComplete}
                              title={!canComplete ? 'Multiple users are working on this task' : ''}
                              className={`h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white ${!canComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                              <span className="text-xs sm:text-sm">{t('complete_task')}</span>
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t('no_tasks_in_progress')}</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('todo_tasks', { count: todoTasks.length.toString() })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todoTasks.length > 0 ? (
              <div className="space-y-3">
                {todoTasks.map((task) => {
                  const urgency = task.due_date ? getUrgencyClass(task.due_date) : null;
                  const taskColor = getTaskColor(task);
                  
                  return (
                    <div
                      key={task.id}
                      className="group border border-border/60 rounded-xl p-4 relative transition-all duration-200 bg-card/50 hover:bg-accent/30 hover:border-primary/30 shadow-sm hover:shadow-md"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: taskColor || 'hsl(var(--border))',
                        borderLeftStyle: 'solid'
                      }}
                    >
                      {/* Task Info Section */}
                      <div className="space-y-2 mb-4">
                        <h3 className="font-semibold text-base sm:text-lg leading-tight text-foreground">{task.project_name}</h3>
                        <p className="text-sm text-muted-foreground">{task.title}</p>
                        
                        {task.due_date && (
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-muted-foreground">
                              {t('due_date_label', { date: format(new Date(task.due_date), 'MMM dd, yyyy') })}
                            </p>
                            {urgency && (
                              <Badge variant={urgency.variant} className="text-xs">
                                {urgency.class === 'overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {urgency.label}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons - Grid on mobile, row on desktop */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowProjectParts(task)}
                          title={t('view_parts')}
                          className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          <Package className="h-4 w-4" />
                          <span className="text-xs sm:text-sm">{t('view_parts')}</span>
                        </Button>
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGoToFiles(task)}
                            title={t('view_files')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('view_files')}</span>
                          </Button>
                        )}
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowBarcode(task)}
                            title={t('show_barcode')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <Barcode className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('show_barcode')}</span>
                          </Button>
                        )}
                        
                        {task.project_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(createLocalizedPath(`/projects/${task.project_id}`))}
                            title={t('go_to_project')}
                            className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="text-xs sm:text-sm">{t('go_to_project')}</span>
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleTaskUpdate(task.id, 'IN_PROGRESS')}
                          className="h-12 sm:h-9 flex flex-col sm:flex-row items-center justify-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground col-span-3 sm:col-span-1"
                        >
                          <PlayCircle className="h-4 w-4" />
                          <span className="text-xs sm:text-sm">{t('start')}</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{t('no_todo_tasks')}</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Project Files Popup */}
      {showProjectFiles && (
        <ProjectFilesPopup
          isOpen={showProjectFiles}
          onClose={() => setShowProjectFiles(false)}
          projectId={selectedProjectId}
          projectName={selectedProjectName}
        />
      )}
      
      {/* Task Parts List Viewer */}
      {showPartsListViewer && selectedTaskForParts && (
        <PartsListViewer
          isOpen={showPartsListViewer}
          onClose={() => setShowPartsListViewer(false)}
          taskId={selectedTaskForParts.id}
          taskTitle={selectedTaskForParts.title}
        />
      )}
      
      {/* Project Parts List Dialog */}
      {showPartsListDialog && (
        <PartsListDialog
          isOpen={showPartsListDialog}
          onClose={() => setShowPartsListDialog(false)}
          projectId={selectedProjectId}
        />
      )}
      
      {/* Project Barcode Dialog */}
      {showBarcodeDialog && (
        <ProjectBarcodeDialog
          isOpen={showBarcodeDialog}
          onClose={() => setShowBarcodeDialog(false)}
          projectId={selectedProjectId}
          projectName={selectedProjectName}
        />
      )}
      
      {/* Checklist Dialog */}
      {checklistDialogTask && (
        <TaskCompletionChecklistDialog
          open={!!checklistDialogTask}
          onOpenChange={(open) => {
            if (!open) setChecklistDialogTask(null);
          }}
          standardTaskId={checklistDialogTask.standardTaskId}
          taskName={checklistDialogTask.taskName}
          onComplete={async () => {
            if (!checklistDialogTask) return;
            
            try {
              // Complete the task directly without checklist checks (since checklist is already done)
              await completeTaskDirectly(checklistDialogTask.taskId);
              setChecklistDialogTask(null);
            } catch (error) {
              console.error('Error completing task after checklist:', error);
              toast({
                title: t('error'),
                description: t('failed_to_complete_task_error'),
                variant: 'destructive'
              });
            }
          }}
        />
      )}
      
      {/* Extra Time Dialog for negative timer when starting new task */}
      <TaskExtraTimeDialog
        isOpen={showExtraTimeDialog}
        onClose={() => {
          setShowExtraTimeDialog(false);
          setPendingStopData(null);
          setPendingNewTaskId(null);
        }}
        taskTitle={pendingStopData?.taskDetails?.title || t('current_task') || 'Current Task'}
        overTimeMinutes={pendingStopData?.overTimeMinutes || 0}
        elapsedMinutes={pendingStopData?.elapsedMinutes || 0}
        onConfirm={handleExtraTimeConfirm}
      />
    </div>
  );
};

export default WorkstationView;
