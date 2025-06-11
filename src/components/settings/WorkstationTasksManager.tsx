
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { workstationTasksService, WorkstationTask } from '@/services/workstationTasksService';

interface WorkstationTasksManagerProps {
  workstationId: string;
  workstationName: string;
}

export const WorkstationTasksManager: React.FC<WorkstationTasksManagerProps> = ({
  workstationId,
  workstationName
}) => {
  const [tasks, setTasks] = useState<WorkstationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<WorkstationTask | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      task_name: '',
      description: '',
      duration: '',
      priority: 'medium'
    }
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await workstationTasksService.getByWorkstation(workstationId);
      setTasks(data);
    } catch (error: any) {
      console.error('Error loading workstation tasks:', error);
      toast({
        title: "Error",
        description: `Failed to load workstation tasks: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [workstationId]);

  const handleOpenEdit = (task: WorkstationTask) => {
    setSelectedTask(task);
    setIsEditing(true);
    form.reset({
      task_name: task.task_name,
      description: task.description || '',
      duration: task.duration?.toString() || '',
      priority: task.priority
    });
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedTask(null);
    setIsEditing(false);
    form.reset({
      task_name: '',
      description: '',
      duration: '',
      priority: 'medium'
    });
    setDialogOpen(true);
  };

  const handleCreate = async (data: any) => {
    try {
      await workstationTasksService.create({
        workstation_id: workstationId,
        task_name: data.task_name,
        description: data.description || undefined,
        duration: data.duration ? parseInt(data.duration) : undefined,
        priority: data.priority
      });
      
      toast({
        title: "Success",
        description: "Workstation task created successfully"
      });
      
      form.reset();
      setDialogOpen(false);
      loadTasks();
    } catch (error: any) {
      console.error('Error creating workstation task:', error);
      toast({
        title: "Error",
        description: `Failed to create workstation task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async (data: any) => {
    if (!selectedTask) return;
    
    try {
      await workstationTasksService.update(selectedTask.id, {
        task_name: data.task_name,
        description: data.description || undefined,
        duration: data.duration ? parseInt(data.duration) : undefined,
        priority: data.priority
      });
      
      toast({
        title: "Success",
        description: "Workstation task updated successfully"
      });
      
      setIsEditing(false);
      setSelectedTask(null);
      form.reset();
      setDialogOpen(false);
      loadTasks();
    } catch (error: any) {
      console.error('Error updating workstation task:', error);
      toast({
        title: "Error",
        description: `Failed to update workstation task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (task: WorkstationTask) => {
    try {
      setIsDeleting(true);
      await workstationTasksService.delete(task.id);
      
      toast({
        title: "Success",
        description: "Workstation task deleted successfully"
      });
      
      loadTasks();
    } catch (error: any) {
      console.error('Error deleting workstation task:', error);
      toast({
        title: "Error",
        description: `Failed to delete workstation task: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Workstation Tasks - {workstationName}</CardTitle>
          <CardDescription>Manage tasks specific to this workstation</CardDescription>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> 
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Workstation Task' : 'Add New Workstation Task'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update workstation task details' : 'Add a new task specific to this workstation'}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(isEditing ? handleUpdate : handleCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="task_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task name" {...field} required />
                      </FormControl>
                      <FormDescription>
                        The name of the workstation task
                      </FormDescription>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter task description" {...field} />
                      </FormControl>
                      <FormDescription>
                        Detailed description of this task
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (hours)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter duration in hours" {...field} />
                      </FormControl>
                      <FormDescription>
                        Estimated duration for this task
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Priority level for this task
                      </FormDescription>
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-3">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Name</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead className="hidden lg:table-cell">Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No workstation tasks found. Create your first one!
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{task.task_name}</div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground">{task.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {task.duration ? `${task.duration}h` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleOpenEdit(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(task)}
                          disabled={isDeleting}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
