
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlanningTaskManagerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedEmployee: string;
  scheduleItem?: any;
  onSave: () => void;
}

const PlanningTaskManager: React.FC<PlanningTaskManagerProps> = ({
  isOpen,
  onClose,
  selectedDate,
  selectedEmployee,
  scheduleItem,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [allTodoTasks, setAllTodoTasks] = useState<any[]>([]);
  const [userWorkstations, setUserWorkstations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      calculateFirstAvailableTime();
      fetchUserWorkstations();
      if (scheduleItem) {
        // Edit mode
        setTitle(scheduleItem.title || '');
        setDescription(scheduleItem.description || '');
        
        // Parse times without timezone conversion
        const startDate = new Date(scheduleItem.start_time);
        const endDate = new Date(scheduleItem.end_time);
        setStartTime(format(startDate, 'HH:mm'));
        setEndTime(format(endDate, 'HH:mm'));
        setSelectedTaskId(scheduleItem.task_id || '');
        
        // If there's a task, fetch its project
        if (scheduleItem.task_id) {
          fetchProjectForTask(scheduleItem.task_id);
        }
      } else {
        // Add mode - reset form
        setTitle('');
        setDescription('');
        setSelectedProjectId('');
        setSelectedTaskId('');
        setAvailableTasks([]);
      }
    }
  }, [isOpen, scheduleItem, selectedDate, selectedEmployee]);

  // Fetch TODO tasks when userWorkstations changes
  useEffect(() => {
    if (isOpen && userWorkstations.length > 0) {
      fetchAllTodoTasks();
    }
  }, [userWorkstations, isOpen]);

  const fetchProjectForTask = async (taskId: string) => {
    try {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('phase:phases(project_id)')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      if (task?.phase?.project_id) {
        setSelectedProjectId(task.phase.project_id);
        fetchAvailableTasks(task.phase.project_id);
      }
    } catch (error: any) {
      console.error('Error fetching project for task:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('id, name, status')
        .in('status', ['planned', 'in_progress'])
        .order('name');

      if (error) throw error;
      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive'
      });
    }
  };

  const calculateFirstAvailableTime = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: existingSchedules, error } = await supabase
        .from('schedules')
        .select('start_time, end_time')
        .eq('employee_id', selectedEmployee)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .order('end_time', { ascending: false });

      if (error) throw error;

      if (existingSchedules && existingSchedules.length > 0) {
        // Get the latest end time
        const latestEndTime = new Date(existingSchedules[0].end_time);
        const firstAvailable = format(latestEndTime, 'HH:mm');
        setStartTime(firstAvailable);
      } else {
        // No schedules, start at 09:00
        setStartTime('09:00');
      }
    } catch (error: any) {
      console.error('Error calculating available time:', error);
      setStartTime('09:00');
    }
  };

  const fetchUserWorkstations = async () => {
    try {
      const { data: links, error } = await supabase
        .from('employee_workstation_links')
        .select('workstation:workstations(name)')
        .eq('employee_id', selectedEmployee);

      if (error) throw error;
      const workstationNames = links?.map((link: any) => link.workstation?.name).filter(Boolean) || [];
      setUserWorkstations(workstationNames);
    } catch (error: any) {
      console.error('Error fetching user workstations:', error);
      setUserWorkstations([]);
    }
  };

  const fetchAllTodoTasks = async () => {
    if (userWorkstations.length === 0) {
      setAllTodoTasks([]);
      return;
    }

    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phase:phases(name, project:projects(name))
        `)
        .eq('status', 'TODO')
        .in('workstation', userWorkstations)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      setAllTodoTasks(tasks || []);
    } catch (error: any) {
      console.error('Error fetching TODO tasks:', error);
      setAllTodoTasks([]);
    }
  };

  const fetchAvailableTasks = async (projectId: string) => {
    if (!projectId) {
      setAvailableTasks([]);
      return;
    }

    try {
      // First get phases for this project
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('project_id', projectId);

      if (phasesError) throw phasesError;
      
      const phaseIds = phases?.map(p => p.id) || [];
      
      if (phaseIds.length === 0) {
        setAvailableTasks([]);
        return;
      }

      // Then get tasks for these phases - including HOLD tasks
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phase:phases(name, project_id)
        `)
        .in('status', ['TODO', 'IN_PROGRESS', 'HOLD'])
        .in('phase_id', phaseIds)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      if (error) throw error;
      setAvailableTasks(tasks || []);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available tasks',
        variant: 'destructive'
      });
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedTaskId('');
    setTitle('');
    setDescription('');
    fetchAvailableTasks(projectId);
  };

  const handleTaskSelect = (taskId: string) => {
    const task = availableTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskId(taskId);
      setTitle(task.title);
      setDescription(task.description || '');
      
      // Calculate end time based on task duration
      if (task.duration) {
        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(start.getTime() + (task.duration * 60 * 1000));
        setEndTime(format(end, 'HH:mm'));
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a title',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create proper date objects in local timezone
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(year, month, day, startHour, startMinute);
      const endDateTime = new Date(year, month, day, endHour, endMinute);

      const scheduleData = {
        employee_id: selectedEmployee,
        task_id: selectedTaskId || null,
        title,
        description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        is_auto_generated: false
      };

      if (scheduleItem) {
        // Update existing schedule
        const { error } = await supabase
          .from('schedules')
          .update(scheduleData)
          .eq('id', scheduleItem.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Schedule updated successfully'
        });
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('schedules')
          .insert([scheduleData]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Schedule created successfully'
        });
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save schedule',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {scheduleItem ? 'Edit Schedule Item' : 'Add Schedule Item'}
          </DialogTitle>
          <DialogDescription>
            {scheduleItem ? 'Update the schedule item details' : 'Create a new schedule item for the selected date and employee'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="project-select">Select Project</Label>
              <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId && (
              <div className="space-y-2">
                <Label htmlFor="task-select">Select Task</Label>
                <Select value={selectedTaskId} onValueChange={handleTaskSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map((task) => (
                      <SelectItem 
                        key={task.id} 
                        value={task.id}
                        className={cn(
                          task.status === 'HOLD' && "bg-yellow-100 dark:bg-yellow-900/20"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{task.title}</span>
                          <div className="flex items-center space-x-2 ml-2">
                            {task.status === 'HOLD' && (
                              <span className="text-xs text-yellow-700 dark:text-yellow-400">HOLD</span>
                            )}
                            <span className={cn("text-xs", getPriorityColor(task.priority))}>
                              {task.priority}
                            </span>
                            {task.duration && (
                              <span className="text-xs text-muted-foreground flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {task.duration}m
                              </span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Right side - Scrollable TODO tasks list */}
          <div className="w-80 border-l pl-6">
            <div className="space-y-2 h-full flex flex-col">
              <Label>Urgent TODO Tasks (Your Workstations)</Label>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px]">
                {allTodoTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No TODO tasks for your workstations</p>
                ) : (
                  allTodoTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        // Find and select the project first
                        if (task.phase?.project_id) {
                          setSelectedProjectId(task.phase.project_id);
                          fetchAvailableTasks(task.phase.project_id);
                          // Then select the task
                          setTimeout(() => handleTaskSelect(task.id), 100);
                        }
                      }}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    >
                      <div className="font-medium text-sm">{task.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.phase?.project?.name}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn("text-xs", getPriorityColor(task.priority))}>
                          {task.priority}
                        </span>
                        <div className="flex items-center gap-2">
                          {task.duration && (
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {task.duration}m
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.due_date), 'MMM dd')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlanningTaskManager;
