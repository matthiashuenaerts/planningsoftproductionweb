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
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, Clock, Users, FileText, AlertTriangle, ExternalLink, Package, Barcode } from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface WorkstationViewProps {
  workstationName?: string;
  workstationId?: string;
  onBack?: () => void;
}

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  active_workers?: number;
  project_id?: string;
  is_workstation_task?: boolean;
}

const WorkstationView: React.FC<WorkstationViewProps> = ({ workstationName, workstationId, onBack }) => {
  const [actualWorkstationName, setActualWorkstationName] = useState<string>('');
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [showPartsListViewer, setShowPartsListViewer] = useState(false);
  const [selectedTaskForParts, setSelectedTaskForParts] = useState<ExtendedTask | null>(null);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [standardTasks, setStandardTasks] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
      return { class: 'overdue', label: 'Overdue', variant: 'destructive' as const };
    } else if (daysUntilDue <= 1) {
      return { class: 'critical', label: 'Critical', variant: 'destructive' as const };
    } else if (daysUntilDue <= 3) {
      return { class: 'urgent', label: 'Urgent', variant: 'default' as const };
    } else if (daysUntilDue <= 7) {
      return { class: 'high', label: 'High', variant: 'secondary' as const };
    } else {
      return { class: 'normal', label: 'Normal', variant: 'outline' as const };
    }
  };

  const { data: fetchedTasks = [], isLoading: loading, error: queryError, refetch: loadTasks } = useQuery<ExtendedTask[], Error>({
    queryKey: ['workstationTasks', actualWorkstationName],
    queryFn: async () => {
      if (!actualWorkstationName) return [];
      
      const regularTasks = await taskService.getByWorkstation(actualWorkstationName);
      const activeTasks = regularTasks.filter(task => task.status === 'TODO' || task.status === 'IN_PROGRESS');
      
      const tasksWithProjectInfo = await Promise.all(
        activeTasks.map(async (task) => {
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
        })
      );
      
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
    enabled: !!actualWorkstationName,
  });

  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  useEffect(() => {
    if (fetchedTasks) {
      setTasks(fetchedTasks);
    }
  }, [fetchedTasks]);

  const error = queryError ? 'Failed to load tasks' : null;

  const startTimerMutation = useMutation({
    mutationFn: ({ employeeId, taskId, remainingDuration }: { employeeId: string; taskId: string; remainingDuration?: number }) =>
      timeRegistrationService.startTask(employeeId, taskId, remainingDuration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: 'Timer Started',
        description: 'Time tracking has begun for this task',
      });
      loadTasks();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to start timer',
        variant: 'destructive'
      });
      console.error('Start timer error:', error);
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prevTasks => prevTasks.map(task => {
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
      }));
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
            setError('Workstation not found');
          }
        } catch (error) {
          console.error('Error fetching workstation:', error);
          setError('Failed to load workstation details');
        }
      }
    };
    
    resolveWorkstationName();
  }, [workstationName, workstationId]);

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

  const handleTaskUpdate = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    try {
      if (newStatus === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        
        const completedTask = fetchedTasks.find(task => task.id === taskId);
        
        if (completedTask) {
          await checkAndUpdateLimitPhases(completedTask);
        } else {
          await loadTasks();
        }
        
        toast({
          title: 'Success',
          description: 'Task completed successfully',
        });
        return;
      }
      
      if (newStatus === 'IN_PROGRESS') {
        if (currentEmployee) {
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
          task.id === taskId 
            ? { ...task, status: newStatus }
            : task
        )
      );
      
      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
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
          title: 'Workstation Task Started',
          description: 'Time tracking has begun for this workstation task',
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
        title: 'Error',
        description: 'Failed to start task timer',
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
        title: 'Error',
        description: 'Project information not available for this task',
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
        title: 'Error',
        description: 'Project information not available for this task',
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
        title: 'Error',
        description: 'Project information not available for this task',
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
        title: 'Workstation Task Started',
        description: `Started working on ${workstationTask.task_name}`,
      });
    } catch (error) {
      console.error('Error starting workstation task:', error);
      toast({
        title: 'Error',
        description: 'Failed to start workstation task',
        variant: 'destructive'
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low</Badge>;
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
        <h1 className="text-2xl font-bold">{actualWorkstationName} Workstation</h1>
        <div className="flex gap-2">
          {onBack && (
            <button onClick={onBack} className="text-blue-600 hover:underline">
              ← Back
            </button>
          )}
          <Badge variant="outline" className="text-lg px-3 py-1">
            {tasks.length} Active Tasks
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              In Progress Tasks ({inProgressTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inProgressTasks.length > 0 ? (
              <div className="space-y-3">
                {inProgressTasks.map((task) => {
                  const urgency = task.due_date ? getUrgencyClass(task.due_date) : null;
                  const taskColor = getTaskColor(task);
                  return (
                    <div 
                      key={task.id} 
                      className="border rounded-lg p-4 relative"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: taskColor || '#e5e7eb',
                        borderLeftStyle: 'solid'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{task.project_name}</h3>
                          <p className="text-sm text-gray-600">{task.title}</p>
                          {task.assignee_name && (
                            <p className="text-sm text-blue-600">Assigned to: {task.assignee_name}</p>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-500">
                                Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
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
                            <p className={`text-sm font-mono ${task.isOvertime ? 'text-red-600' : 'text-green-600'}`}>
                              Time: {task.timeRemaining}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {task.active_workers && task.active_workers > 0 && (
                            <div className="flex items-center gap-1 text-sm text-blue-600">
                              <Users className="h-4 w-4" />
                              <span>{task.active_workers}</span>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowProjectParts(task)}
                            title="View Project Parts List"
                          >
                            <Package className="h-4 w-4" />
                            Parts
                          </Button>
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGoToFiles(task)}
                              title="View Project Files"
                            >
                              <FileText className="h-4 w-4" />
                              Files
                            </Button>
                          )}
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowBarcode(task)}
                              title="Show Project Barcode"
                            >
                              <Barcode className="h-4 w-4" />
                              Barcode
                            </Button>
                          )}
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/projects/${task.project_id}`)}
                              title="Go to Project Details"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Project
                            </Button>
                          )}
                          <button
                            onClick={() => handleJoinTask(task.id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            Join Task
                          </button>
                          <button
                            onClick={() => handleTaskUpdate(task.id, 'COMPLETED')}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No tasks in progress</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              TODO Tasks ({todoTasks.length})
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
                      className="border rounded-lg p-4 relative"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: taskColor || '#e5e7eb',
                        borderLeftStyle: 'solid'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{task.project_name}</h3>
                          <p className="text-sm text-gray-600">{task.title}</p>
                          {task.due_date && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-500">
                                Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowProjectParts(task)}
                            title="View Project Parts List"
                          >
                            <Package className="h-4 w-4" />
                            Parts
                          </Button>
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGoToFiles(task)}
                              title="View Project Files"
                            >
                              <FileText className="h-4 w-4" />
                              Files
                            </Button>
                          )}
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowBarcode(task)}
                              title="Show Project Barcode"
                            >
                              <Barcode className="h-4 w-4" />
                              Barcode
                            </Button>
                          )}
                          {task.project_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/projects/${task.project_id}`)}
                              title="Go to Project Details"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Project
                            </Button>
                          )}
                          <button
                            onClick={() => handleTaskUpdate(task.id, 'IN_PROGRESS')}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No TODO tasks available</p>
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
    </div>
  );
};

export default WorkstationView;
