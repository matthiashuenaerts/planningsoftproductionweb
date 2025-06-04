import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TaskTimer = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Don't render for workstation users
  if (currentEmployee?.role === 'workstation') {
    return null;
  }

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get active registration
  const { data: activeRegistration, isLoading } = useQuery({
    queryKey: ['activeTimeRegistration', currentEmployee?.id],
    queryFn: () => currentEmployee ? timeRegistrationService.getActiveRegistration(currentEmployee.id) : null,
    enabled: !!currentEmployee,
    refetchInterval: 5000 // Refetch every 5 seconds
  });

  // Get task details if there's an active registration
  const { data: taskDetails } = useQuery({
    queryKey: ['taskDetails', activeRegistration?.task_id],
    queryFn: async () => {
      if (!activeRegistration?.task_id) return null;
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          title,
          phases (
            name,
            projects (name)
          )
        `)
        .eq('id', activeRegistration.task_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeRegistration?.task_id
  });

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: ({ employeeId, taskId }: { employeeId: string; taskId: string }) =>
      timeRegistrationService.startTask(employeeId, taskId),
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
      console.error('Start task error:', error);
    }
  });

  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: (registrationId: string) =>
      timeRegistrationService.stopTask(registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: 'Task Paused',
        description: 'Time tracking has been paused',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to pause task timer',
        variant: 'destructive'
      });
      console.error('Stop task error:', error);
    }
  });

  const handleTimerClick = () => {
    if (!currentEmployee) return;

    if (activeRegistration && activeRegistration.is_active) {
      // Stop the active task
      stopTaskMutation.mutate(activeRegistration.id);
    } else {
      // Need to select a task to start - for now, show a message
      toast({
        title: 'No Active Task',
        description: 'Start a task from the workstation or personal tasks page to begin time tracking',
      });
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading || !currentEmployee) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 z-50">
      <Card 
        className={`cursor-pointer transition-colors max-w-sm ${
          activeRegistration && activeRegistration.is_active 
            ? 'border-green-500 bg-green-50 hover:bg-green-100' 
            : 'border-red-500 bg-red-50 hover:bg-red-100'
        }`}
        onClick={handleTimerClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-1.5 rounded-full ${
                activeRegistration && activeRegistration.is_active 
                  ? 'bg-green-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}>
                {activeRegistration && activeRegistration.is_active ? 
                  <Pause className="h-3 w-3" /> : 
                  <Play className="h-3 w-3" />
                }
              </div>
              
              <div>
                {activeRegistration && taskDetails ? (
                  <div>
                    <p className="font-medium text-xs">
                      {(taskDetails as any).phases?.projects?.name || 'Unknown Project'}
                    </p>
                    <p className="text-xs text-gray-600 truncate max-w-32">
                      {taskDetails.title}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-xs text-gray-500">No Active Task</p>
                    <p className="text-xs text-gray-400">Click to start</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="font-mono text-sm font-medium">
                {activeRegistration && activeRegistration.is_active 
                  ? formatDuration(activeRegistration.start_time)
                  : '00:00:00'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskTimer;
