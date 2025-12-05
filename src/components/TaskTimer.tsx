import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { Play, Pause, Clock, Timer, Move, Minimize2, Maximize2, PictureInPicture } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TaskExtraTimeDialog from './TaskExtraTimeDialog';
const TaskTimer = () => {
  const {
    currentEmployee
  } = useAuth();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();
const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const [activeUsersOnTask, setActiveUsersOnTask] = useState(1);

  // Draggable and UI state
  const [position, setPosition] = useState({
    x: 0,
    y: 16
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showExtraTimeDialog, setShowExtraTimeDialog] = useState(false);
  const [pendingStopData, setPendingStopData] = useState<{
    registrationId: string;
    taskDetails: any;
    overTimeMinutes: number;
    elapsedMinutes: number;
  } | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const pipWindow = useRef<Window | null>(null);

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

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof Element && (e.target.closest('button') || e.target.closest('[role="button"]'))) {
      return; // Don't start dragging when clicking on buttons
    }
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Constrain to viewport
    const maxX = window.innerWidth - (timerRef.current?.offsetWidth || 0);
    const maxY = window.innerHeight - (timerRef.current?.offsetHeight || 0);
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Picture-in-picture functionality
  const togglePictureInPicture = async () => {
    if (isPictureInPicture && pipWindow.current) {
      pipWindow.current.close();
      setIsPictureInPicture(false);
    } else {
      try {
        // Check if Document Picture-in-Picture API is supported
        if ('documentPictureInPicture' in window) {
          // @ts-ignore - Document Picture-in-Picture API is experimental
          const pipWindowInstance = await window.documentPictureInPicture.requestWindow({
            width: 320,
            height: 120
          });
          pipWindow.current = pipWindowInstance;
          setIsPictureInPicture(true);

          // Handle pip window close
          pipWindowInstance.addEventListener('pagehide', () => {
            setIsPictureInPicture(false);
            pipWindow.current = null;
          });
        } else {
          throw new Error('Picture-in-Picture not supported');
        }
      } catch (error) {
        toast({
          title: 'Picture-in-Picture not supported',
          description: 'Your browser does not support Picture-in-Picture for documents',
          variant: 'destructive'
        });
      }
    }
  };

  // Event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart.x, dragStart.y]);

  // Get active registration
  const {
    data: activeRegistration,
    isLoading
  } = useQuery({
    queryKey: ['activeTimeRegistration', currentEmployee?.id],
    queryFn: () => currentEmployee ? timeRegistrationService.getActiveRegistration(currentEmployee.id) : null,
    enabled: !!currentEmployee,
    refetchInterval: 1000 // Refetch every second for real-time updates
  });

  // Get last worked task when there's no active registration
  const {
    data: lastWorkedTask
  } = useQuery({
    queryKey: ['lastWorkedTask', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return null;
      const {
        data,
        error
      } = await supabase.from('time_registrations').select(`
          task_id,
          workstation_task_id,
          end_time,
          tasks (
            id,
            title,
            phases (
              name,
              project_id,
              projects (name, id)
            )
          ),
          workstation_tasks (
            id,
            task_name,
            workstations (name)
          )
        `).eq('employee_id', currentEmployee.id).eq('is_active', false).not('end_time', 'is', null).or('task_id.not.is.null,workstation_task_id.not.is.null').order('end_time', {
        ascending: false
      }).limit(1).maybeSingle();
      if (error || !data) {
        console.log('Error fetching last worked task:', error);
        return null;
      }
      if (data.task_id && data.tasks) {
        return {
          id: data.task_id,
          title: data.tasks.title,
          project_name: data.tasks.phases?.projects?.name || 'Unknown Project',
          project_id: data.tasks.phases?.projects?.id,
          is_workstation_task: false
        };
      } else if (data.workstation_task_id && data.workstation_tasks) {
        return {
          id: data.workstation_task_id,
          title: data.workstation_tasks.task_name,
          project_name: `Workstation: ${data.workstation_tasks.workstations?.name || 'Unknown'}`,
          is_workstation_task: true
        };
      }
      return null;
    },
    enabled: !!currentEmployee && (!activeRegistration || !activeRegistration.is_active)
  });

  // Real-time tracking of active users on the same task
  useEffect(() => {
    if (!activeRegistration || !activeRegistration.is_active) {
      setActiveUsersOnTask(1);
      return;
    }
    const fetchActiveUsersCount = async () => {
      try {
        let query = supabase.from('time_registrations').select('id').eq('is_active', true);

        // Check if it's a regular task or workstation task
        if (activeRegistration.task_id) {
          query = query.eq('task_id', activeRegistration.task_id);
        } else if (activeRegistration.workstation_task_id) {
          query = query.eq('workstation_task_id', activeRegistration.workstation_task_id);
        }
        const {
          data,
          error
        } = await query;
        if (!error && data) {
          setActiveUsersOnTask(Math.max(1, data.length));
        }
      } catch (error) {
        console.error('Error fetching active users count:', error);
      }
    };

    // Initial fetch
    fetchActiveUsersCount();

    // Set up real-time subscription for immediate updates
    const channel = supabase.channel('active-task-users').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'time_registrations'
    }, payload => {
      // Immediately refetch when any time registration changes
      fetchActiveUsersCount();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRegistration?.task_id, activeRegistration?.workstation_task_id, activeRegistration?.is_active]);

  // Get task details if there's an active registration
  const {
    data: taskDetails
  } = useQuery({
    queryKey: ['taskDetails', activeRegistration?.task_id, activeRegistration?.workstation_task_id],
    queryFn: async () => {
      if (!activeRegistration) return null;

      // Handle regular tasks
      if (activeRegistration.task_id) {
        const {
          data,
          error
        } = await supabase.from('tasks').select(`
            title,
            duration,
            phases (
              name,
              project_id,
              projects (name, id)
            )
          `).eq('id', activeRegistration.task_id).single();
        if (error) throw error;
        return {
          title: data.title,
          project_name: data.phases?.projects?.name || 'Unknown Project',
          project_id: data.phases?.projects?.id,
          duration: data.duration,
          is_workstation_task: false
        };
      }

      // Handle workstation tasks
      if (activeRegistration.workstation_task_id) {
        const {
          data: workstationTask,
          error: workstationError
        } = await supabase.from('workstation_tasks').select(`
            task_name,
            duration,
            workstations (name)
          `).eq('id', activeRegistration.workstation_task_id).single();
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
    mutationFn: async ({
      employeeId,
      taskId
    }: {
      employeeId: string;
      taskId: string;
    }) => {
      // Check if current task has negative time before starting new one
      if (activeRegistration?.is_active && taskDetails?.duration && activeRegistration.start_time) {
        const start = new Date(activeRegistration.start_time);
        const now = new Date();
        const elapsedMs = now.getTime() - start.getTime();
        const adjustedDurationMs = taskDetails.duration * 60 * 1000 / activeUsersOnTask;
        const remainingMs = adjustedDurationMs - elapsedMs;
        
        if (remainingMs < 0) {
          // Current timer is negative, must handle this first
          throw new Error('NEGATIVE_TIME_PENDING');
        }
      }
      
      return timeRegistrationService.startTask(employeeId, taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activeTimeRegistration']
      });
      toast({
        title: 'Task Started',
        description: 'Time tracking has begun for this task'
      });
    },
    onError: error => {
      if (error instanceof Error && error.message === 'NEGATIVE_TIME_PENDING') {
        toast({
          title: 'Timer Overtime',
          description: 'Please stop the current task and set a new duration first',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to start task timer',
          variant: 'destructive'
        });
        console.error('Start task error:', error);
      }
    }
  });

  // Stop task mutation
  const stopTaskMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      // Stop the time registration first
      await timeRegistrationService.stopTask(registrationId);
      
      // Only update actual duration for regular tasks, not workstation tasks
      if (activeRegistration?.task_id && activeRegistration?.start_time) {
        const start = new Date(activeRegistration.start_time);
        const now = new Date();
        const elapsedMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
        
        // Get current task data
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('actual_duration_minutes, duration')
          .eq('id', activeRegistration.task_id)
          .single();
        
        if (currentTask) {
          const newActualDuration = (currentTask.actual_duration_minutes || 0) + elapsedMinutes;
          const efficiencyPercentage = currentTask.duration > 0 
            ? Math.round((currentTask.duration / newActualDuration) * 100)
            : 100;
          
          // Update task with new actual duration and efficiency
          await supabase
            .from('tasks')
            .update({
              actual_duration_minutes: newActualDuration,
              efficiency_percentage: efficiencyPercentage
            })
            .eq('id', activeRegistration.task_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activeTimeRegistration']
      });
      queryClient.invalidateQueries({
        queryKey: ['workstationTasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['taskDetails']
      });
      toast({
        title: 'Task Paused',
        description: 'Time tracking has been paused'
      });
      setPendingStopData(null);
    },
    onError: error => {
      toast({
        title: 'Error',
        description: 'Failed to pause task timer',
        variant: 'destructive'
      });
      console.error('Stop task error:', error);
      setPendingStopData(null);
    }
  });

  // Update task duration mutation
  const updateTaskDurationMutation = useMutation({
    mutationFn: async ({
      taskId,
      workstationTaskId,
      extraMinutes
    }: {
      taskId?: string;
      workstationTaskId?: string;
      extraMinutes: number;
    }) => {
      if (taskId) {
        // Set the task's duration to the selected extra time (in minutes)
        return supabase.from('tasks').update({
          duration: extraMinutes
        }).eq('id', taskId);
      } else if (workstationTaskId) {
        // Set the workstation task's duration to the selected extra time (in minutes)
        return supabase.from('workstation_tasks').update({
          duration: extraMinutes
        }).eq('id', workstationTaskId);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Task Duration Updated',
        description: 'Selected time saved; next countdown will use it.'
      });
      // Invalidate any taskDetails queries to ensure fresh duration on next start
      queryClient.invalidateQueries({
        queryKey: ['taskDetails']
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description: 'Failed to update task duration',
        variant: 'destructive'
      });
      console.error('Update task duration error:', error);
    }
  });
  const handleTimerClick = async () => {
    if (!currentEmployee) return;
    if (activeRegistration && activeRegistration.is_active) {
      // Check if countdown timer is negative before stopping
      if (taskDetails?.duration && activeRegistration.start_time) {
        const start = new Date(activeRegistration.start_time);
        const now = new Date();
        const elapsedMs = now.getTime() - start.getTime();
        const adjustedDurationMs = taskDetails.duration * 60 * 1000 / activeUsersOnTask;
        const remainingMs = adjustedDurationMs - elapsedMs;
        
        if (remainingMs < 0) {
          // Timer is negative - first reset timer to zero by updating start_time to NOW
          const overTimeMinutes = Math.floor(Math.abs(remainingMs) / (1000 * 60));
          
          // Reset start_time to NOW so elapsed becomes 0
          await supabase
            .from('time_registrations')
            .update({ start_time: new Date().toISOString() })
            .eq('id', activeRegistration.id);
          
          // Invalidate to refresh the registration with new start_time
          await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
          
          setPendingStopData({
            registrationId: activeRegistration.id,
            taskDetails,
            overTimeMinutes,
            elapsedMinutes: 0 // Now elapsed is 0
          });
          setShowExtraTimeDialog(true);
          return;
        }
      }

      // Stop the active task normally
      stopTaskMutation.mutate(activeRegistration.id);
    } else if (lastWorkedTask) {
      // Restart the last worked task
      if (lastWorkedTask.is_workstation_task) {
        // For workstation tasks, we need to use a different service method
        toast({
          title: 'Workstation Task',
          description: 'Please restart workstation tasks from the workstation page'
        });
      } else {
        // Start the previous regular task
        startTaskMutation.mutate({
          employeeId: currentEmployee.id,
          taskId: lastWorkedTask.id
        });
      }
    } else {
      // No previous task found
      toast({
        title: 'No Previous Task',
        description: 'Start a task from the workstation or personal tasks page to begin time tracking'
      });
    }
  };
  const handleExtraTimeConfirm = async (totalMinutes: number) => {
  if (!pendingStopData || !currentEmployee) return;

  try {
    // Update de taakduur eerst
    if (activeRegistration?.task_id) {
      await supabase
        .from('tasks')
        .update({ duration: totalMinutes })
        .eq('id', activeRegistration.task_id);
    } else if (activeRegistration?.workstation_task_id) {
      await supabase
        .from('workstation_tasks')
        .update({ duration: totalMinutes })
        .eq('id', activeRegistration.workstation_task_id);
    }

    // Forceer direct herladen van taskDetails zodat nieuwe duur bekend is
    await queryClient.invalidateQueries({ queryKey: ['taskDetails'] });

    // Stop de tijdsregistratie
    await timeRegistrationService.stopTask(pendingStopData.registrationId);

    // Herlaad ook de actieve registratie
    await queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });

    toast({
      title: 'Task Duration Updated',
      description: `Task paused with new duration: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to update task duration',
      variant: 'destructive',
    });
    console.error('Update task duration error:', error);
  }

  setShowExtraTimeDialog(false);
  setPendingStopData(null);
};

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor(diffMs % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(diffMs % (1000 * 60) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const formatRemainingDuration = (startTime: string, durationMinutes: number | null | undefined) => {
    if (durationMinutes === null || typeof durationMinutes === 'undefined') {
      return null;
    }
    const start = new Date(startTime);
    const now = currentTime;
    const elapsedMs = now.getTime() - start.getTime();
    // Adjust duration based on number of active users (more users = faster completion)
    const adjustedDurationMs = durationMinutes * 60 * 1000 / activeUsersOnTask;
    const remainingMs = adjustedDurationMs - elapsedMs;
    const isNegative = remainingMs < 0;
    const absRemainingMs = Math.abs(remainingMs);
    const hours = Math.floor(absRemainingMs / (1000 * 60 * 60));
    const minutes = Math.floor(absRemainingMs % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(absRemainingMs % (1000 * 60) / 1000);
    return `${isNegative ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const isTimeNegative = (startTime: string, durationMinutes: number | null | undefined) => {
    if (durationMinutes === null || typeof durationMinutes === 'undefined') {
      return false;
    }
    const start = new Date(startTime);
    const now = currentTime;
    const elapsedMs = now.getTime() - start.getTime();
    // Adjust duration based on number of active users
    const adjustedDurationMs = durationMinutes * 60 * 1000 / activeUsersOnTask;
    return adjustedDurationMs - elapsedMs < 0;
  };
  if (isLoading || !currentEmployee) {
    return null;
  }

  // Render PiP content in the picture-in-picture window
  if (isPictureInPicture && pipWindow.current) {
    const pipDocument = pipWindow.current.document;

    // Create minimal timer content for PiP
    const pipContent = `
      <html>
        <head>
          <title>Task Timer</title>
          <style>
            body {
              margin: 0;
              padding: 8px;
              font-family: system-ui;
              background: ${activeRegistration?.is_active ? '#dcfce7' : '#fef2f2'};
              display: flex;
              align-items: center;
              justify-content: space-between;
              height: calc(100vh - 16px);
            }
            .timer-content {
              display: flex;
              align-items: center;
              gap: 8px;
              flex: 1;
            }
            .status-dot {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${activeRegistration?.is_active ? '#22c55e' : '#ef4444'};
            }
            .task-info {
              flex: 1;
              min-width: 0;
            }
            .task-name {
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .project-name {
              font-size: 10px;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .time-display {
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="timer-content">
            <div class="status-dot"></div>
            <div class="task-info">
              <div class="task-name">${taskDetails?.title || 'No Active Task'}</div>
              <div class="project-name">${taskDetails?.project_name || 'Click to start'}</div>
            </div>
            <div class="time-display">
              ${activeRegistration?.is_active ? formatDuration(activeRegistration.start_time) : '00:00:00'}
            </div>
          </div>
        </body>
      </html>
    `;
    pipDocument.open();
    pipDocument.write(pipContent);
    pipDocument.close();

    // Update PiP content every second
    setTimeout(() => {
      if (pipWindow.current && !pipWindow.current.closed) {
        const timeElement = pipDocument.querySelector('.time-display');
        if (timeElement && activeRegistration?.is_active) {
          timeElement.textContent = formatDuration(activeRegistration.start_time);
        }
      }
    }, 1000);
  }
  return <>
      <TaskExtraTimeDialog isOpen={showExtraTimeDialog} onClose={() => {}} onConfirm={handleExtraTimeConfirm} taskTitle={pendingStopData?.taskDetails?.title || ''} overTimeMinutes={pendingStopData?.overTimeMinutes || 0} elapsedMinutes={pendingStopData?.elapsedMinutes || 0} />
      
      <div ref={timerRef} className={`fixed z-[9999] pointer-events-none transition-all duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isPictureInPicture ? 'opacity-50' : ''}`} style={{
      left: position.x === 0 && position.y === 16 ? '50%' : `${position.x}px`,
      top: `${position.y}px`,
      transform: position.x === 0 && position.y === 16 ? 'translateX(-50%)' : 'none'
    }} onMouseDown={handleMouseDown}>
      <div className="pointer-events-auto">
        <Card className={`transition-all duration-200 ${activeRegistration && activeRegistration.is_active ? 'border-green-500 bg-green-50 hover:bg-green-100' : 'border-red-500 bg-red-50 hover:bg-red-100'} ${isMinimized ? 'max-w-[200px]' : 'max-w-sm'} shadow-lg`}>
          <CardContent className={`${isMinimized ? 'p-1' : 'p-2'}`}>
            {!isMinimized ? <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <div className={`p-1.5 rounded-full cursor-pointer ${activeRegistration && activeRegistration.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`} onClick={handleTimerClick}>
                    {activeRegistration && activeRegistration.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    {activeRegistration && taskDetails ? <div>
                        <p 
                          className={`font-medium text-xs truncate ${!taskDetails.is_workstation_task && taskDetails.project_id ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (!taskDetails.is_workstation_task && taskDetails.project_id) {
                              e.stopPropagation();
                              navigate(createLocalizedPath(`/projects/${taskDetails.project_id}`));
                            }
                          }}
                        >
                          {taskDetails.project_name}
                        </p>
                        <p 
                          className={`text-xs text-gray-600 truncate ${!taskDetails.is_workstation_task && taskDetails.project_id ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (!taskDetails.is_workstation_task && taskDetails.project_id) {
                              e.stopPropagation();
                              navigate(createLocalizedPath(`/projects/${taskDetails.project_id}`));
                            }
                          }}
                        >
                          {taskDetails.title}
                        </p>
                        {taskDetails.is_workstation_task && <p className="text-xs text-blue-600">Workstation Task</p>}
                      </div> : lastWorkedTask ? <div>
                        <p 
                          className={`font-medium text-xs text-gray-500 ${!lastWorkedTask.is_workstation_task && lastWorkedTask.project_id ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (!lastWorkedTask.is_workstation_task && lastWorkedTask.project_id) {
                              e.stopPropagation();
                              navigate(createLocalizedPath(`/projects/${lastWorkedTask.project_id}`));
                            }
                          }}
                        >
                          {lastWorkedTask.project_name}
                        </p>
                        <p 
                          className={`text-xs text-gray-400 ${!lastWorkedTask.is_workstation_task && lastWorkedTask.project_id ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (!lastWorkedTask.is_workstation_task && lastWorkedTask.project_id) {
                              e.stopPropagation();
                              navigate(createLocalizedPath(`/projects/${lastWorkedTask.project_id}`));
                            }
                          }}
                        >
                          {lastWorkedTask.title}
                        </p>
                        
                      </div> : <div>
                        <p className="font-medium text-xs text-gray-500">No Previous Task</p>
                        <p className="text-xs text-gray-400">Start from tasks page</p>
                      </div>}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <div className="flex flex-col space-y-0">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-2.5 w-2.5 text-gray-500" />
                      <span className="font-mono text-xs font-medium">
                        {activeRegistration && activeRegistration.is_active ? formatDuration(activeRegistration.start_time) : '00:00:00'}
                      </span>
                    </div>
                    {activeRegistration && activeRegistration.is_active && taskDetails?.duration != null && <div className="flex items-center space-x-1">
                        <Timer className="h-2.5 w-2.5 text-gray-500" />
                         <span className={`font-mono text-xs font-medium ${isTimeNegative(activeRegistration.start_time, taskDetails.duration) ? 'text-red-500' : ''}`}>
                           {formatRemainingDuration(activeRegistration.start_time, taskDetails.duration)}
                           {activeUsersOnTask > 1 && <span className="text-blue-500 ml-1">({activeUsersOnTask}x)</span>}
                         </span>
                      </div>}
                  </div>
                  
                  {/* Control buttons */}
                  <div className="flex flex-col space-y-0.5 ml-1">
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={e => {
                    e.stopPropagation();
                    togglePictureInPicture();
                  }}>
                      <PictureInPicture className="h-2 w-2" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={e => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}>
                      <Minimize2 className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
              </div> : <div className="flex items-center justify-between space-x-1">
                <div className={`p-1 rounded-full cursor-pointer ${activeRegistration && activeRegistration.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`} onClick={handleTimerClick}>
                  {activeRegistration && activeRegistration.is_active ? <Pause className="h-2 w-2" /> : <Play className="h-2 w-2" />}
                </div>
                
                <span className="font-mono text-xs font-medium">
                  {activeRegistration && activeRegistration.is_active ? formatDuration(activeRegistration.start_time) : '00:00:00'}
                </span>
                
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={e => {
                e.stopPropagation();
                setIsMinimized(false);
              }}>
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>}
          </CardContent>
        </Card>
      </div>
    </div>
    </>;
};
export default TaskTimer;
