
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Play, 
  Pause, 
  CheckCircle, 
  Calendar,
  User,
  Building2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date: string;
  workstation: string;
  assignee_id?: string;
  phase_id: string;
  standard_task_id?: string;
  phases: {
    name: string;
    projects: {
      name: string;
    };
  };
  employees?: {
    name: string;
  };
}

interface TimeRegistration {
  id: string;
  task_id: string;
  employee_id: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [activeTimers, setActiveTimers] = useState<Record<string, TimeRegistration>>({});

  // Get tasks assigned to current employee
  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['personal-tasks', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phases (
            name,
            projects (name)
          ),
          employees (name)
        `)
        .eq('assignee_id', currentEmployee.id)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentEmployee?.id
  });

  // Get active time registrations
  const { data: timeRegistrations = [] } = useQuery({
    queryKey: ['time-registrations', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      
      const { data, error } = await supabase
        .from('time_registrations')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as TimeRegistration[];
    },
    enabled: !!currentEmployee?.id,
    refetchInterval: 5000
  });

  // Update active timers state when data changes
  React.useEffect(() => {
    const timersMap: Record<string, TimeRegistration> = {};
    timeRegistrations.forEach(reg => {
      timersMap[reg.task_id] = reg;
    });
    setActiveTimers(timersMap);
  }, [timeRegistrations]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          status_changed_at: new Date().toISOString(),
          ...(newStatus === 'COMPLETED' ? { 
            completed_at: new Date().toISOString(),
            completed_by: currentEmployee?.id 
          } : {})
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Updated',
        description: `Task status changed to ${newStatus.toLowerCase()}`,
      });

      refetch();
      setSelectedTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive'
      });
    }
  };

  const toggleTimer = async (task: Task) => {
    if (!currentEmployee?.id) return;

    try {
      const activeTimer = activeTimers[task.id];
      
      if (activeTimer) {
        // Stop the timer
        await timeRegistrationService.stopTask(activeTimer.id);
        toast({
          title: 'Timer Stopped',
          description: `Stopped tracking time for "${task.title}"`,
        });
      } else {
        // Start the timer
        await timeRegistrationService.startTask(currentEmployee.id, task.id);
        toast({
          title: 'Timer Started',
          description: `Started tracking time for "${task.title}"`,
        });
      }
      
      // Refetch to update the UI
      refetch();
    } catch (error) {
      console.error('Timer toggle error:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle timer',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'HOLD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getDateStatus = (dueDate: string) => {
    const date = parseISO(dueDate);
    if (isToday(date)) return { text: 'Due Today', color: 'text-red-600' };
    if (isTomorrow(date)) return { text: 'Due Tomorrow', color: 'text-orange-600' };
    return { text: format(date, 'MMM d, yyyy'), color: 'text-gray-600' };
  };

  const formatTimerDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const filterTasks = (status: string) => {
    return tasks.filter(task => {
      if (status === 'active') {
        return task.status === 'TODO' || task.status === 'IN_PROGRESS';
      }
      return task.status === status;
    });
  };

  const renderTaskCard = (task: Task) => {
    const dateStatus = getDateStatus(task.due_date);
    const activeTimer = activeTimers[task.id];
    const isTimerActive = !!activeTimer;

    return (
      <Card key={task.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                {task.phases?.projects?.name || 'Unknown Project'}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Phase: {task.phases?.name || 'Unknown Phase'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
          {task.description && (
            <p className="text-gray-600 text-sm mb-3">{task.description}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className={`text-sm ${dateStatus.color}`}>
                {dateStatus.text}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{task.workstation}</span>
            </div>
            {isTimerActive && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm font-mono text-green-600">
                  {formatTimerDuration(activeTimer.start_time)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => toggleTimer(task)}
              size="sm"
              variant={isTimerActive ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {isTimerActive ? (
                <>
                  <Pause className="h-4 w-4" />
                  Stop Timer
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Timer
                </>
              )}
            </Button>

            {task.status === 'TODO' && (
              <Button
                onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                size="sm"
                variant="outline"
              >
                Start Task
              </Button>
            )}

            {task.status === 'IN_PROGRESS' && (
              <Button
                onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                size="sm"
                variant="outline"
                className="text-green-600 border-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}

            <Button
              onClick={() => setSelectedTask(task)}
              size="sm"
              variant="ghost"
            >
              <FileText className="h-4 w-4 mr-2" />
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  const activeTasks = filterTasks('active');
  const completedTasks = filterTasks('COMPLETED');
  const holdTasks = filterTasks('HOLD');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-2">Manage your assigned tasks and time tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                Tasks in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                Tasks completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{holdTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                Tasks on hold
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Tasks ({activeTasks.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
            <TabsTrigger value="hold">On Hold ({holdTasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeTasks.length > 0 ? (
              activeTasks.map(renderTaskCard)
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No active tasks</h3>
                    <p className="mt-1 text-sm text-gray-500">All your tasks are completed or on hold.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTasks.length > 0 ? (
              completedTasks.map(renderTaskCard)
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No completed tasks</h3>
                    <p className="mt-1 text-sm text-gray-500">Complete some tasks to see them here.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="hold" className="space-y-4">
            {holdTasks.length > 0 ? (
              holdTasks.map(renderTaskCard)
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks on hold</h3>
                    <p className="mt-1 text-sm text-gray-500">Tasks that are paused will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Task Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedTask.title}</h3>
                  <p className="text-sm text-gray-600">{selectedTask.description}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Status:</span>
                    <Badge className={getStatusColor(selectedTask.status)}>
                      {selectedTask.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Priority:</span>
                    <span className={`text-sm ${getPriorityColor(selectedTask.priority)}`}>
                      {selectedTask.priority}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Due Date:</span>
                    <span className="text-sm">{format(parseISO(selectedTask.due_date), 'PPP')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Workstation:</span>
                    <span className="text-sm">{selectedTask.workstation}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Update
                  </label>
                  <Textarea
                    placeholder="Add a status update or comment..."
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTask(null);
                      setStatusUpdate('');
                    }}
                  >
                    Close
                  </Button>
                  
                  {selectedTask.status !== 'COMPLETED' && (
                    <Button
                      onClick={() => updateTaskStatus(selectedTask.id, 'COMPLETED')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalTasks;
