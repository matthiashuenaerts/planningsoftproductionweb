import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { taskService, Task } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Clock, CheckCircle, PlayCircle, PauseCircle } from 'lucide-react';

const PersonalTasks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentEmployee) return;
      
      try {
        const allTasks = await taskService.getAll();
        const userTasks = allTasks.filter(task => 
          task.assignee_id === currentEmployee.id ||
          task.status === 'IN_PROGRESS'
        );
        setTasks(userTasks);
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

    fetchTasks();
  }, [currentEmployee, toast]);

  const handleTaskStatusChange = async (taskId: string, status: Task['status']) => {
    if (!currentEmployee) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update tasks.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // If starting a task, use time registration service
      if (status === 'IN_PROGRESS') {
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        
        // Update local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { 
              ...task, 
              status: 'IN_PROGRESS',
              status_changed_at: new Date().toISOString(),
              assignee_id: currentEmployee.id
            } : task
          )
        );
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
        return;
      }
      
      // If completing a task, use time registration service
      if (status === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        
        // Update local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { 
              ...task, 
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              completed_by: currentEmployee.id
            } : task
          )
        );
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
        });
        return;
      }
      
      // For other status changes, use regular task service
      const updateData: Partial<Task> = { 
        status, 
        status_changed_at: new Date().toISOString() 
      };
      
      await taskService.update(taskId, updateData);
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            status,
            status_changed_at: updateData.status_changed_at
          } : task
        )
      );
      
      toast({
        title: "Task updated",
        description: `Task status has been updated to ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update task status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 w-full p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Personal Tasks</h1>
          <p className="text-gray-600 mt-2">Manage your assigned tasks</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {tasks.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p>You have no tasks assigned to you.</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader>
                  <CardTitle>{task.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{task.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <Badge>{task.status}</Badge>
                    </div>
                    <div>
                      {task.status === 'TODO' && (
                        <Button onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}>
                          Start Task
                        </Button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <Button onClick={() => handleTaskStatusChange(task.id, 'COMPLETED')}>
                          Complete Task
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
