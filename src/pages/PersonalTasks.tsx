import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import TaskTimer from '@/components/TaskTimer';
import EnhancedDailyTimeline from '@/components/EnhancedDailyTimeline';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import { startOfDay, endOfDay, format, parseISO } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: string;
  due_date: string;
  assignee_id: string;
  workstation: string;
  phase_id: string;
  duration: number;
  standard_task_id?: string;
  phases: {
    name: string;
    projects: {
      id: string;
      name: string;
      client: string;
    };
  };
}

interface Schedule {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  task_id?: string;
  phase_id?: string;
  employee_id: string;
  is_auto_generated: boolean;
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeRegistrations, setActiveTimeRegistrations] = useState<any[]>([]);
  const [showFilesPopup, setShowFilesPopup] = useState<string | null>(null);
  const [showPartsDialog, setShowPartsDialog] = useState<string | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState<string | null>(null);

  useEffect(() => {
    if (currentEmployee) {
      fetchPersonalData();
      fetchActiveTimeRegistrations();
    }
  }, [currentEmployee]);

  const fetchPersonalData = async () => {
    if (!currentEmployee) return;
    
    try {
      setLoading(true);
      
      // Fetch assigned tasks with enhanced project info
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(
            name,
            projects!inner(
              id,
              name,
              client
            )
          )
        `)
        .eq('assignee_id', currentEmployee.id)
        .order('due_date', { ascending: true });

      if (tasksError) {
        console.error('Tasks fetch error:', tasksError);
        throw tasksError;
      }

      console.log('Fetched tasks with project data:', tasksData);

      // Fetch personal schedule for today with enhanced query to include task and project info
      const today = new Date();
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          *,
          tasks(
            id,
            title,
            description,
            status,
            priority,
            workstation,
            phases(
              name,
              projects(
                id,
                name,
                client
              )
            )
          )
        `)
        .eq('employee_id', currentEmployee.id)
        .gte('start_time', startOfDay(today).toISOString())
        .lte('start_time', endOfDay(today).toISOString())
        .order('start_time', { ascending: true });

      if (schedulesError) {
        console.error('Schedules fetch error:', schedulesError);
        throw schedulesError;
      }

      console.log('Fetched schedules with project data:', schedulesData);

      // Type cast the tasks data to ensure proper typing
      const typedTasks: Task[] = (tasksData || []).map(task => ({
        ...task,
        status: task.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
      }));

      setTasks(typedTasks);
      setSchedules(schedulesData || []);
    } catch (error: any) {
      console.error('Error in fetchPersonalData:', error);
      toast({
        title: "Error",
        description: `Failed to load personal data: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTimeRegistrations = async () => {
    if (!currentEmployee) return;
    
    try {
      const registrations = await timeRegistrationService.getActiveRegistration(currentEmployee.id);
      setActiveTimeRegistrations(registrations ? [registrations] : []);
    } catch (error) {
      console.error('Error fetching active time registrations:', error);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (!currentEmployee) return;

    try {
      console.log('Handling task status change:', { taskId, newStatus, currentEmployee: currentEmployee.id });
      
      if (newStatus === 'IN_PROGRESS') {
        console.log('Starting task and time registration for:', taskId);
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        
        // Refresh active time registrations immediately
        await fetchActiveTimeRegistrations();
        
        // Invalidate queries to refresh UI components
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
      } else if (newStatus === 'COMPLETED') {
        console.log('Completing task:', taskId);
        await timeRegistrationService.completeTask(taskId);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
        });
      } else if (newStatus === 'TODO' && isTaskActive(taskId)) {
        console.log('Pausing task:', taskId);
        await timeRegistrationService.stopActiveRegistrations(currentEmployee.id);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });

        toast({
          title: "Task Paused",
          description: "Time registration has been stopped.",
        });
      } else {
        // Regular status update
        console.log('Regular status update:', { taskId, newStatus });
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: newStatus,
            status_changed_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (error) throw error;
      }

      // Refresh tasks data
      await fetchPersonalData();
    } catch (error: any) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: `Failed to update task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const isTaskActive = (taskId: string) => {
    return activeTimeRegistrations.some(reg => reg.task_id === taskId || reg.workstation_task_id === taskId);
  };

  const canCompleteTask = (task: Task) => {
    return (task.status === 'IN_PROGRESS' || isTaskActive(task.id)) && task.status !== 'COMPLETED';
  };

  const scheduleTimeMap = new Map<string, string>();
  schedules.forEach(schedule => {
    if (schedule.task_id) {
      scheduleTimeMap.set(schedule.task_id, schedule.start_time);
    }
  });

  // Enhanced timeline data with better formatting and project info
  const enhancedTimelineData = schedules.map(schedule => {
    let projectName = 'No Project';
    let projectId = null;
    let taskTitle = schedule.title;
    let taskDescription = schedule.description || '';
    let taskStatus = 'scheduled';
    let taskWorkstation = '';
    let taskPriority = 'medium';
    let taskId = schedule.id;
    let canComplete = false;
    let isActive = false;

    // Check if schedule is linked to a task and has project info
    if (schedule.tasks && schedule.tasks.phases && schedule.tasks.phases.projects) {
      projectName = schedule.tasks.phases.projects.name;
      projectId = schedule.tasks.phases.projects.id;
      taskTitle = schedule.tasks.title;
      taskDescription = schedule.tasks.description || schedule.description || '';
      taskStatus = schedule.tasks.status ? schedule.tasks.status.toLowerCase() : 'scheduled';
      taskWorkstation = schedule.tasks.workstation || '';
      taskPriority = schedule.tasks.priority || 'medium';
      taskId = schedule.tasks.id;
      
      // Find the full task data for completion checks
      const fullTask = tasks.find(t => t.id === schedule.tasks?.id);
      if (fullTask) {
        canComplete = canCompleteTask(fullTask);
        isActive = isTaskActive(fullTask.id);
      }
    } else if (schedule.task_id) {
      // Fallback: try to find task in the tasks array
      const associatedTask = tasks.find(t => t.id === schedule.task_id);
      if (associatedTask) {
        projectName = associatedTask.phases.projects.name;
        projectId = associatedTask.phases.projects.id;
        taskTitle = associatedTask.title;
        taskDescription = associatedTask.description || schedule.description || '';
        taskStatus = associatedTask.status.toLowerCase();
        taskWorkstation = associatedTask.workstation || '';
        taskPriority = associatedTask.priority;
        taskId = associatedTask.id;
        canComplete = canCompleteTask(associatedTask);
        isActive = isTaskActive(associatedTask.id);
      }
    }

    console.log('Enhanced timeline item:', {
      scheduleId: schedule.id,
      taskId,
      projectName,
      projectId,
      taskTitle,
      taskStatus,
      isActive
    });

    return {
      id: taskId,
      title: taskTitle,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      description: taskDescription,
      status: taskStatus,
      project_name: projectName,
      project_id: projectId,
      workstation: taskWorkstation,
      priority: taskPriority,
      canComplete,
      isActive
    };
  });

  const handleTimelineStartTask = (taskId: string) => {
    console.log('Starting task from timeline:', taskId);
    handleTaskStatusChange(taskId, 'IN_PROGRESS');
  };

  const handleTimelineCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      handleTaskStatusChange(taskId, 'COMPLETED');
    }
  };

  const handleShowFiles = (projectId: string) => {
    console.log('Opening files for project:', projectId);
    if (projectId) {
      setShowFilesPopup(projectId);
    }
  };

  const handleShowParts = (projectId: string) => {
    console.log('Opening parts for project:', projectId);
    if (projectId) {
      setShowPartsDialog(projectId);
    }
  };

  const handleShowBarcode = (projectId: string) => {
    console.log('Opening barcode for project:', projectId);
    if (projectId) {
      setShowBarcodeDialog(projectId);
    }
  };

  const handleShowOrders = (projectId: string) => {
    console.log('Opening orders for project:', projectId);
    if (projectId) {
      navigate(`/projects/${projectId}/orders`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Navbar />
        <div className="flex-1 ml-64 p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navbar />
      <div className="flex-1 ml-64 p-6 max-w-none">
        <TaskTimer />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Daily Timeline</h1>
          <p className="text-gray-600 mt-2">Your scheduled tasks for today</p>
        </div>

        <div className="space-y-4">
          <EnhancedDailyTimeline 
            tasks={enhancedTimelineData}
            onStartTask={handleTimelineStartTask}
            onCompleteTask={handleTimelineCompleteTask}
            onShowFiles={handleShowFiles}
            onShowParts={handleShowParts}
            onShowBarcode={handleShowBarcode}
            onShowOrders={handleShowOrders}
          />
        </div>

        {/* Popups and Dialogs */}
        {showFilesPopup && (
          <ProjectFilesPopup
            projectId={showFilesPopup}
            projectName={tasks.find(task => task.phases.projects.id === showFilesPopup)?.phases.projects.name || "Unknown Project"}
            isOpen={true}
            onClose={() => setShowFilesPopup(null)}
          />
        )}

        {showPartsDialog && (
          <PartsListDialog
            isOpen={true}
            onClose={() => setShowPartsDialog(null)}
            projectId={showPartsDialog}
            onImportComplete={() => {
              toast({
                title: "Success",
                description: "Parts list imported successfully",
              });
            }}
          />
        )}

        {showBarcodeDialog && (
          <ProjectBarcodeDialog
            isOpen={true}
            onClose={() => setShowBarcodeDialog(null)}
            projectId={showBarcodeDialog}
            projectName={tasks.find(task => task.phases.projects.id === showBarcodeDialog)?.phases.projects.name || "Unknown Project"}
          />
        )}
      </div>
    </div>
  );
};

export default PersonalTasks;
