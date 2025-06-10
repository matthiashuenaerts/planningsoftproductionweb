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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workstation } from '@/services/workstationService';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, parseISO, isToday, differenceInDays, isBefore } from 'date-fns';
import { 
  Clock,
  Play,
  ExternalLink,
  FileText,
  Calendar,
  User,
  PlayCircle,
  Users,
  AlertTriangle,
  Package,
  Barcode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  active_workers?: number;
  project_id?: string;
}

interface ScheduledTask {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  task_id: string | null;
  phase_id: string | null;
  is_auto_generated: boolean;
  is_completed?: boolean;
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    duration?: number;
    workstation?: string;
  };
  phase?: {
    id: string;
    name: string;
    project_id: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

const PersonalTasks = () => {
  const [todoTasks, setTodoTasks] = useState<ExtendedTask[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<ExtendedTask[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWorkstations, setUserWorkstations] = useState<Workstation[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Function to get urgency class based on due date
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

  // Start task timer mutation
  const startTimerMutation = useMutation({
    mutationFn: ({ employeeId, taskId, remainingDuration }: { employeeId: string; taskId: string; remainingDuration?: number }) =>
      timeRegistrationService.startTask(employeeId, taskId, remainingDuration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: 'Timer Started',
        description: 'Time tracking has begun for this task',
      });
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

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
    const fetchScheduledTasks = async () => {
      if (!currentEmployee) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        const startDate = `${today}T00:00:00`;
        const endDate = `${today}T23:59:59`;

        const { data, error } = await supabase
          .from('schedules')
          .select(`
            *,
            task:tasks(id, title, status, priority, duration, workstation),
            phase:phases(id, name, project_id)
          `)
          .eq('employee_id', currentEmployee.id)
          .gte('start_time', startDate)
          .lte('start_time', endDate)
          .order('start_time', { ascending: true });

        if (error) throw error;

        // Get project info for tasks that have phases
        const tasksWithProjects = await Promise.all((data || []).map(async (task) => {
          if (task.phase && task.phase.project_id) {
            const { data: projectData } = await supabase
              .from('projects')
              .select('id, name')
              .eq('id', task.phase.project_id)
              .single();
            
            return { ...task, project: projectData };
          }
          return task;
        }));

        setScheduledTasks(tasksWithProjects);
      } catch (error: any) {
        console.error('Error fetching scheduled tasks:', error);
      }
    };

    fetchScheduledTasks();
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

                      // Get count of active workers on this task
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
                      
                      // Cast task to the required Task type
                      return {
                        ...task,
                        project_name: projectData.name,
                        project_id: phaseData.project_id,
                        assignee_name: assigneeName,
                        active_workers: activeWorkers,
                        priority: task.priority as "Low" | "Medium" | "High" | "Urgent",
                        status: task.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD"
                      } as ExtendedTask;
                    } catch (error) {
                      console.error('Error fetching project info for task:', error);
                      return {
                        ...task,
                        project_name: 'Unknown Project',
                        project_id: '',
                        active_workers: 0,
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
                  project_id: '',
                  active_workers: 0,
                  priority: item.tasks.priority as "Low" | "Medium" | "High" | "Urgent",
                  status: item.tasks.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD"
                })) as ExtendedTask[];
                
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

  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (!currentEmployee) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update tasks.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Use explicit status checks without type narrowing
      const statusValue = newStatus as string;
      
      // If starting a task, use time registration service
      if (statusValue === 'IN_PROGRESS') {
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
      if (statusValue === 'COMPLETED') {
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
        status: newStatus,
        updated_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString()
      };
      
      // Set assignee when changing to IN_PROGRESS
      if (statusValue === 'IN_PROGRESS') {
        updateData.assignee_id = currentEmployee?.id;
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Move task between lists based on new status
      if (statusValue === 'TODO') {
        const task = inProgressTasks.find(t => t.id === taskId);
        if (task) {
          setInProgressTasks(prev => prev.filter(t => t.id !== taskId));
          setTodoTasks(prev => [...prev, { ...task, status: 'TODO' }]);
        }
      }
      
      toast({
        title: "Task Updated",
        description: `Task status changed to ${newStatus}`,
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

  const handleJoinTask = async (taskId: string) => {
    if (!currentEmployee) return;
    
    try {
      // Get current task to check remaining duration
      const currentTask = [...todoTasks, ...inProgressTasks].find(task => task.id === taskId);
      const remainingDuration = currentTask?.duration;
      
      await startTimerMutation.mutateAsync({
        employeeId: currentEmployee.id,
        taskId: taskId,
        remainingDuration: remainingDuration
      });
    } catch (error) {
      console.error('Error joining task:', error);
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

  const formatTime = (timeString: string) => {
    try {
      return format(parseISO(timeString), 'HH:mm');
    } catch (error) {
      return 'Invalid time';
    }
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(7, 0, 0, 0); // Start at 7 AM
    const endOfDay = new Date(now);
    endOfDay.setHours(16, 0, 0, 0); // End at 4 PM

    if (now < startOfDay || now > endOfDay) return null;

    const totalMinutes = (endOfDay.getTime() - startOfDay.getTime()) / (1000 * 60);
    const currentMinutes = (now.getTime() - startOfDay.getTime()) / (1000 * 60);
    
    return (currentMinutes / totalMinutes) * 100;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleStartTask = async (taskId: string) => {
    if (!currentEmployee) return;
    
    try {
      await timeRegistrationService.startTask(currentEmployee.id, taskId);
      toast({
        title: "Task Started",
        description: "Task has been started and time registration created.",
      });
      // Refresh data
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to start task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleProjectDetails = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleViewFiles = (projectId: string) => {
    // This would open a file viewer or navigate to project files
    navigate(`/projects/${projectId}/files`);
  };

  const timelinePosition = getCurrentTimePosition();

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
              Your daily schedule and assigned tasks
            </p>
          </div>
          
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Daily Planning Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Today's Schedule
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scheduledTasks.length > 0 ? (
                    <div className="relative">
                      {/* Timeline */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                      
                      {/* Current time indicator */}
                      {timelinePosition !== null && (
                        <div 
                          className="absolute left-0 w-full z-10"
                          style={{ top: `${timelinePosition}%` }}
                        >
                          <div className="flex items-center">
                            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>
                            <div className="flex-1 h-0.5 bg-red-500 ml-2"></div>
                            <span className="ml-2 text-xs text-red-500 font-medium">
                              {format(currentTime, 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {scheduledTasks.map((scheduledTask, index) => (
                        <div key={scheduledTask.id} className="relative pl-12 pb-6 last:pb-0">
                          {/* Timeline node */}
                          <div className="absolute left-4 w-4 h-4 bg-blue-500 rounded-full -translate-x-1/2 border-2 border-white shadow"></div>
                          
                          <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center mb-1">
                                  <Clock className="h-4 w-4 text-gray-500 mr-1" />
                                  <span className="text-sm font-medium">
                                    {formatTime(scheduledTask.start_time)} - {formatTime(scheduledTask.end_time)}
                                  </span>
                                  {scheduledTask.is_auto_generated && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                                
                                <h4 className="font-medium text-lg">{scheduledTask.title}</h4>
                                
                                {scheduledTask.project && (
                                  <p className="text-sm text-blue-600 mb-1">
                                    Project: {scheduledTask.project.name}
                                  </p>
                                )}
                                
                                {scheduledTask.task?.workstation && (
                                  <p className="text-sm text-purple-600 mb-1">
                                    Workstation: {scheduledTask.task.workstation}
                                  </p>
                                )}
                                
                                {scheduledTask.description && (
                                  <p className="text-sm text-gray-600 mt-2">{scheduledTask.description}</p>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-2 ml-4">
                                {scheduledTask.task?.priority && (
                                  <Badge className={cn("text-xs", getPriorityColor(scheduledTask.task.priority))}>
                                    {scheduledTask.task.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 mt-3">
                              {scheduledTask.task_id && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartTask(scheduledTask.task_id!)}
                                  disabled={scheduledTask.task?.status === 'COMPLETED' || scheduledTask.is_completed}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Start
                                </Button>
                              )}
                              
                              {scheduledTask.project && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleProjectDetails(scheduledTask.project!.id)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Project Details
                                </Button>
                              )}
                              
                              {scheduledTask.project && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewFiles(scheduledTask.project!.id)}
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Files
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No scheduled tasks for today</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Enhanced Task Lists with Workstation-style cards */}
              {userWorkstations.length === 0 ? (
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <PlayCircle className="h-5 w-5" />
                          In Progress Tasks ({inProgressTasks.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {inProgressTasks.map((task) => {
                            const urgency = task.due_date ? getUrgencyClass(task.due_date) : null;
                            return (
                              <div key={task.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h3 className="font-medium">{task.title}</h3>
                                    <p className="text-sm text-gray-600">{task.project_name}</p>
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
                                      onClick={() => handleTaskStatusChange(task.id, 'COMPLETED')}
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
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* TODO Tasks - Show second */}
                  {todoTasks.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          TODO Tasks ({todoTasks.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {todoTasks.map((task) => {
                            const urgency = task.due_date ? getUrgencyClass(task.due_date) : null;
                            return (
                              <div key={task.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h3 className="font-medium">{task.title}</h3>
                                    <p className="text-sm text-gray-600">{task.project_name}</p>
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
                                      onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}
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
                      </CardContent>
                    </Card>
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
          )}
        </div>
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

export default PersonalTasks;
