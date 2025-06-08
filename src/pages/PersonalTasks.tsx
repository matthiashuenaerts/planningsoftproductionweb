
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import TaskList from '@/components/TaskList';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/services/dataService';
import { standardTasksService } from '@/services/standardTasksService';
import { supabase } from '@/integrations/supabase/client';
import { workstationService } from '@/services/workstationService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workstation } from '@/services/workstationService';
import { useIsMobile } from '@/hooks/use-mobile';

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
}

const PersonalTasks = () => {
  const [todoTasks, setTodoTasks] = useState<ExtendedTask[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<ExtendedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWorkstations, setUserWorkstations] = useState<Workstation[]>([]);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Timer for updating countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setInProgressTasks(prevTasks => prevTasks.map(task => {
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

  useEffect(() => {
    const fetchUserWorkstations = async () => {
      if (!currentEmployee) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get all workstations assigned to the employee
        const workstations = await workstationService.getWorkstationsForEmployee(currentEmployee.id);
        setUserWorkstations(workstations);
        
        if (workstations.length === 0) {
          // If no linked workstations, check direct workstation assignment (legacy)
          const { data: employeeData } = await supabase
            .from('employees')
            .select('workstation')
            .eq('id', currentEmployee.id)
            .single();
            
          if (employeeData?.workstation) {
            // Try to find the workstation by name
            const workstationByName = await workstationService.getByName(employeeData.workstation);
            if (workstationByName) {
              setUserWorkstations([workstationByName]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching workstations:', error);
      }
    };

    fetchUserWorkstations();
  }, [currentEmployee]);

  useEffect(() => {
    const fetchPersonalTasks = async () => {
      if (!currentEmployee || userWorkstations.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const allTasks: ExtendedTask[] = [];
        
        // For each workstation, get the tasks
        for (const workstation of userWorkstations) {
          // First try to get tasks via standard task links
          const { data: standardTaskLinks, error: linksError } = await supabase
            .from('standard_task_workstation_links')
            .select('standard_task_id')
            .eq('workstation_id', workstation.id);
          
          if (linksError) {
            console.error('Error fetching standard task links:', linksError);
            continue;
          }
          
          if (standardTaskLinks && standardTaskLinks.length > 0) {
            // Get all the standard tasks for this workstation
            const standardTaskIds = standardTaskLinks.map(link => link.standard_task_id);
            const standardTasks = await Promise.all(
              standardTaskIds.map(id => supabase
                .from('standard_tasks')
                .select('*')
                .eq('id', id)
                .single()
                .then(res => res.data)
              )
            );
            
            // For each standard task, find actual tasks that match
            for (const standardTask of standardTasks) {
              if (!standardTask) continue;
              
              const taskNumber = standardTask.task_number;
              const taskName = standardTask.task_name;
              
              // Find tasks that match this standard task and are TODO or IN_PROGRESS
              const { data: matchingTasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .in('status', ['TODO', 'IN_PROGRESS'])
                .or(`title.ilike.%${taskNumber}%,title.ilike.%${taskName}%`);
                
              if (tasksError) {
                console.error('Error fetching matching tasks:', tasksError);
                continue;
              }
              
              if (matchingTasks && matchingTasks.length > 0) {
                // Filter for tasks assigned to current user or unassigned
                const relevantTasks = matchingTasks.filter(task => 
                  !task.assignee_id || task.assignee_id === currentEmployee.id
                );
                
                // Get project info and assignee name for each task
                const tasksWithProjectInfo = await Promise.all(
                  relevantTasks.map(async (task) => {
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
                      
                      // Cast task to the required Task type
                      return {
                        ...task,
                        project_name: projectData.name,
                        assignee_name: assigneeName,
                        priority: task.priority as "Low" | "Medium" | "High" | "Urgent",
                        status: task.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD"
                      } as ExtendedTask;
                    } catch (error) {
                      console.error('Error fetching project info for task:', error);
                      return {
                        ...task,
                        project_name: 'Unknown Project',
                        priority: task.priority as "Low" | "Medium" | "High" | "Urgent",
                        status: task.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD"
                      } as ExtendedTask;
                    }
                  })
                );
                
                allTasks.push(...tasksWithProjectInfo);
              }
            }
          } else {
            // Fall back to traditional task-workstation links if no standard tasks are linked
            const workstationTasks = await supabase
              .from('task_workstation_links')
              .select('tasks (*)')
              .eq('workstation_id', workstation.id);
              
            if (workstationTasks.error) {
              console.error('Error fetching workstation tasks:', workstationTasks.error);
              continue;
            }
            
            if (workstationTasks.data && workstationTasks.data.length > 0) {
              const filteredTasks = workstationTasks.data
                .filter(item => item.tasks && ['TODO', 'IN_PROGRESS'].includes(item.tasks.status))
                .map(item => ({
                  ...item.tasks,
                  project_name: 'Unknown Project',
                  priority: item.tasks.priority as "Low" | "Medium" | "High" | "Urgent",
                  status: item.tasks.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD"
                })) as Task[];
                
              // Filter for tasks assigned to current user or unassigned
              const relevantTasks = filteredTasks.filter(task => 
                !task.assignee_id || task.assignee_id === currentEmployee.id
              );
              
              allTasks.push(...relevantTasks);
            }
          }
        }

        // Remove duplicates (a task might be linked to multiple workstations)
        const uniqueTasks = Array.from(
          new Map(allTasks.map(task => [task.id, task])).values()
        );
        
        // Separate tasks by status - Fixed the status filtering
        const allTodoAndHoldTasks = uniqueTasks.filter(task => 
          task.status === 'TODO' || task.status === 'HOLD'
        );
        const allInProgressTasks = uniqueTasks.filter(task => 
          task.status === 'IN_PROGRESS'
        );
        
        setTodoTasks(allTodoAndHoldTasks);
        setInProgressTasks(allInProgressTasks);
      } catch (error: any) {
        console.error('Error fetching personal tasks:', error);
        toast({
          title: "Error",
          description: `Failed to load personal tasks: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (userWorkstations.length > 0) {
      fetchPersonalTasks();
    }
  }, [currentEmployee, userWorkstations, toast]);

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

      // Refetch personal tasks to reflect changes
      if (userWorkstations.length > 0) {
        // Re-run the fetchPersonalTasks logic
        window.location.reload(); // Simple way to refresh the data
      }
    } catch (error) {
      console.error('Error checking limit phases:', error);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: Task['status']) => {
    if (!currentEmployee) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update tasks.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // If starting a task, use time registration service
      if (status === 'IN_PROGRESS') {
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        
        // Move task between lists
        const task = todoTasks.find(t => t.id === taskId);
        if (task) {
          setTodoTasks(prev => prev.filter(t => t.id !== taskId));
          setInProgressTasks(prev => [...prev, { ...task, status: 'IN_PROGRESS', assignee_id: currentEmployee.id }]);
        }
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
        return;
      }
      
      // If completing a task, use time registration service
      if (status === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        
        // Find the completed task for limit phase checking
        const completedTask = [...todoTasks, ...inProgressTasks].find(task => task.id === taskId);
        
        // Remove from both lists since we don't show completed tasks
        setTodoTasks(prev => prev.filter(t => t.id !== taskId));
        setInProgressTasks(prev => prev.filter(t => t.id !== taskId));
        
        // Check limit phases if task was completed
        if (completedTask) {
          await checkAndUpdateLimitPhases(completedTask);
        }
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
        });
        return;
      }
      
      // For other status changes, use regular database update
      const updateData: Partial<Task> = { 
        status,
        updated_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString()
      };
      
      // Set assignee when changing to IN_PROGRESS
      if (status === 'IN_PROGRESS') {
        updateData.assignee_id = currentEmployee?.id;
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Move task between lists based on new status
      if (status === 'TODO') {
        const task = inProgressTasks.find(t => t.id === taskId);
        if (task) {
          setInProgressTasks(prev => prev.filter(t => t.id !== taskId));
          setTodoTasks(prev => [...prev, { ...task, status: 'TODO' }]);
        }
      }
      
      toast({
        title: "Task Updated",
        description: `Task status changed to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: `Failed to update task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`${isMobile ? 'pt-16' : 'ml-64'} w-full p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Personal Tasks</h1>
            <p className="text-gray-500">
              Tasks assigned to you at your workstations
            </p>
          </div>
          
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : userWorkstations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Workstations Assigned</CardTitle>
              </CardHeader>
              <CardContent>
                <p>You don't have any workstations assigned. Please contact an administrator to assign you to workstations.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* In Progress Tasks - Show first */}
              {inProgressTasks.length > 0 && (
                <TaskList 
                  tasks={inProgressTasks} 
                  title="In Progress Tasks" 
                  onTaskStatusChange={handleTaskStatusChange}
                  showCountdownTimer={true}
                />
              )}
              
              {/* TODO Tasks - Show second */}
              {todoTasks.length > 0 && (
                <TaskList 
                  tasks={todoTasks} 
                  title="TODO Tasks" 
                  onTaskStatusChange={handleTaskStatusChange}
                />
              )}
              
              {/* Show message if no tasks */}
              {inProgressTasks.length === 0 && todoTasks.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>There are no pending tasks assigned to your workstations or to you directly.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
