
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
      
      // Fetch assigned tasks
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

      if (tasksError) throw tasksError;

      // Fetch personal schedule for today
      const today = new Date();
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .gte('start_time', startOfDay(today).toISOString())
        .lte('start_time', endOfDay(today).toISOString())
        .order('start_time', { ascending: true });

      if (schedulesError) throw schedulesError;

      // Type cast the tasks data to ensure proper typing
      const typedTasks: Task[] = (tasksData || []).map(task => ({
        ...task,
        status: task.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
      }));

      setTasks(typedTasks);
      setSchedules(schedulesData || []);
    } catch (error: any) {
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
      if (newStatus === 'IN_PROGRESS') {
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
      } else if (newStatus === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
        });
      } else if (newStatus === 'TODO' && isTaskActive(taskId)) {
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
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: newStatus,
            status_changed_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (error) throw error;
      }

      // Refresh tasks
      await fetchPersonalData();
    } catch (error: any) {
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
    const associatedTask = schedule.task_id ? tasks.find(t => t.id === schedule.task_id) : undefined;

    if (associatedTask) {
      return {
        id: associatedTask.id,
        title: associatedTask.title,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        description: associatedTask.description || schedule.description || '',
        status: associatedTask.status.toLowerCase(),
        project_name: associatedTask.phases.projects.name,
        project_id: associatedTask.phases.projects.id, // Add project_id here
        workstation: associatedTask.workstation || '',
        priority: associatedTask.priority,
        canComplete: canCompleteTask(associatedTask),
        isActive: isTaskActive(associatedTask.id)
      };
    }

    return {
      id: schedule.id,
      title: schedule.title,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      description: schedule.description || '',
      status: 'scheduled',
      project_name: schedule.title,
      project_id: null, // No project for non-task schedules
      workstation: '',
      priority: 'medium',
      canComplete: false,
      isActive: false
    };
  });

  const handleTimelineStartTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      handleTaskStatusChange(taskId, 'IN_PROGRESS');
    }
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
