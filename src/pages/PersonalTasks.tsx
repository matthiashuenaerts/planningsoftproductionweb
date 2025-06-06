
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Clock, User, Calendar as CalendarIcon, MoreVertical, Play, Pause, Square, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import TaskTimer from '@/components/TaskTimer';
import Navbar from '@/components/Navbar';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  due_date?: string;
  created_at: string;
  updated_at: string;
  phase_id: string;
  workstation: string;
}

const PersonalTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          // Ensure status is properly typed
          const typedTasks = (data || []).map(task => ({
            ...task,
            status: task.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
          }));
          setTasks(typedTasks);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const handleOpenTaskDialog = (task: Task | null = null) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleCloseTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
  };

  const handleAddTask = async (newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          ...newTask,
          due_date: newTask.due_date || new Date().toISOString().split('T')[0],
          phase_id: newTask.phase_id || '00000000-0000-0000-0000-000000000000',
          workstation: newTask.workstation || 'default'
        }])
        .select('*');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create task",
          variant: "destructive"
        });
        console.error("Error creating task:", error);
      } else {
        const typedTask = {
          ...data[0],
          status: data[0].status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
        };
        setTasks([...tasks, typedTask]);
        toast({
          title: "Success",
          description: "Task created successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
      console.error("Error creating task:", err);
    } finally {
      handleCloseTaskDialog();
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          due_date: updatedTask.due_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedTask.id)
        .select('*');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update task",
          variant: "destructive"
        });
        console.error("Error updating task:", error);
      } else {
        const typedTask = {
          ...data[0],
          status: data[0].status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
        };
        setTasks(tasks.map(task => task.id === updatedTask.id ? typedTask : task));
        toast({
          title: "Success",
          description: "Task updated successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
      console.error("Error updating task:", err);
    } finally {
      handleCloseTaskDialog();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "destructive"
        });
        console.error("Error deleting task:", error);
      } else {
        setTasks(tasks.filter(task => task.id !== taskId));
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive"
      });
      console.error("Error deleting task:", err);
    }
  };

  const handleStartTask = async (task: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', task.id)
        .select('*');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to start task",
          variant: "destructive"
        });
        console.error("Error starting task:", error);
      } else {
        const typedTask = {
          ...data[0],
          status: data[0].status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
        };
        setTasks(tasks.map(t => t.id === task.id ? typedTask : t));
        setIsTimerRunning(true);
        toast({
          title: "Success",
          description: "Task started successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to start task",
        variant: "destructive"
      });
      console.error("Error starting task:", err);
    }
  };

  const handlePauseTask = async (task: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'HOLD' })
        .eq('id', task.id)
        .select('*');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to pause task",
          variant: "destructive"
        });
        console.error("Error pausing task:", error);
      } else {
        const typedTask = {
          ...data[0],
          status: data[0].status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
        };
        setTasks(tasks.map(t => t.id === task.id ? typedTask : t));
        setIsTimerRunning(false);
        toast({
          title: "Success",
          description: "Task paused successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to pause task",
        variant: "destructive"
      });
      console.error("Error pausing task:", err);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: currentEmployee?.id
        })
        .eq('id', task.id)
        .select('*');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to complete task",
          variant: "destructive"
        });
        console.error("Error completing task:", error);
      } else {
        const typedTask = {
          ...data[0],
          status: data[0].status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'
        };
        setTasks(tasks.map(t => t.id === task.id ? typedTask : t));
        setIsTimerRunning(false);
        toast({
          title: "Success",
          description: "Task completed successfully",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
      console.error("Error completing task:", err);
    }
  };

  const canStartTask = (task: any) => {
    return task.status === 'TODO' || task.status === 'HOLD';
  };

  const canCompleteTask = (task: any) => {
    return task.status === 'IN_PROGRESS';
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Personal Tasks</CardTitle>
              <CardDescription>Manage your tasks and track your progress</CardDescription>
            </CardHeader>
            <Button onClick={() => handleOpenTaskDialog()}>Add Task</Button>
          </div>

          <div className="flex space-x-4 mb-4">
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="TODO">Todo</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="HOLD">Hold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p>Loading tasks...</p>
          ) : error ? (
            <p className="text-red-500">Error: {error}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <Card key={task.id}>
                  <CardHeader>
                    <CardTitle>{task.title}</CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{task.status}</Badge>
                      <Badge>{task.priority}</Badge>
                    </div>
                    {task.due_date && (
                      <p className="text-sm text-gray-500">
                        Due Date: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                      </p>
                    )}
                    <div className="flex justify-between">
                      <div className="flex space-x-2">
                        {canStartTask(task) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartTask(task)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </Button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePauseTask(task)}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </Button>
                        )}
                        {canCompleteTask(task) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteTask(task)}
                          >
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Complete
                          </Button>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open dropdown menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenTaskDialog(task)}>
                            <User className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)}>
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={isTaskDialogOpen} onOpenChange={handleCloseTaskDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
                <DialogDescription>
                  {selectedTask ? 'Update task details' : 'Create a new task'}
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                task={selectedTask}
                onSubmit={(taskData) => {
                  if (selectedTask) {
                    handleUpdateTask({ ...selectedTask, ...taskData });
                  } else {
                    handleAddTask(taskData);
                  }
                }}
                onCancel={handleCloseTaskDialog}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

interface TaskFormProps {
  task?: Task | null;
  onSubmit: (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD'>(task?.status || 'TODO');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>(task?.priority || 'Medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(task?.due_date ? new Date(task.due_date) : undefined);

  const handleSubmit = () => {
    if (!title) {
      alert('Title is required');
      return;
    }

    const taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      title,
      description,
      status,
      priority,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      phase_id: task?.phase_id || '00000000-0000-0000-0000-000000000000',
      workstation: task?.workstation || 'default'
    };
    onSubmit(taskData);
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">
          Title
        </Label>
        <Input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">
          Description
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="status" className="text-right">
          Status
        </Label>
        <Select value={status} onValueChange={(value: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD') => setStatus(value)}>
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODO">Todo</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="HOLD">Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="priority" className="text-right">
          Priority
        </Label>
        <Select value={priority} onValueChange={(value: 'Urgent' | 'High' | 'Medium' | 'Low') => setPriority(value)}>
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select a priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="due_date" className="text-right">
          Due Date
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal col-span-3",
                !dueDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" onClick={handleSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
};

export default PersonalTasks;
