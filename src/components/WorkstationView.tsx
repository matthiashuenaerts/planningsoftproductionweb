
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskList from './TaskList';
import { Task } from '@/services/dataService';
import { taskService } from '@/services/dataService';
import { rushOrderService } from '@/services/rushOrderService';
import { workstationService } from '@/services/workstationService';
import { standardTasksService } from '@/services/standardTasksService';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, Clock } from 'lucide-react';

interface WorkstationViewProps {
  workstationName?: string;
  workstationId?: string;
  onBack?: () => void;
}

// Custom Task interface that includes countdown timer properties
interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
}

const WorkstationView: React.FC<WorkstationViewProps> = ({ workstationName, workstationId, onBack }) => {
  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualWorkstationName, setActualWorkstationName] = useState<string>('');
  const { toast } = useToast();

  // Timer for updating countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.status === 'IN_PROGRESS' && task.status_changed_at && task.duration) {
          const startTime = new Date(task.status_changed_at);
          const now = new Date();
          const elapsedMs = now.getTime() - startTime.getTime();
          const durationMs = task.duration * 60 * 1000; // Convert minutes to milliseconds
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
              timeRemaining: `+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
              isOvertime: true
            };
          }
        }
        return task;
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // First, resolve the workstation name if we only have the ID
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

  const loadTasks = async () => {
    if (!actualWorkstationName) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading tasks for workstation: ${actualWorkstationName}`);
      
      // Load regular tasks using the name - only TODO and IN_PROGRESS tasks
      const regularTasks = await taskService.getByWorkstation(actualWorkstationName);
      const activeTasks = regularTasks.filter(task => task.status === 'TODO' || task.status === 'IN_PROGRESS');
      console.log(`Found ${activeTasks.length} active regular tasks`);
      
      // Get project info and assignee name for each regular task
      const tasksWithProjectInfo = await Promise.all(
        activeTasks.map(async (task) => {
          try {
            // Get phase data to get project id
            const { data: phaseData, error: phaseError } = await supabase
              .from('phases')
              .select('project_id, name')
              .eq('id', task.phase_id)
              .single();
            
            if (phaseError) throw phaseError;
            
            // Get project name
            const { data: projectData, error: projectError } = await supabase
              .from('projects')
              .select('name')
              .eq('id', phaseData.project_id)
              .single();
            
            if (projectError) throw projectError;

            // Get assignee name if task is IN_PROGRESS and has assignee_id
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
            
            return {
              ...task,
              project_name: projectData.name,
              assignee_name: assigneeName
            } as ExtendedTask;
          } catch (error) {
            console.error('Error fetching project info for task:', error);
            return {
              ...task,
              project_name: 'Unknown Project'
            } as ExtendedTask;
          }
        })
      );
      
      // Load rush order tasks
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
        console.log(`Found ${rushOrders.length} rush orders for workstation`);
        
        // Process rush order tasks
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
                    
                    // Only include TODO and IN_PROGRESS tasks from rush orders
                    if (status !== 'TODO' && status !== 'IN_PROGRESS') {
                      return null;
                    }
                    
                    return {
                      ...task,
                      status,
                      is_rush_order: true,
                      rush_order_id: taskLink.rush_order_id,
                      title: task.title,
                      project_name: rushOrderInfo.title
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
      
      console.log(`Total active tasks found: ${allTasks.length}`);
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError('Failed to load tasks');
      toast({
        title: 'Error',
        description: 'Failed to load tasks for this workstation',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actualWorkstationName) {
      loadTasks();
    }
  }, [actualWorkstationName]);

  const checkAndUpdateLimitPhases = async (completedTask: ExtendedTask) => {
    try {
      if (!completedTask.standard_task_id) return;

      // Get the project ID from the completed task
      const { data: phaseData, error: phaseError } = await supabase
        .from('phases')
        .select('project_id')
        .eq('id', completedTask.phase_id)
        .single();

      if (phaseError || !phaseData) return;

      const projectId = phaseData.project_id;

      // Find all tasks in the project that are on HOLD and have limit phases
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

      // Check each HOLD task to see if its limit phases are now satisfied
      for (const holdTask of holdTasks) {
        if (holdTask.standard_task_id) {
          const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(
            holdTask.standard_task_id,
            projectId
          );

          if (limitPhasesSatisfied) {
            // Update the task status from HOLD to TODO
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

      // Reload tasks to reflect changes
      await loadTasks();
    } catch (error) {
      console.error('Error checking limit phases:', error);
    }
  };

  const handleTaskUpdate = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    try {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // Set status_changed_at when changing status
      if (newStatus === 'IN_PROGRESS') {
        updateData.status_changed_at = new Date().toISOString();
      }
      
      // Add completion info if task is being marked as completed
      if (newStatus === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Find the completed task for limit phase checking
      const completedTask = tasks.find(task => task.id === taskId);
      
      // Update local state
      setTasks(prevTasks => {
        if (newStatus === 'COMPLETED') {
          // Remove completed tasks from the list
          return prevTasks.filter(task => task.id !== taskId);
        } else {
          // Update the task status
          return prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, status: newStatus, status_changed_at: updateData.status_changed_at || task.status_changed_at }
              : task
          );
        }
      });
      
      // Check limit phases if task was completed
      if (newStatus === 'COMPLETED' && completedTask) {
        await checkAndUpdateLimitPhases(completedTask);
      }
      
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

  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const todoTasks = tasks.filter(task => task.status === 'TODO');

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
              <TaskList 
                tasks={inProgressTasks} 
                onTaskStatusChange={handleTaskUpdate}
                showRushOrderBadge={true}
                showCountdownTimer={true}
              />
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
              <TaskList 
                tasks={todoTasks} 
                onTaskStatusChange={handleTaskUpdate}
                showRushOrderBadge={true}
              />
            ) : (
              <p className="text-gray-500 text-center py-4">No TODO tasks available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkstationView;
