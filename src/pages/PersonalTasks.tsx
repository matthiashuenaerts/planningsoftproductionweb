import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import TaskTimer from '@/components/TaskTimer';
import EnhancedDailyTimeline from '@/components/EnhancedDailyTimeline';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import { holidayService } from '@/services/holidayService';
import { startOfDay, endOfDay, format, parseISO, addDays, isToday, isTomorrow } from 'date-fns';

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

interface ScheduleWithTask {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  task_id?: string;
  phase_id?: string;
  employee_id: string;
  is_auto_generated: boolean;
  tasks?: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    workstation: string;
    phases: {
      name: string;
      projects: {
        id: string;
        name: string;
        client: string;
      };
    };
  };
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeRegistrations, setActiveTimeRegistrations] = useState<any[]>([]);
  const [showFilesPopup, setShowFilesPopup] = useState<string | null>(null);
  const [showPartsDialog, setShowPartsDialog] = useState<string | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper function to get next workday (skip weekends and holidays)
  const getNextWorkday = async (date: Date) => {
    let nextDay = addDays(date, 1);
    
    try {
      // Get production team holidays
      const holidays = await holidayService.getHolidays();
      const productionHolidays = holidays
        .filter(holiday => holiday.team === 'production')
        .map(holiday => holiday.date);

      // Skip weekends and holidays
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6 || 
             productionHolidays.includes(format(nextDay, 'yyyy-MM-dd'))) {
        nextDay = addDays(nextDay, 1);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      // Fallback: just skip weekends
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay = addDays(nextDay, 1);
      }
    }
    
    return nextDay;
  };

  const [nextWorkday, setNextWorkday] = useState(new Date());
  const isViewingToday = isToday(selectedDate);
  const isViewingTomorrow = isTomorrow(selectedDate);

  // Update next workday when component mounts
  useEffect(() => {
    const updateNextWorkday = async () => {
      const next = await getNextWorkday(new Date());
      setNextWorkday(next);
    };
    updateNextWorkday();
  }, []);

  useEffect(() => {
    if (currentEmployee) {
      fetchPersonalData();
      fetchActiveTimeRegistrations();
    }
  }, [currentEmployee, selectedDate]);

  // Set up real-time listener for time registrations to update UI when TaskTimer changes
  useEffect(() => {
    if (!currentEmployee) return;

    const channel = supabase
      .channel('time-registrations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_registrations',
          filter: `employee_id=eq.${currentEmployee.id}`
        },
        (payload) => {
          console.log('Time registration changed:', payload);
          // Refresh data when time registrations change
          fetchPersonalData();
          fetchActiveTimeRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployee]);

  // Set up real-time listener for task status changes to refresh when TaskTimer stops a task
  useEffect(() => {
    if (!currentEmployee) return;

    const channel = supabase
      .channel('task-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `assignee_id=eq.${currentEmployee.id}`
        },
        (payload) => {
          console.log('Task status changed:', payload);
          // Only refresh if we're on the personal tasks page
          if (location.pathname.includes('personal-tasks')) {
            fetchPersonalData();
            fetchActiveTimeRegistrations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployee, location.pathname]);

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

      // Fetch personal schedule for selected date with enhanced query to include task and project info
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
        .gte('start_time', startOfDay(selectedDate).toISOString())
        .lte('start_time', endOfDay(selectedDate).toISOString())
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
          title: t("task_started"),
          description: t("task_started_desc"),
        });
      } else if (newStatus === 'COMPLETED') {
        console.log('Completing task:', taskId);
        await timeRegistrationService.completeTask(taskId);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
        
        toast({
          title: t("task_completed"),
          description: t("task_completed_desc"),
        });
      } else if (newStatus === 'TODO' && isTaskActive(taskId)) {
        console.log('Pausing task:', taskId);
        await timeRegistrationService.stopActiveRegistrations(currentEmployee.id);
        await fetchActiveTimeRegistrations();
        
        await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
        await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });

        toast({
          title: t("task_updated"),
          description: t("task_updated_desc", { status: newStatus }),
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
        title: t("error"),
        description: t("task_status_update_error", { message: error.message }),
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

  const handleTimelinePauseTask = (taskId: string) => {
    console.log('Pausing task from timeline:', taskId);
    handleTaskStatusChange(taskId, 'TODO');
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

  const handleDateNavigation = async (direction: 'today' | 'next' | 'planning') => {
    if (direction === 'today') {
      setSelectedDate(new Date());
    } else if (direction === 'next') {
      const next = await getNextWorkday(new Date());
      setSelectedDate(next);
    } else if (direction === 'planning') {
      // Navigate to planning page for next workday
      const next = await getNextWorkday(new Date());
      const planningDate = format(next, 'yyyy-MM-dd');
      navigate(`/planning?date=${planningDate}`);
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
        
        {/* Date Navigation Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("daily_timeline")}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">
                  {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                </span>
                {!isViewingToday && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-orange-600 font-medium">
                      {isViewingTomorrow ? 'Tomorrow' : 'Future Date'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={isViewingToday ? "default" : "outline"}
                onClick={() => handleDateNavigation('today')}
                className="flex items-center gap-2"
              >
                Today
              </Button>
              <Button
                variant={!isViewingToday ? "default" : "outline"}
                onClick={() => handleDateNavigation('next')}
                className="flex items-center gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Next Workday
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDateNavigation('planning')}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Plan Next Workday
              </Button>
            </div>
          </div>
          
          {!isViewingToday && (
            <Card className="mt-4 bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-800">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    You are viewing the planning for {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <EnhancedDailyTimeline 
            tasks={enhancedTimelineData}
            onStartTask={handleTimelineStartTask}
            onPauseTask={handleTimelinePauseTask}
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
            projectName={tasks.find(task => task.phases.projects.id === showFilesPopup)?.phases.projects.name || t("unknown_project")}
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
                title: t("success"),
                description: t("parts_list_imported_successfully"),
              });
            }}
          />
        )}

        {showBarcodeDialog && (
          <ProjectBarcodeDialog
            isOpen={true}
            onClose={() => setShowBarcodeDialog(null)}
            projectId={showBarcodeDialog}
            projectName={tasks.find(task => task.phases.projects.id === showBarcodeDialog)?.phases.projects.name || t("unknown_project")}
          />
        )}
      </div>
    </div>
  );
};

export default PersonalTasks;
