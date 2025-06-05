
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
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchAvailableTasks();
      if (scheduleItem) {
        // Edit mode
        setTitle(scheduleItem.title || '');
        setDescription(scheduleItem.description || '');
        setStartTime(format(new Date(scheduleItem.start_time), 'HH:mm'));
        setEndTime(format(new Date(scheduleItem.end_time), 'HH:mm'));
        setSelectedTaskId(scheduleItem.task_id || '');
      } else {
        // Add mode - reset form
        setTitle('');
        setDescription('');
        setStartTime('09:00');
        setEndTime('10:00');
        setSelectedTaskId('');
      }
    }
  }, [isOpen, scheduleItem]);

  const fetchAvailableTasks = async () => {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phase:phases(name, project:projects(name))
        `)
        .in('status', ['TODO', 'IN_PROGRESS'])
        .or(`assignee_id.is.null,assignee_id.eq.${selectedEmployee}`)
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
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startDateTime = `${dateStr}T${startTime}:00`;
      const endDateTime = `${dateStr}T${endTime}:00`;

      const scheduleData = {
        employee_id: selectedEmployee,
        task_id: selectedTaskId || null,
        title,
        description,
        start_time: startDateTime,
        end_time: endDateTime,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {scheduleItem ? 'Edit Schedule Item' : 'Add Schedule Item'}
          </DialogTitle>
          <DialogDescription>
            {scheduleItem ? 'Update the schedule item details' : 'Create a new schedule item for the selected date and employee'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-select">Link to Existing Task (Optional)</Label>
            <Select value={selectedTaskId} onValueChange={handleTaskSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task to link..." />
              </SelectTrigger>
              <SelectContent>
                {availableTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{task.title}</span>
                      <div className="flex items-center space-x-2 ml-2">
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
