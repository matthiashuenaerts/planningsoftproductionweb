import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { workstationTasksService } from '@/services/workstationTasksService';

interface StandardTaskAssignmentProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  workers: any[];
  onSave: () => void;
}

const StandardTaskAssignment: React.FC<StandardTaskAssignmentProps> = ({
  isOpen,
  onClose,
  selectedDate,
  workers,
  onSave
}) => {
  const [workstationTasks, setWorkstationTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchWorkstationTasks();
      // Reset form
      setSelectedTaskId('');
      setSelectedWorkers([]);
      setStartTime('09:00');
      setDuration(60);
    }
  }, [isOpen]);

  const fetchWorkstationTasks = async () => {
    try {
      const tasks = await workstationTasksService.getAll();
      setWorkstationTasks(tasks);
    } catch (error: any) {
      console.error('Error fetching workstation tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workstation tasks',
        variant: 'destructive'
      });
    }
  };

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkers(prev => 
      prev.includes(workerId) 
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const handleSave = async () => {
    if (!selectedTaskId) {
      toast({
        title: 'Error',
        description: 'Please select a workstation task',
        variant: 'destructive'
      });
      return;
    }

    if (selectedWorkers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one worker',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const selectedTask = workstationTasks.find(t => t.id === selectedTaskId);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Create proper start and end times using the selected start time
      const startDateTime = new Date(`${dateStr}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

      console.log('Creating standard task:', {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration,
        selectedWorkers: selectedWorkers.length
      });

      // Create schedule entries for each selected worker
      const schedulePromises = selectedWorkers.map(workerId => {
        return supabase
          .from('schedules')
          .insert({
            employee_id: workerId,
            title: selectedTask.task_name,
            description: selectedTask.description || '',
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            is_auto_generated: false
          });
      });

      await Promise.all(schedulePromises);

      // Now reorganize schedules for each worker to fit in the new task
      for (const workerId of selectedWorkers) {
        await reorganizeWorkerSchedule(workerId, startDateTime, endDateTime);
      }

      toast({
        title: 'Success',
        description: `Standard task assigned to ${selectedWorkers.length} worker(s)`,
      });

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error assigning standard task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign standard task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const reorganizeWorkerSchedule = async (workerId: string, newTaskStart: Date, newTaskEnd: Date) => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get all existing schedule items for this worker on this date, excluding the one we just created
      const { data: scheduleItems, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('employee_id', workerId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .neq('start_time', newTaskStart.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      console.log(`Reorganizing ${scheduleItems?.length || 0} existing items for worker ${workerId}`);

      // Find overlapping tasks and tasks that come after the new task
      const overlappingAndLaterTasks = scheduleItems?.filter(item => {
        const itemStart = new Date(item.start_time);
        const itemEnd = new Date(item.end_time);
        
        // Include tasks that overlap or start after the new task start time
        return itemStart < newTaskEnd;
      }) || [];

      console.log(`Found ${overlappingAndLaterTasks.length} tasks that need rescheduling`);

      // Sort tasks by original start time to maintain order
      overlappingAndLaterTasks.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      // Reschedule overlapping and later tasks to start after the new task
      let nextAvailableTime = new Date(newTaskEnd);

      for (const task of overlappingAndLaterTasks) {
        const taskDuration = new Date(task.end_time).getTime() - new Date(task.start_time).getTime();
        const newStartTime = new Date(nextAvailableTime);
        let newEndTime = new Date(newStartTime.getTime() + taskDuration);

        // Check if the new end time goes beyond working hours (16:00)
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(16, 0, 0, 0);
        
        if (newEndTime > dayEnd) {
          // If it goes beyond working hours, move to next day or truncate
          console.log(`Task ${task.title} would extend beyond working hours, keeping within day limits`);
          newEndTime = new Date(dayEnd);
          
          // If the task becomes too short, keep minimum 15 minutes
          if (newEndTime.getTime() - newStartTime.getTime() < 15 * 60 * 1000) {
            const minimumEnd = new Date(newStartTime.getTime() + 15 * 60 * 1000);
            if (minimumEnd <= dayEnd) {
              newEndTime = minimumEnd;
            }
          }
        }

        console.log(`Rescheduling task ${task.title} from ${task.start_time} to ${newStartTime.toISOString()}`);

        await supabase
          .from('schedules')
          .update({
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString()
          })
          .eq('id', task.id);

        // Update next available time for the following task
        nextAvailableTime = new Date(newEndTime.getTime() + 5 * 60 * 1000); // 5 minute buffer
      }
    } catch (error: any) {
      console.error('Error reorganizing schedule:', error);
    }
  };

  const selectedTask = workstationTasks.find(t => t.id === selectedTaskId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Standard Task</DialogTitle>
          <DialogDescription>
            Assign a workstation task to one or more employees for {format(selectedDate, 'PPP')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="task-select">Workstation Task</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a workstation task..." />
              </SelectTrigger>
              <SelectContent>
                {workstationTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{task.task_name}</span>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className="text-xs text-muted-foreground">
                          {task.duration || 60}min
                        </span>
                        <span className="text-xs text-blue-600">
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTask && selectedTask.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTask.description}
              </p>
            )}
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
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                step="5"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to Workers</Label>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Select Workers ({selectedWorkers.length} selected)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={worker.id}
                      checked={selectedWorkers.includes(worker.id)}
                      onCheckedChange={() => handleWorkerToggle(worker.id)}
                    />
                    <Label htmlFor={worker.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span>{worker.name}</span>
                        {(worker as any).workstation && (
                          <span className="text-xs text-muted-foreground">
                            {(worker as any).workstation}
                          </span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {selectedWorkers.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center text-sm text-blue-700">
                <Clock className="h-4 w-4 mr-2" />
                <span>
                  Task will be scheduled from {startTime} for {duration} minutes
                  {selectedWorkers.length > 1 && ` for ${selectedWorkers.length} workers`}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Overlapping tasks will be automatically rescheduled after this task.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Assigning...' : 'Assign Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StandardTaskAssignment;
