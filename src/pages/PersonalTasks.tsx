
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TaskList from '@/components/TaskList';
import { timeRegistrationService } from '@/services/timeRegistrationService';

interface ExtendedTask {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: string;
  due_date: string;
  duration?: number;
  assignee_id?: string;
  completed_at?: string;
  completed_by?: string;
  status_changed_at?: string;
  project_name?: string;
  phase_name?: string;
  workstation: string;
  is_rush_order?: boolean;
  activeUserCount?: number;
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!currentEmployee) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          duration,
          assignee_id,
          completed_at,
          completed_by,
          status_changed_at,
          workstation,
          phases (
            name,
            projects (name)
          )
        `)
        .eq('assignee_id', currentEmployee.id)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      
      // Transform data and get active user counts
      const transformedTasks = await Promise.all((data || []).map(async (task: any) => {
        const activeUserCount = await timeRegistrationService.getTaskActiveUserCount(task.id);
        
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          duration: task.duration,
          assignee_id: task.assignee_id,
          completed_at: task.completed_at,
          completed_by: task.completed_by,
          status_changed_at: task.status_changed_at,
          workstation: task.workstation,
          project_name: task.phases?.projects?.name,
          phase_name: task.phases?.name,
          activeUserCount
        };
      }));
      
      setTasks(transformedTasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load personal tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentEmployee]);

  const handleTaskStatusChange = async (taskId: string, status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD') => {
    if (!currentEmployee) return;
    
    try {
      const updateData: any = { 
        status, 
        status_changed_at: new Date().toISOString() 
      };
      
      if (status === 'IN_PROGRESS') {
        updateData.assignee_id = currentEmployee.id;
      }
      
      if (status === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = currentEmployee.id;
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
      
      if (error) throw error;
      
      // Refresh tasks
      await fetchTasks();
      
      toast({
        title: 'Task Updated',
        description: `Task status changed to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!currentEmployee) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to view your personal tasks.</p>
          </div>
        </div>
      </div>
    );
  }

  const todoTasks = tasks.filter(task => task.status === 'TODO' || task.status === 'HOLD');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Personal Tasks</h1>
            <p className="text-muted-foreground">Manage your assigned tasks and track your progress</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="todo">
                <TabsList className="mb-4">
                  <TabsTrigger value="todo">To Do ({todoTasks.length})</TabsTrigger>
                  <TabsTrigger value="in_progress">In Progress ({inProgressTasks.length})</TabsTrigger>
                  <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="todo">
                  <TaskList 
                    tasks={todoTasks}
                    onTaskStatusChange={handleTaskStatusChange}
                    enableTimeRegistration={true}
                    onRefresh={fetchTasks}
                    showCountdownTimer={true}
                  />
                </TabsContent>
                <TabsContent value="in_progress">
                  <TaskList 
                    tasks={inProgressTasks}
                    onTaskStatusChange={handleTaskStatusChange}
                    enableTimeRegistration={true}
                    onRefresh={fetchTasks}
                    showCountdownTimer={true}
                  />
                </TabsContent>
                <TabsContent value="completed">
                  <TaskList 
                    tasks={completedTasks}
                    onTaskStatusChange={handleTaskStatusChange}
                    enableTimeRegistration={true}
                    onRefresh={fetchTasks}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
