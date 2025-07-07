
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';
import { Play, Pause, Clock, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TaskTimer = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();

  // Don't render for workstation users or on general schedule page
  if (currentEmployee?.role === 'workstation' || location.pathname.includes('/general-schedule')) {
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
    refetchInterval: 1000 // Refetch every second for real-time updates
  });

  // Get task details if there's an active registration
  const { data: taskDetails } = useQuery({
    queryKey: ['taskDetails', activeRegistration?.task_id, activeRegistration?.workstation_task_id],
    queryFn: async () => {
      if (!activeRegistration) return null;
      
      // Handle regular tasks
      if (activeRegistration.task_id) {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            title,
            duration,
            phases (
              name,
              projects (name)
            )
          `)
          .eq('id', activeRegistration.task_id)
          .single();
        
        if (error) throw error;
        return {
          title: data.title,
          project_name: data.phases?.projects?.name || 'Unknown Project',
          duration: data.duration,
          is_workstation_task: false
        };
      }
      
      // Handle workstation tasks
      if (activeRegistration.workstation_task_id) {
        const { data: workstationTask, error: workstationError } = await supabase
          .from('workstation_tasks')
          .select(`
            task_name,
            duration,
            workstations (name)
          `)
          .eq('id', activeRegistration.workstation_task_id)
          .single();
        
        if (workstationError) throw workstationError;
        
        return {
          title: workstationTask.task_name,
          project_name: `Workstation: ${workstationTask.workstations?.name || 'Unknown'}`,
          duration: workstationTask.duration,
          is_workstation_task: true
        };
      }
      
      return null;
    },
    enabled: !!activeRegistration && (!!activeRegistration.task_id || !!activeRegistration.workstation_task_id)
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
      queryClient.invalidateQueries({ queryKey: ['workstationTasks'] });
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

  const formatRemainingDuration = (startTime: string, durationMinutes: number | null | undefined) => {
    if (durationMinutes === null || typeof durationMinutes === 'undefined') {
        return null;
    }

    const start = new Date(startTime);
    const now = currentTime;
    const elapsedMs = now.getTime() - start.getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const remainingMs = durationMs - elapsedMs;

    const isNegative = remainingMs < 0;
    const absRemainingMs = Math.abs(remainingMs);

    const hours = Math.floor(absRemainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((absRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absRemainingMs % (1000 * 60)) / 1000);

    return `${isNegative ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  const isTimeNegative = (startTime: string, durationMinutes: number | null | undefined) => {
    if (durationMinutes === null || typeof durationMinutes === 'undefined') {
        return false;
    }
    const start = new Date(startTime);
    const now = currentTime;
    const elapsedMs = now.getTime() - start.getTime();
    const durationMs = durationMinutes * 60 * 1000;
    return durationMs - elapsedMs < 0;
  }

  if (isLoading || !currentEmployee) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        <Card 
          className={`cursor-pointer transition-colors max-w-sm ${
            activeRegistration && activeRegistration.is_active 
              ? 'border-green-500 bg-green-50 hover:bg-green-100' 
              : 'border-red-500 bg-red-50 hover:bg-red-100'
          }`}
          onClick={handleTimerClick}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
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
                
                <div className="min-w-0 flex-1">
                  {activeRegistration && taskDetails ? (
                    <div>
                      <p className="font-medium text-xs truncate">
                        {taskDetails.project_name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {taskDetails.title}
                      </p>
                      {taskDetails.is_workstation_task && (
                        <p className="text-xs text-blue-600">Workstation Task</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-xs text-gray-500">No Active Task</p>
                      <p className="text-xs text-gray-400">Click to start</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <span className="font-mono text-sm font-medium">
                    {activeRegistration && activeRegistration.is_active 
                      ? formatDuration(activeRegistration.start_time)
                      : '00:00:00'
                    }
                  </span>
                </div>
                {activeRegistration && activeRegistration.is_active && taskDetails?.duration != null && (
                  <div className="flex items-center space-x-1">
                    <Timer className="h-3 w-3 text-gray-500" />
                    <span className={`font-mono text-xs font-medium ${isTimeNegative(activeRegistration.start_time, taskDetails.duration) ? 'text-red-500' : ''}`}>
                      {formatRemainingDuration(activeRegistration.start_time, taskDetails.duration)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskTimer;
