import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  User, 
  Calendar, 
  Play, 
  Square, 
  CheckCircle, 
  Filter,
  ArrowUpDown,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { standardTasksService } from '@/services/standardTasksService';

interface ExtendedTask {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: string;
  due_date: string;
  assignee_id: string;
  workstation: string;
  phase_id: string;
  duration: number;
  standard_task_id?: string;
  project_name: string;
  project_id: string;
  active_workers: number;
  is_workstation_task: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkstationViewProps {
  workstationId: string;
  onBack: () => void;
}

const WorkstationView: React.FC<WorkstationViewProps> = ({ workstationId, onBack }) => {
  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [workstationName, setWorkstationName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    duration: ''
  });
  const [taskStandardTasks, setTaskStandardTasks] = useState<Record<string, any>>({});
  
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    loadWorkstationData();
    loadTaskStandardTasks();
  }, [workstationId]);

  const loadTaskStandardTasks = async () => {
    try {
      const standardTasks = await standardTasksService.getAll();
      const standardTasksMap: Record<string, any> = {};
      standardTasks.forEach(task => {
        standardTasksMap[task.id] = task;
      });
      setTaskStandardTasks(standardTasksMap);
    } catch (error) {
      console.error('Error loading standard tasks:', error);
    }
  };

  const loadWorkstationData = async () => {
    try {
      setLoading(true);
      
      // Get workstation info
      const { data: workstation, error: workstationError } = await supabase
        .from('workstations')
        .select('name')
        .eq('id', workstationId)
        .single();

      if (workstationError) throw workstationError;
      setWorkstationName(workstation.name);

      // Get regular tasks for this workstation
      const { data: regularTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(
            name,
            projects!inner(
              id,
              name
            )
          )
        `)
        .eq('workstation', workstation.name)
        .order('due_date', { ascending: true });

      if (tasksError) throw tasksError;

      // Get workstation tasks
      const { data: workstationTasks, error: workstationTasksError } = await supabase
        .from('workstation_tasks')
        .select('*')
        .eq('workstation_id', workstationId);

      if (workstationTasksError) throw workstationTasksError;

      // Transform regular tasks
      const transformedRegularTasks: ExtendedTask[] = (regularTasks || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assignee_id: task.assignee_id,
        workstation: task.workstation,
        phase_id: task.phase_id,
        duration: task.duration,
        standard_task_id: task.standard_task_id,
        project_name: task.phases.projects.name,
        project_id: task.phases.projects.id,
        active_workers: 0,
        is_workstation_task: false,
        created_at: task.created_at,
        updated_at: task.updated_at
      }));

      // Transform workstation tasks to match ExtendedTask interface
      const transformedWorkstationTasks: ExtendedTask[] = (workstationTasks || []).map(task => ({
        id: task.id,
        title: task.task_name,
        description: task.description || '',
        status: 'TODO' as const,
        priority: task.priority,
        due_date: new Date().toISOString().split('T')[0],
        assignee_id: currentEmployee?.id || '',
        workstation: workstation.name,
        phase_id: '',
        duration: task.duration || 0,
        standard_task_id: null,
        project_name: 'Workstation Task',
        project_id: '',
        active_workers: 0,
        is_workstation_task: true,
        created_at: task.created_at,
        updated_at: task.updated_at
      }));

      // Combine and set all tasks
      const allTasks = [...transformedRegularTasks, ...transformedWorkstationTasks];
      setTasks(allTasks);

    } catch (error: any) {
      console.error('Error loading workstation data:', error);
      toast({
        title: "Error",
        description: `Failed to load workstation data: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: ExtendedTask['status']) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.is_workstation_task) {
        // Handle workstation task status change if needed
        // For now, workstation tasks don't change status in the database
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      } else {
        // Handle regular task status change
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: newStatus,
            completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
            completed_by: newStatus === 'COMPLETED' ? currentEmployee?.id : null
          })
          .eq('id', taskId);

        if (error) throw error;

        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        
        toast({
          title: "Success",
          description: `Task status updated to ${newStatus.toLowerCase().replace('_', ' ')}`
        });
      }
    } catch (error: any) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: `Failed to update task status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleCreateTask = async () => {
    try {
      const { data, error } = await supabase
        .from('workstation_tasks')
        .insert([{
          workstation_id: workstationId,
          task_name: formData.title,
          description: formData.description,
          priority: formData.priority,
          duration: formData.duration ? parseInt(formData.duration) : null
        }])
        .select()
        .single();

      if (error) throw error;

      // Add the new task to the local state
      const newTask: ExtendedTask = {
        id: data.id,
        title: data.task_name,
        description: data.description || '',
        status: 'TODO',
        priority: data.priority,
        due_date: new Date().toISOString().split('T')[0],
        assignee_id: currentEmployee?.id || '',
        workstation: workstationName,
        phase_id: '',
        duration: data.duration || 0,
        standard_task_id: null,
        project_name: 'Workstation Task',
        project_id: '',
        active_workers: 0,
        is_workstation_task: true,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      setTasks([...tasks, newTask]);
      setShowTaskForm(false);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        duration: ''
      });

      toast({
        title: "Success",
        description: "Workstation task created successfully"
      });
    } catch (error: any) {
      console.error('Error creating workstation task:', error);
      toast({
        title: "Error",
        description: `Failed to create task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    try {
      if (editingTask.is_workstation_task) {
        const { error } = await supabase
          .from('workstation_tasks')
          .update({
            task_name: formData.title,
            description: formData.description,
            priority: formData.priority,
            duration: formData.duration ? parseInt(formData.duration) : null
          })
          .eq('id', editingTask.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            due_date: formData.due_date,
            duration: formData.duration ? parseInt(formData.duration) : null
          })
          .eq('id', editingTask.id);

        if (error) throw error;
      }

      // Update local state
      setTasks(tasks.map(t => t.id === editingTask.id ? {
        ...t,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        due_date: formData.due_date || t.due_date,
        duration: formData.duration ? parseInt(formData.duration) : t.duration
      } : t));

      setEditingTask(null);
      setShowTaskForm(false);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        duration: ''
      });

      toast({
        title: "Success",
        description: "Task updated successfully"
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: `Failed to update task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.is_workstation_task) {
        const { error } = await supabase
          .from('workstation_tasks')
          .delete()
          .eq('id', taskId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId);

        if (error) throw error;
      }

      setTasks(tasks.filter(t => t.id !== taskId));
      
      toast({
        title: "Success",
        description: "Task deleted successfully"
      });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: `Failed to delete task: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Filter tasks to exclude workstation tasks from main lists
  const filteredAndSortedTasks = tasks
    .filter(task => !task.is_workstation_task) // Exclude workstation tasks from main view
    .filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.project_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      let aValue: any = a[sortBy as keyof ExtendedTask];
      let bValue: any = b[sortBy as keyof ExtendedTask];
      
      if (sortBy === 'due_date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'TODO': { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'To Do' },
      'IN_PROGRESS': { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'In Progress' },
      'COMPLETED': { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completed' },
      'HOLD': { color: 'bg-red-100 text-red-800 border-red-300', label: 'On Hold' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['TODO'];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getTaskColor = (task: ExtendedTask): string => {
    if (task.standard_task_id && taskStandardTasks[task.standard_task_id]) {
      return taskStandardTasks[task.standard_task_id].color || '#3B82F6';
    }
    return '#3B82F6'; // Default blue color
  };

  const openEditForm = (task: ExtendedTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      duration: task.duration.toString()
    });
    setShowTaskForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const todoTasks = filteredAndSortedTasks.filter(task => task.status === 'TODO');
  const inProgressTasks = filteredAndSortedTasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = filteredAndSortedTasks.filter(task => task.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{workstationName} Workstation</h2>
        <Button onClick={() => setShowTaskForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Workstation Task
        </Button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg border">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="HOLD">On Hold</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          {sortBy} ({sortOrder})
        </Button>
      </div>

      {/* Task Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* TODO Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-700">To Do</h3>
            <Badge variant="secondary">{todoTasks.length}</Badge>
          </div>
          <div className="space-y-3">
            {todoTasks.map((task) => (
              <Card 
                key={task.id} 
                className="h-fit transition-all duration-200 hover:shadow-md"
                style={{ borderLeftWidth: '4px', borderLeftColor: getTaskColor(task) }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium text-gray-900 line-clamp-2">
                      {task.title}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {task.project_name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <User className="h-3 w-3" />
                      <span className="truncate">Workstation: {task.workstation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                    {task.duration && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>Duration: {task.duration}h</span>
                      </div>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}
                      className="flex-1 h-7 text-xs"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* IN PROGRESS Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-amber-700">In Progress</h3>
            <Badge variant="secondary">{inProgressTasks.length}</Badge>
          </div>
          <div className="space-y-3">
            {inProgressTasks.map((task) => (
              <Card 
                key={task.id} 
                className="h-fit transition-all duration-200 hover:shadow-md ring-2 ring-amber-200"
                style={{ borderLeftWidth: '4px', borderLeftColor: getTaskColor(task) }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium text-gray-900 line-clamp-2">
                      {task.title}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {task.project_name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <User className="h-3 w-3" />
                      <span className="truncate">Workstation: {task.workstation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                    {task.duration && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>Duration: {task.duration}h</span>
                      </div>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTaskStatusChange(task.id, 'TODO')}
                      className="flex-1 h-7 text-xs"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleTaskStatusChange(task.id, 'COMPLETED')}
                      className="flex-1 h-7 text-xs"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* COMPLETED Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-green-700">Completed</h3>
            <Badge variant="secondary">{completedTasks.length}</Badge>
          </div>
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <Card 
                key={task.id} 
                className="h-fit transition-all duration-200 hover:shadow-md opacity-75"
                style={{ borderLeftWidth: '4px', borderLeftColor: getTaskColor(task) }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium text-gray-900 line-clamp-2">
                      {task.title}
                    </CardTitle>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {task.project_name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <User className="h-3 w-3" />
                      <span className="truncate">Workstation: {task.workstation}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                    {task.duration && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>Duration: {task.duration}h</span>
                      </div>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Edit Task' : 'Create New Workstation Task'}
            </DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update the task details below.' : 'Fill in the details for the new workstation task.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Task Name</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task name"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
              />
            </div>
            
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editingTask?.is_workstation_task && (
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="duration">Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="Estimated duration in hours"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskForm(false)}>
              Cancel
            </Button>
            <Button onClick={editingTask ? handleUpdateTask : handleCreateTask}>
              {editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkstationView;
