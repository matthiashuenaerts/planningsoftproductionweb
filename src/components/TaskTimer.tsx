
import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';
import NotificationBox from './NotificationBox';

const TaskTimer = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [currentTaskTitle, setCurrentTaskTitle] = useState<string | null>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    } else if (!isRunning && seconds !== 0) {
      if (interval) clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, seconds]);

  // Check for active registrations on component mount
  useEffect(() => {
    const checkActiveRegistrations = async () => {
      if (!currentEmployee) return;
      
      try {
        const activeRegistrations = await timeRegistrationService.getActiveRegistrationsByEmployee(currentEmployee.id);
        
        if (activeRegistrations.length > 0) {
          const activeReg = activeRegistrations[0];
          setIsRunning(true);
          
          // Calculate elapsed seconds
          const startTime = new Date(activeReg.start_time).getTime();
          const now = new Date().getTime();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          setSeconds(elapsedSeconds);
          
          // You might want to fetch task title here if available
          setCurrentTaskTitle('Active Task');
        }
      } catch (error) {
        console.error('Error checking active registrations:', error);
      }
    };
    
    checkActiveRegistrations();
  }, [currentEmployee]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = async () => {
    if (!currentEmployee) return;
    
    try {
      // Stop any active registrations
      await timeRegistrationService.stopActiveRegistrations(currentEmployee.id);
      
      setIsRunning(false);
      setSeconds(0);
      setCurrentTaskTitle(null);
      
      toast({
        title: "Timer Stopped",
        description: "Time registration has been stopped.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to stop timer: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-4">
      <NotificationBox />
      
      <Card className="bg-white shadow-lg">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <div className="font-mono text-lg font-bold">
                {formatTime(seconds)}
              </div>
              {currentTaskTitle && (
                <div className="text-xs text-muted-foreground truncate max-w-32">
                  {currentTaskTitle}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {!isRunning ? (
                <Button size="sm" onClick={handleStart} variant="outline">
                  <Play className="h-3 w-3" />
                </Button>
              ) : (
                <Button size="sm" onClick={handlePause} variant="outline">
                  <Pause className="h-3 w-3" />
                </Button>
              )}
              {(isRunning || seconds > 0) && (
                <Button size="sm" onClick={handleStop} variant="outline">
                  <Square className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskTimer;
