import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreVertical, Trash2, Edit, Calendar, Clock, User, Building2, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import NewTaskModal from '@/components/NewTaskModal';
import { format, isBefore, startOfDay, addDays } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  assignee_id: string | null;
  phase_id: string;
  workstation: string;
  duration: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
  status_changed_at: string | null;
  standard_task_id: string | null;
}

interface TaskWithDetails extends Task {
  assignee?: { name: string };
  phase?: { 
    name: string;
    project?: { name: string };
  };
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['personal-tasks', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:employees!tasks_assignee_id_fkey(name),
          phase:phases!tasks_phase_id_fkey(
            name,
            project:projects!phases_project_id_fkey(name)
          )
        `)
        .eq('assignee_id', currentEmployee.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as TaskWithDetails[];
    },
    enabled: !!currentEmployee?.id
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: Task['status'] }) => {
      const updateData: any = { 
        status, 
        status_changed_at: new Date().toISOString() 
      };
      
      if (status === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = currentEmployee?.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] });
      toast({
        title: 'Success',
        description: 'Task status updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update task status: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] });
      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete task: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'HOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (dueDate: string) => {
    return isBefore(new Date(dueDate), startOfDay(new Date()));
  };

  const filterTasks = (status?: Task['status']) => {
    let filtered = tasks;
    
    if (status) {
      filtered = filtered.filter(task => task.status === status);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.phase?.name.toLowerCase().includes(query) ||
        task.phase?.project?.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    deleteTaskMutation.mutate(taskToDelete);
    setTaskToDelete(null);
  };

  const handleTaskCreated = () => {
    setIsNewTaskModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['personal-tasks'] });
  };

  const todoTasks = filterTasks('TODO');
  const inProgressTasks = filterTasks('IN_PROGRESS');
  const completedTasks = filterTasks('COMPLETED');
  const holdTasks = filterTasks('HOLD');

  const TaskCard = ({ task }: { task: TaskWithDetails }) => (
    <Card key={task.id} className={`${isOverdue(task.due_date) && task.status !== 'COMPLETED' ? 'border-red-500' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="h-4 w-4" />
              <span>{task.phase?.project?.name || 'Unknown Project'}</span>
              <Layers className="h-4 w-4 ml-2" />
              <span>{task.phase?.name || 'Unknown Phase'}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTaskToDelete(task.id)} className="text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {task.description && (
          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={getStatusColor(task.status)}>
            {task.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
          {isOverdue(task.due_date) && task.status !== 'COMPLETED' && (
            <Badge variant="destructive">Overdue</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Due: {format(new Date(task.due_date), 'PPP')}</span>
          </div>
          {task.duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Duration: {task.duration} hours</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs">Workstation: {task.workstation}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {task.status === 'TODO' && (
            <Button
              size="sm"
              onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'IN_PROGRESS' })}
              disabled={updateTaskStatusMutation.isPending}
            >
              Start Task
            </Button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <>
              <Button
                size="sm"
                onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'COMPLETED' })}
                disabled={updateTaskStatusMutation.isPending}
              >
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'HOLD' })}
                disabled={updateTaskStatusMutation.isPending}
              >
                Hold
              </Button>
            </>
          )}
          {task.status === 'HOLD' && (
            <Button
              size="sm"
              onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'IN_PROGRESS' })}
              disabled={updateTaskStatusMutation.isPending}
            >
              Resume
            </Button>
          )}
          {task.status === 'COMPLETED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'TODO' })}
              disabled={updateTaskStatusMutation.isPending}
            >
              Reopen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="w-64 h-full">
          <Navbar />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 h-full">
        <Navbar />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
              <p className="text-gray-600 mt-1">Manage your assigned tasks</p>
            </div>
            <Button onClick={() => setIsNewTaskModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Tabs defaultValue="todo" className="space-y-4">
            <TabsList>
              <TabsTrigger value="todo">To Do ({todoTasks.length})</TabsTrigger>
              <TabsTrigger value="in-progress">In Progress ({inProgressTasks.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
              <TabsTrigger value="hold">On Hold ({holdTasks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="todo" className="space-y-4">
              {todoTasks.length > 0 ? (
                <div className="grid gap-4">
                  {todoTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks to do</h3>
                      <p className="mt-1 text-sm text-gray-500">All caught up!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="in-progress" className="space-y-4">
              {inProgressTasks.length > 0 ? (
                <div className="grid gap-4">
                  {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks in progress</h3>
                      <p className="mt-1 text-sm text-gray-500">Start working on a task!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedTasks.length > 0 ? (
                <div className="grid gap-4">
                  {completedTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No completed tasks</h3>
                      <p className="mt-1 text-sm text-gray-500">Complete some tasks to see them here!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="hold" className="space-y-4">
              {holdTasks.length > 0 ? (
                <div className="grid gap-4">
                  {holdTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks on hold</h3>
                      <p className="mt-1 text-sm text-gray-500">Tasks on hold will appear here.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <NewTaskModal
        open={isNewTaskModalOpen}
        onOpenChange={setIsNewTaskModalOpen}
        onSuccess={handleTaskCreated}
      />

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonalTasks;
