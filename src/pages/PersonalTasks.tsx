import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { timeRegistrationService } from '@/services/timeRegistrationService';

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);

  // Fetch tasks assigned to the current employee
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['personalTasks', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phases (
            name,
            projects (name)
          )
        `)
        .eq('assignee', currentEmployee.id)
        .order('due_date', { ascending: true });

      if (error) {
        throw error;
      }
      return data;
    },
    enabled: !!currentEmployee,
  });

  // Fetch active time registrations for the current employee
  const { data: activeRegistrations } = useQuery({
    queryKey: ['activeTimeRegistrations', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];

      const { data, error } = await supabase
        .from('time_registrations')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .eq('is_active', true);

      if (error) {
        throw error;
      }
      return data;
    },
    enabled: !!currentEmployee,
  });

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!currentEmployee) throw new Error('No employee logged in');
      return timeRegistrationService.startTask(currentEmployee.id, taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks', currentEmployee?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistrations', currentEmployee?.id] });
      toast({
        title: 'Task Started',
        description: 'Time tracking has begun for this task',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to start task timer',
        variant: 'destructive'
      });
      console.error('Start task error:', error);
    },
    onMutate: (taskId: string) => {
      setStartingTaskId(taskId);
    },
    onSettled: () => {
      setStartingTaskId(null);
    }
  });

  // Pause task mutation
  const pauseTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const activeReg = activeRegistrations?.find(reg => reg.task_id === taskId);
      if (!activeReg) throw new Error('No active registration found for this task');
      return timeRegistrationService.stopTask(activeReg.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks', currentEmployee?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistrations', currentEmployee?.id] });
      toast({
        title: 'Task Paused',
        description: 'Time tracking has been paused',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to pause task timer',
        variant: 'destructive'
      });
      console.error('Pause task error:', error);
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'COMPLETED' })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks', currentEmployee?.id] });
      toast({
        title: 'Task Completed',
        description: 'Task marked as completed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
      console.error('Complete task error:', error);
    }
  });

  const handleStartTask = (taskId: string) => {
    startTaskMutation.mutate(taskId);
  };

  const handlePauseTask = (taskId: string) => {
    pauseTaskMutation.mutate(taskId);
  };

  const handleCompleteTask = (taskId: string) => {
    completeTaskMutation.mutate(taskId);
  };

  const loading = tasksLoading || startTaskMutation.isLoading || pauseTaskMutation.isLoading || completeTaskMutation.isLoading;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'TODO':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'HOLD':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'TODO':
        return 'bg-yellow-100 text-yellow-800';
      case 'HOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canStartTask = (status: string) => {
    return status === 'TODO' || status === 'HOLD';
  };

  const canCompleteTask = (status: string) => {
    return status === 'IN_PROGRESS';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Personal Tasks</h1>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold">{tasks?.length || 0}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tasks?.filter(t => t.status === 'COMPLETED').length || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {tasks?.filter(t => t.status === 'IN_PROGRESS').length || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {tasks?.filter(t => t.status === 'TODO' || t.status === 'HOLD').length || 0}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {tasks?.map((task) => {
              const activeReg = activeRegistrations?.find(reg => reg.task_id === task.id);
              const isTaskActive = activeReg?.is_active;
              
              return (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <p className="text-sm text-gray-600">
                            {(task as any).phases?.projects?.name} - {(task as any).phases?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isTaskActive && (
                          <Badge className="bg-green-100 text-green-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Active Timer
                          </Badge>
                        )}
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {task.description && (
                        <p className="text-gray-700">{task.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        <span>Priority: {task.priority}</span>
                        <span>Workstation: {task.workstation}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {canStartTask(task.status) && (
                          <Button
                            onClick={() => handleStartTask(task.id)}
                            disabled={startingTaskId === task.id}
                            size="sm"
                            className="flex items-center space-x-1"
                          >
                            <Play className="h-3 w-3" />
                            <span>{startingTaskId === task.id ? 'Starting...' : 'Start Task'}</span>
                          </Button>
                        )}
                        
                        {task.status === 'IN_PROGRESS' && (
                          <Button
                            onClick={() => handlePauseTask(task.id)}
                            size="sm"
                            variant="outline"
                            className="flex items-center space-x-1"
                          >
                            <Pause className="h-3 w-3" />
                            <span>Pause</span>
                          </Button>
                        )}
                        
                        {canCompleteTask(task.status) && (
                          <Button
                            onClick={() => handleCompleteTask(task.id)}
                            size="sm"
                            variant="outline"
                            className="flex items-center space-x-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            <span>Complete</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {tasks?.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks assigned</h3>
                  <p className="text-gray-600">You don't have any personal tasks assigned yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
