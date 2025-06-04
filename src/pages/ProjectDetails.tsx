
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/services/dataService';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import TaskList from '@/components/TaskList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  installation_date: string;
  start_date: string;
  created_at: string;
  updated_at: string;
}

interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  installation_date?: Date;
  start_date?: Date;
}

interface Phase {
  id: string;
  name: string;
  project_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

interface TaskWithProjectAndPhase extends Task {
  project_name?: string;
  phase_name?: string;
}

// Basic validation schemas
const projectUpdateSchema = z.object({
  name: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  installation_date: z.date(),
  start_date: z.date()
});

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'HOLD']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  phase_id: z.string().min(1, "Phase is required"),
  due_date: z.date(),
  workstation: z.string().optional(),
  duration: z.number().min(0).optional()
});

const phaseSchema = z.object({
  name: z.string().min(1, "Name is required")
});

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreatePhaseOpen, setIsCreatePhaseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<TaskWithProjectAndPhase[]>([]);

  // Project Form
  const projectForm = useForm<z.infer<typeof projectUpdateSchema>>({
    resolver: zodResolver(projectUpdateSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
      priority: 'medium',
      installation_date: new Date(),
      start_date: new Date(),
    },
  })

  // Task Form
  const taskForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'TODO',
      priority: 'Medium',
      phase_id: '',
      due_date: new Date(),
      workstation: '',
      duration: 0,
    },
  })

  // Phase Form
  const phaseForm = useForm<z.infer<typeof phaseSchema>>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: '',
    },
  })

  // Project Queries
  const { isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      
      const projectData = {
        ...data,
        name: data.name || data.title || '', // Handle both name and title fields
      } as Project;
      
      setProject(projectData);
      projectForm.reset({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status as any,
        priority: projectData.priority as any,
        installation_date: new Date(projectData.installation_date),
        start_date: new Date(projectData.start_date)
      });
      return projectData;
    },
    enabled: !!projectId,
  });

  // Phase Queries
  const { isLoading: isPhasesLoading } = useQuery({
    queryKey: ['phases', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) throw error;
      
      setPhases(data || []);
      return data || [];
    },
    enabled: !!projectId,
  });

  // Task Queries
  const { isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(project_id, name)
        `)
        .eq('phases.project_id', projectId);
      
      if (error) throw error;
      
      // Enrich tasks with project and phase names
      const enrichedTasks = (data || []).map(task => {
        return {
          ...task,
          project_name: project?.name,
          phase_name: task.phases?.name,
        };
      });
      
      setTasks(enrichedTasks);
      return enrichedTasks;
    },
    enabled: !!projectId && !!phases,
  });

  // Project Mutations
  const { mutate: updateProject, isPending: isUpdateProjectLoading } = useMutation({
    mutationFn: async (data: ProjectUpdate) => {
      if (!projectId) throw new Error("Project ID is required to update project.");
      const { error } = await supabase
        .from('projects')
        .update({
          name: data.name,
          description: data.description,
          status: data.status,
          priority: data.priority,
          installation_date: data.installation_date?.toISOString().split('T')[0],
          start_date: data.start_date?.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsEditProjectOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update project: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const { mutate: deleteProject, isPending: isDeleteProjectLoading } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project deleted successfully.",
      });
      navigate('/projects');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete project: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Task Mutations
  const { mutate: createTask, isPending: isCreateTaskLoading } = useMutation({
    mutationFn: async (data: z.infer<typeof taskSchema>) => {
      if (!projectId) throw new Error("Project ID is required to create task.");
      const { error } = await supabase
        .from('tasks')
        .insert({
          ...data,
          due_date: data.due_date.toISOString().split('T')[0]
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsCreateTaskOpen(false);
      taskForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create task: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Phase Mutations
  const { mutate: createPhase, isPending: isCreatePhaseLoading } = useMutation({
    mutationFn: async (data: z.infer<typeof phaseSchema>) => {
      if (!projectId) throw new Error("Project ID is required to create phase.");
      const { error } = await supabase
        .from('phases')
        .insert({
          ...data,
          project_id: projectId,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Phase created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['phases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsCreatePhaseOpen(false);
      phaseForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create phase: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Task Filtering
  useEffect(() => {
    if (tasks) {
      const enrichedTasks = tasks.map(task => {
        const phase = phases.find(p => p.id === task.phase_id);
        return {
          ...task,
          project_name: project?.name,
          phase_name: phase?.name,
        };
      });
      setTasks(enrichedTasks);
    }
  }, [phases, project]);

  const allTasks = tasks || [];
  const todoTasks = allTasks.filter(task => task.status === 'TODO' || task.status === 'HOLD');
  const inProgressTasks = allTasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = allTasks.filter(task => task.status === 'COMPLETED');

  const upcomingDeadlines = allTasks.filter(task => {
    const isUpcoming = task.status === 'TODO' || task.status === 'HOLD' || task.status === 'IN_PROGRESS';
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isUpcoming && diffDays <= 7 && diffDays >= 0;
  });

  const overdueTasks = allTasks.filter(task => {
    const isNotCompleted = task.status === 'TODO' || task.status === 'HOLD' || task.status === 'IN_PROGRESS';
    const dueDate = new Date(task.due_date);
    const today = new Date();
    return isNotCompleted && dueDate < today;
  });

  const handleProjectDelete = async () => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteProject(projectId || '');
    }
  };

  if (isProjectLoading || isPhasesLoading || isTasksLoading || !project) {
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

  // Filter tasks based on search term
  const filteredTodoTasks = todoTasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInProgressTasks = inProgressTasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCompletedTasks = completedTasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="outline" className="mb-4" onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>

          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-gray-500">{project.description}</p>
            </div>
            <div className="space-x-2">
              <Button size="sm" variant="outline" onClick={() => setIsEditProjectOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Project
              </Button>
              <Button size="sm" variant="destructive" onClick={handleProjectDelete} disabled={isDeleteProjectLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>To Do</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={filteredTodoTasks} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={filteredInProgressTasks} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={filteredCompletedTasks} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingDeadlines.length > 0 ? (
                  <ul>
                    {upcomingDeadlines.map((task) => (
                      <li key={task.id} className="mb-2 p-2 border rounded">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No upcoming deadlines.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overdue Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {overdueTasks.length > 0 ? (
                  <ul>
                    {overdueTasks.map((task) => (
                      <li key={task.id} className="mb-2 p-2 border rounded bg-red-50">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-red-600">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No overdue tasks.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Phases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {phases.map((phase) => (
                <Card key={phase.id}>
                  <CardHeader>
                    <CardTitle>{phase.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">
                      Created At: {format(new Date(phase.created_at), 'MMM dd, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Create Phase
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Phase</DialogTitle>
                  <DialogDescription>
                    Add a new phase to the project.
                  </DialogDescription>
                </DialogHeader>
                <Form {...phaseForm}>
                  <form onSubmit={phaseForm.handleSubmit((values) => {
                    createPhase(values)
                  })} className="space-y-4">
                    <FormField
                      control={phaseForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Phase Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isCreatePhaseLoading}>
                      {isCreatePhaseLoading ? "Loading" : "Create"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
                <DialogDescription>
                  Add a new task to the project.
                </DialogDescription>
              </DialogHeader>
              <Form {...taskForm}>
                <form onSubmit={taskForm.handleSubmit((values) => {
                  createTask(values)
                })} className="space-y-4">
                  <FormField
                    control={taskForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Task Title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Task Description"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="phase_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phase</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a phase" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {phases.map((phase) => (
                              <SelectItem key={phase.id} value={phase.id}>{phase.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TODO">TODO</SelectItem>
                            <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                            <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                            <SelectItem value="HOLD">HOLD</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="workstation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workstation</FormLabel>
                        <FormControl>
                          <Input placeholder="Workstation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Duration" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isCreateTaskLoading}>
                    {isCreateTaskLoading ? "Loading" : "Create"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Make changes to your project here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit((values) => {
              updateProject(values)
            })} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Project Title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Project Description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="installation_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installation Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isUpdateProjectLoading}>
                {isUpdateProjectLoading ? "Loading" : "Update"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetails;
