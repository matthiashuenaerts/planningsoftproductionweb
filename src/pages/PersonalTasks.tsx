import React, { useState, useEffect } from 'react';
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
import DailyTimeline from '@/components/DailyTimeline';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import EnhancedTaskCard from '@/components/EnhancedTaskCard';
import { startOfDay, endOfDay } from 'date-fns';

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
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
      } else if (newStatus === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        await fetchActiveTimeRegistrations();
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
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
    return activeTimeRegistrations.some(reg => reg.task_id === taskId);
  };

  const canStartTask = (task: Task) => {
    return task.status === 'TODO' && !isTaskActive(task.id);
  };

  const canCompleteTask = (task: Task) => {
    return (task.status === 'IN_PROGRESS' || isTaskActive(task.id)) && task.status !== 'COMPLETED';
  };

  // Convert schedules to timeline format for DailyTimeline component
  const timelineTasks = schedules.map(schedule => ({
    id: schedule.id,
    title: schedule.title,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    description: schedule.description,
    status: 'scheduled',
    project_name: schedule.title,
    workstation: '',
    priority: 'medium',
    canStart: false,
    canComplete: false,
    isActive: false
  }));

  const scheduledTaskIds = schedules.map(s => s.task_id).filter(Boolean);

  // Add actual tasks to timeline with proper project information
  const taskTimelineItems = tasks
    .filter(task => !scheduledTaskIds.includes(task.id))
    .map(task => ({
      id: task.id,
      title: task.title,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + (task.duration || 1) * 60 * 60 * 1000).toISOString(),
      description: task.description || '',
      status: task.status.toLowerCase(),
      project_name: task.phases.projects.name,
      workstation: task.workstation,
      priority: task.priority,
      canStart: canStartTask(task),
      canComplete: canCompleteTask(task),
      isActive: isTaskActive(task.id)
    }));

  // Combine schedules and tasks for timeline
  const allTimelineTasks = [...timelineTasks, ...taskTimelineItems];

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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {tasks.map((task) => (
                <EnhancedTaskCard
                  key={task.id}
                  task={task}
                  isActive={isTaskActive(task.id)}
                  canStart={canStartTask(task)}
                  canComplete={canCompleteTask(task)}
                  onStatusChange={handleTaskStatusChange}
                  onShowFiles={setShowFilesPopup}
                  onShowParts={setShowPartsDialog}
                  onShowBarcode={setShowBarcodeDialog}
                />
              ))}
            </div>

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
            <DailyTimeline 
              tasks={allTimelineTasks}
              onShowFiles={setShowFilesPopup}
              onShowParts={setShowPartsDialog}
              onShowBarcode={setShowBarcodeDialog}
              onStartTask={handleTimelineStartTask}
              onCompleteTask={handleTimelineCompleteTask}
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
