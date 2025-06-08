import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Plus,
  Play,
  Pause,
  Square
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import NewTaskModal from '@/components/NewTaskModal';
import { timeRegistrationService } from '@/services/timeRegistrationService';

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Get personal tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['personalTasks', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phases (
            name,
            projects (name)
          )
        `)
        .or(`assignee_id.eq.${currentEmployee.id},assignee_id.is.null`)
        .neq('status', 'COMPLETED')
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEmployee?.id
  });

  // Get active time registration
  const { data: activeRegistration } = useQuery({
    queryKey: ['activeTimeRegistration', currentEmployee?.id],
    queryFn: () => currentEmployee ? timeRegistrationService.getActiveRegistration(currentEmployee.id) : null,
    enabled: !!currentEmployee,
    refetchInterval: 5000
  });

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: ({ taskId }: { taskId: string }) => 
      timeRegistrationService.startTask(currentEmployee!.id, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: 'Task Started',
        description: 'Time tracking has begun for this task',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to start task timer',
        variant: 'destructive'
      });
    }
  });

  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: (registrationId: string) =>
      timeRegistrationService.stopTask(registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: 'Task Stopped',
        description: 'Time tracking has been stopped',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to stop task timer',
        variant: 'destructive'
      });
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: currentEmployee?.id
        })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks'] });
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  });

  const handleStartTask = (taskId: string) => {
    // Stop current task if any
    if (activeRegistration && activeRegistration.is_active) {
      stopTaskMutation.mutate(activeRegistration.id);
    }
    
    // Start new task
    startTaskMutation.mutate({ taskId });
  };

  const handleStopTask = () => {
    if (activeRegistration) {
      stopTaskMutation.mutate(activeRegistration.id);
    }
  };

  const handleCompleteTask = (taskId: string) => {
    // Stop timer if this task is active
    if (activeRegistration?.task_id === taskId && activeRegistration.is_active) {
      stopTaskMutation.mutate(activeRegistration.id);
    }
    
    completeTaskMutation.mutate(taskId);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'HOLD':
        return 'bg-orange-100 text-orange-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isTaskActive = (taskId: string) => {
    return activeRegistration?.task_id === taskId && activeRegistration.is_active;
  };

  const canStartTask = (taskStatus: string) => {
    return taskStatus === 'TODO' || taskStatus === 'HOLD';
  };

  const canCompleteTask = (taskStatus: string) => {
    return taskStatus === 'TODO' || taskStatus === 'IN_PROGRESS' || taskStatus === 'HOLD';
  };

  const groupedTasks = tasks.reduce((acc: any, task: any) => {
    const status = task.status;
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(task);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
            <p className="text-gray-600 mt-2">Manage your assigned tasks and track your progress</p>
          </div>
          
          {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager') && (
            <Button
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>

        {/* Task Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedTasks.TODO?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedTasks.IN_PROGRESS?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
              <Square className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedTasks.HOLD?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-6">
          {Object.keys(groupedTasks).map((status) => (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Badge className={getStatusColor(status)} variant="outline">
                    {status.replace('_', ' ')}
                  </Badge>
                  <span className="ml-2">({groupedTasks[status].length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupedTasks[status].map((task: any) => (
                    <div key={task.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold">{task.title}</h3>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            {isTaskActive(task.id) && (
                              <Badge className="bg-green-100 text-green-800 animate-pulse">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                          
                          {task.description && (
                            <p className="text-gray-600 mb-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="h-4 w-4 mr-1" />
                            Due: {new Date(task.due_date).toLocaleDateString()}
                            {task.duration && (
                              <span className="ml-4">
                                Duration: {task.duration} minutes
                              </span>
                            )}
                          </div>
                          
                          {task.phases?.projects && (
                            <p className="text-sm text-gray-500 mt-1">
                              Project: {task.phases.projects.name} - {task.phases.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {isTaskActive(task.id) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleStopTask}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Stop
                            </Button>
                          ) : canStartTask(task.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartTask(task.id)}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          )}
                          
                          {canCompleteTask(task.status) && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteTask(task.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {groupedTasks[status].length === 0 && (
                    <p className="text-gray-500 text-center py-4">No {status.toLowerCase().replace('_', ' ')} tasks</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <NewTaskModal
          isOpen={showNewTaskModal}
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={() => {
            setShowNewTaskModal(false);
            queryClient.invalidateQueries({ queryKey: ['personalTasks'] });
          }}
        />
      </div>
    </div>
  );
};

export default PersonalTasks;
