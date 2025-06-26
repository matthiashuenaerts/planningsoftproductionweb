import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, CheckCircle, Calendar, BarChart, Play, Square, FileText, Package2, QrCode, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import TaskTimer from '@/components/TaskTimer';
import EnhancedDailyTimeline from '@/components/EnhancedDailyTimeline';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import { startOfDay, endOfDay, isToday, format, parseISO } from 'date-fns';

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

  const scheduledTaskIds = schedules.map(s => s.task_id).filter(Boolean);

  const dailyTasks = tasks.filter(task => {
    const isScheduledForToday = scheduledTaskIds.includes(task.id);
    const isDueToday = isToday(new Date(`${task.due_date}T00:00:00`));
    return isScheduledForToday || isDueToday;
  });

  const sortedTasksForTab = [...dailyTasks].sort((a, b) => {
    const aStartTimeStr = scheduleTimeMap.get(a.id);
    const bStartTimeStr = scheduleTimeMap.get(b.id);

    if (aStartTimeStr && bStartTimeStr) {
      return new Date(aStartTimeStr).getTime() - new Date(bStartTimeStr).getTime();
    }
    if (aStartTimeStr) return -1;
    if (bStartTimeStr) return 1;
    
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Enhanced timeline data with better formatting
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
      workstation: '',
      priority: 'medium',
      canComplete: false,
      isActive: false
    };
  });

  // Enhanced task card component for tile view
  const TaskTile = ({ task, scheduledTime }: { task: Task; scheduledTime?: string }) => {
    const formatTime = (timeString: string) => {
      try {
        return format(parseISO(timeString), 'HH:mm');
      } catch {
        return timeString;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'TODO': return 'bg-gray-100 text-gray-800 border-gray-300';
        case 'IN_PROGRESS': return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
        case 'HOLD': return 'bg-red-100 text-red-800 border-red-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority?.toLowerCase()) {
        case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
        case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
        case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'low': return 'bg-green-100 text-green-800 border-green-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    };

    return (
      <Card className={`transition-all hover:shadow-md ${isTaskActive(task.id) ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight mb-2">{task.title}</CardTitle>
              <CardDescription className="text-sm font-medium text-blue-600 mb-2">
                {task.phases.projects.name}
              </CardDescription>
              
              {/* Time and workstation info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {scheduledTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(scheduledTime)}</span>
                  </div>
                )}
                {task.workstation && (
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{task.workstation}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(task.due_date), 'MMM dd')}</span>
                </div>
              </div>
            </div>
            
            {isTaskActive(task.id) && (
              <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium">Active</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status and Priority badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`${getStatusColor(task.status)} text-xs font-medium`}>
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge className={`${getPriorityColor(task.priority)} text-xs font-medium`}>
              {task.priority}
            </Badge>
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Project action buttons */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setShowFilesPopup(task.phases.projects.id)}
              >
                <FileText className="h-3 w-3 mr-1" />
                Files
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setShowPartsDialog(task.phases.projects.id)}
              >
                <Package2 className="h-3 w-3 mr-1" />
                Parts
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setShowBarcodeDialog(task.phases.projects.id)}
              >
                <QrCode className="h-3 w-3 mr-1" />
                Barcode
              </Button>
            </div>

            {/* Task control buttons */}
            <div className="flex gap-1 ml-auto">
              {task.status === 'TODO' && !isTaskActive(task.id) && (
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              )}
              
              {isTaskActive(task.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleTaskStatusChange(task.id, 'TODO')}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Pause
                </Button>
              )}
              
              {canCompleteTask(task) && (
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleTaskStatusChange(task.id, 'COMPLETED')}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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

  // Stats calculations
  const todoTasks = tasks.filter(task => task.status === 'TODO');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

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
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-2">Manage your personal tasks and schedule</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTimeRegistrations.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="timeline">Daily Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <div className="space-y-4">
              {sortedTasksForTab.map((task) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  scheduledTime={scheduleTimeMap.get(task.id)}
                />
              ))}
            </div>

            {tasks.length > 0 && sortedTasksForTab.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No tasks scheduled or due for today.</p>
                </CardContent>
              </Card>
            )}

            {tasks.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No tasks assigned to you.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <EnhancedDailyTimeline 
              tasks={enhancedTimelineData}
              onStartTask={handleTimelineStartTask}
              onCompleteTask={handleTimelineCompleteTask}
              onShowFiles={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) setShowFilesPopup(task.phases.projects.id);
              }}
              onShowParts={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) setShowPartsDialog(task.phases.projects.id);
              }}
              onShowBarcode={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) setShowBarcodeDialog(task.phases.projects.id);
              }}
            />
          </TabsContent>
        </Tabs>

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
