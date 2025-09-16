import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';
import { Play, Pause, Clock, Timer, Move, Minimize2, Maximize2, PictureInPicture } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TaskExtraTimeDialog from './TaskExtraTimeDialog';

const TaskTimer = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();
  
  // Draggable and UI state
  const [position, setPosition] = useState({ x: 0, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showExtraTimeDialog, setShowExtraTimeDialog] = useState(false);
  const [pendingStopData, setPendingStopData] = useState<{
    registrationId: string;
    taskDetails: any;
    overTimeMinutes: number;
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
            height: 120,
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
      setPendingStopData(null);
    },
    onError: (error) => {
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
    mutationFn: async ({ taskId, workstationTaskId, extraMinutes }: { 
      taskId?: string; 
      workstationTaskId?: string; 
      extraMinutes: number 
    }) => {
      if (taskId) {
        // Set the task's duration to the selected extra time (in minutes)
        return supabase
          .from('tasks')
          .update({ duration: extraMinutes })
          .eq('id', taskId);
      } else if (workstationTaskId) {
        // Set the workstation task's duration to the selected extra time (in minutes)
        return supabase
          .from('workstation_tasks')
          .update({ duration: extraMinutes })
          .eq('id', workstationTaskId);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Task Duration Updated',
        description: 'Selected time saved; next countdown will use it.',
      });
      // Invalidate any taskDetails queries to ensure fresh duration on next start
      queryClient.invalidateQueries({ queryKey: ['taskDetails'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update task duration',
        variant: 'destructive'
      });
      console.error('Update task duration error:', error);
    }
  });

  const handleTimerClick = () => {
    if (!currentEmployee) return;

    if (activeRegistration && activeRegistration.is_active) {
      // Check if task is over time before stopping
      if (taskDetails?.duration && activeRegistration.start_time) {
        const start = new Date(activeRegistration.start_time);
        const now = new Date();
        const elapsedMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
        const overTime = elapsedMinutes - taskDetails.duration;
        
        if (overTime > 0) {
          // Task is over time, show dialog
          setPendingStopData({
            registrationId: activeRegistration.id,
            taskDetails,
            overTimeMinutes: overTime
          });
          setShowExtraTimeDialog(true);
          return;
        }
      }
      
      // Stop the active task normally
      stopTaskMutation.mutate(activeRegistration.id);
    } else {
      // Need to select a task to start - for now, show a message
      toast({
        title: 'No Active Task',
        description: 'Start a task from the workstation or personal tasks page to begin time tracking',
      });
    }
  };

  const handleExtraTimeConfirm = (extraMinutes: number) => {
    if (!pendingStopData) return;
    
    // Update task duration first
    updateTaskDurationMutation.mutate({
      taskId: activeRegistration?.task_id,
      workstationTaskId: activeRegistration?.workstation_task_id,
      extraMinutes
    });
    
    // Then stop the task
    stopTaskMutation.mutate(pendingStopData.registrationId);
    setShowExtraTimeDialog(false);
  };

  const handleExtraTimeCancel = () => {
    if (!pendingStopData) return;
    
    // Stop the task without updating duration
    stopTaskMutation.mutate(pendingStopData.registrationId);
    setShowExtraTimeDialog(false);
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

  return (
    <>
      <TaskExtraTimeDialog
        isOpen={showExtraTimeDialog}
        onClose={handleExtraTimeCancel}
        onConfirm={handleExtraTimeConfirm}
        taskTitle={pendingStopData?.taskDetails?.title || ''}
        overTimeMinutes={pendingStopData?.overTimeMinutes || 0}
      />
      
      <div 
        ref={timerRef}
        className={`fixed z-[9999] pointer-events-none transition-all duration-200 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } ${isPictureInPicture ? 'opacity-50' : ''}`}
        style={{
          left: position.x === 0 && position.y === 16 ? '50%' : `${position.x}px`,
          top: `${position.y}px`,
          transform: position.x === 0 && position.y === 16 ? 'translateX(-50%)' : 'none',
        }}
        onMouseDown={handleMouseDown}
      >
      <div className="pointer-events-auto">
        <Card 
          className={`transition-all duration-200 ${
            activeRegistration && activeRegistration.is_active 
              ? 'border-green-500 bg-green-50 hover:bg-green-100' 
              : 'border-red-500 bg-red-50 hover:bg-red-100'
          } ${isMinimized ? 'max-w-[200px]' : 'max-w-sm'} shadow-lg`}
        >
          <CardContent className={`${isMinimized ? 'p-2' : 'p-3'}`}>
            {!isMinimized ? (
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className={`p-1.5 rounded-full cursor-pointer ${
                    activeRegistration && activeRegistration.is_active 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`} onClick={handleTimerClick}>
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
                
                <div className="flex flex-col items-end space-y-1">
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
                  
                  {/* Control buttons */}
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePictureInPicture();
                      }}
                    >
                      <PictureInPicture className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMinimized(!isMinimized);
                      }}
                    >
                      <Minimize2 className="h-3 w-3" />
                    </Button>
                    <div className="cursor-move p-1">
                      <Move className="h-3 w-3 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between space-x-2">
                <div className={`p-1 rounded-full cursor-pointer ${
                  activeRegistration && activeRegistration.is_active 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                }`} onClick={handleTimerClick}>
                  {activeRegistration && activeRegistration.is_active ? 
                    <Pause className="h-2 w-2" /> : 
                    <Play className="h-2 w-2" />
                  }
                </div>
                
                <span className="font-mono text-xs font-medium">
                  {activeRegistration && activeRegistration.is_active 
                    ? formatDuration(activeRegistration.start_time)
                    : '00:00:00'
                  }
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default TaskTimer;