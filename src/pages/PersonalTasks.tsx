import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { taskService, Task } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { TaskTimer } from '@/components/TaskTimer';
import { Clock, Calendar, User, CheckCircle, Play, Pause } from 'lucide-react';

const PersonalTasks = () => {
  const navigate = useNavigate();
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentEmployee) {
      loadTasks();
    }
  }, [currentEmployee]);

  const loadTasks = async () => {
    if (!currentEmployee) return;
    
    setLoading(true);
    try {
      const data = await taskService.getByEmployeeId(currentEmployee.id);
      // Filter for non-completed tasks
      const activeTasks = data.filter(task => task.status !== 'COMPLETED');
      setTasks(activeTasks);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load tasks: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'HOLD': return 'bg-red-100 text-red-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleStartTimer = async (taskId: string) => {
    if (!currentEmployee) return;
    
    try {
      await timeRegistrationService.startTimer(currentEmployee.id, taskId);
      setTimers(prev => ({ ...prev, [taskId]: true }));
      
      // Update task status to IN_PROGRESS if it's TODO
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status === 'TODO') {
        await taskService.updateStatus(taskId, 'IN_PROGRESS');
        loadTasks(); // Reload to get updated status
      }
      
      toast({
        title: "Timer Started",
        description: "Time tracking has begun for this task"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to start timer: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleStopTimer = async (taskId: string) => {
    if (!currentEmployee) return;
    
    try {
      await timeRegistrationService.stopTimer(currentEmployee.id, taskId);
      setTimers(prev => ({ ...prev, [taskId]: false }));
      
      toast({
        title: "Timer Stopped",
        description: "Time tracking has been stopped for this task"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to stop timer: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.updateStatus(taskId, 'COMPLETED');
      
      // Stop timer if it's running
      if (timers[taskId]) {
        await handleStopTimer(taskId);
      }
      
      toast({
        title: "Task Completed",
        description: "Task has been marked as completed"
      });
      
      loadTasks(); // Reload to remove completed task from list
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to complete task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 flex-1 p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      
      <div className="ml-64 flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
              <p className="text-muted-foreground mt-1">
                Track and manage your assigned tasks
              </p>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-16 w-16 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium">No active tasks</h3>
              <p className="mt-2 text-gray-600">
                You don't have any active tasks assigned to you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {tasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg line-clamp-2">{task.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(task.status)} variant="secondary">
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)} variant="secondary">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    {task.description && (
                      <CardDescription className="line-clamp-2">
                        {task.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                        {task.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{task.duration}h</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Workstation: {task.workstation}</span>
                      </div>

                      {task.status === 'IN_PROGRESS' && (
                        <TaskTimer 
                          taskId={task.id} 
                          employeeId={currentEmployee?.id || ''} 
                        />
                      )}

                      <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        {task.status === 'TODO' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleStartTimer(task.id)}
                            className="flex-1"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        
                        {task.status === 'IN_PROGRESS' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleStopTimer(task.id)}
                              className="flex-1"
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleCompleteTask(task.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                        
                        {task.status === 'HOLD' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleStartTimer(task.id)}
                            className="flex-1"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
