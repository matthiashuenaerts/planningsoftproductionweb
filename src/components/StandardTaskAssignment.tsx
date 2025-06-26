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
import { Clock, Users, Info } from 'lucide-react';
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

interface WorkingPeriod {
  name: string;
  start: string;
  end: string;
  duration: number;
}

interface ScheduleItem {
  id: string;
  employee_id: string;
  task_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_auto_generated: boolean;
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
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
  const { toast } = useToast();

  // Working hours configuration - matches Planning.tsx
  const workingHours: WorkingPeriod[] = [
    { name: 'Morning', start: '07:00', end: '10:00', duration: 180 },
    { name: 'Mid-day', start: '10:15', end: '12:30', duration: 135 },
    { name: 'Afternoon', start: '13:00', end: '16:00', duration: 180 },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchWorkstationTasks();
      // Reset form
      setSelectedTaskId('');
      setSelectedWorkers([]);
      setStartTime('09:00');
      setDuration(60);
      setScheduleWarnings([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedWorkers.length > 0 && startTime && duration) {
      checkForScheduleChanges();
    } else {
      setScheduleWarnings([]);
    }
  }, [selectedWorkers, startTime, duration]);

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

  const checkForScheduleChanges = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const standardTaskStart = new Date(`${dateStr}T${startTime}:00`);
    const standardTaskEnd = new Date(standardTaskStart.getTime() + (duration * 60 * 1000));

    const warnings: string[] = [];

    for (const workerId of selectedWorkers) {
      // Get existing schedule for this worker
      const { data: scheduleItems, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('employee_id', workerId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .order('start_time', { ascending: true });

      if (error) continue;

      // Check for overlaps with existing tasks
      const overlappingTasks = scheduleItems?.filter(item => {
        const itemStart = new Date(item.start_time);
        const itemEnd = new Date(item.end_time);
        return standardTaskStart < itemEnd && standardTaskEnd > itemStart;
      }) || [];

      // Check for tasks that need to be moved
      const tasksToMove = scheduleItems?.filter(item => {
        const itemStart = new Date(item.start_time);
        return itemStart >= standardTaskEnd;
      }) || [];

      if (overlappingTasks.length > 0 || tasksToMove.length > 0) {
        const worker = workers.find(w => w.id === workerId);
        warnings.push(`${worker?.name}: Schedule will be automatically adjusted to accommodate the standard task. Existing tasks will be split and rescheduled as needed.`);
      }
    }

    setScheduleWarnings(warnings);
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
      
      const startDateTime = new Date(`${dateStr}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

      console.log('Creating standard task:', {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration,
        selectedWorkers: selectedWorkers.length
      });

      // Process each worker
      for (const workerId of selectedWorkers) {
        await insertStandardTaskWithRescheduling(workerId, selectedTask, startDateTime, endDateTime);
      }

      toast({
        title: 'Success',
        description: `Standard task assigned to ${selectedWorkers.length} worker(s) with automatic schedule adjustments`,
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

  const insertStandardTaskWithRescheduling = async (
    workerId: string, 
    selectedTask: any, 
    standardTaskStart: Date, 
    standardTaskEnd: Date
  ) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Get all existing schedule items for this worker on this date
    const { data: existingSchedule, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('employee_id', workerId)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`)
      .order('start_time', { ascending: true });

    if (error) throw error;

    console.log(`Processing ${existingSchedule?.length || 0} existing tasks for worker ${workerId}`);

    // Find tasks that need to be modified or moved
    const tasksToProcess: (ScheduleItem & { duration: number })[] = [];
    const tasksToDelete: string[] = [];
    const newTasks: any[] = [];

    // Process each existing task
    for (const task of existingSchedule || []) {
      const taskStart = new Date(task.start_time);
      const taskEnd = new Date(task.end_time);
      const taskDuration = (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60);

      // Check if task overlaps with standard task
      if (standardTaskStart < taskEnd && standardTaskEnd > taskStart) {
        console.log(`Task "${task.title}" overlaps with standard task, splitting...`);
        
        // Delete the original task
        tasksToDelete.push(task.id);

        // Split the task if necessary
        if (taskStart < standardTaskStart) {
          // Create first part (before standard task)
          const firstPartEnd = new Date(standardTaskStart);
          newTasks.push({
            employee_id: workerId,
            task_id: task.task_id,
            title: `${task.title} (Part 1)`,
            description: task.description,
            start_time: taskStart.toISOString(),
            end_time: firstPartEnd.toISOString(),
            is_auto_generated: task.is_auto_generated
          });
        }

        if (taskEnd > standardTaskEnd) {
          // Create second part (after standard task) - to be rescheduled
          const secondPartDuration = (taskEnd.getTime() - Math.max(taskStart.getTime(), standardTaskEnd.getTime())) / (1000 * 60);
          tasksToProcess.push({
            ...task,
            title: taskStart < standardTaskStart ? `${task.title} (Part 2)` : task.title,
            duration: secondPartDuration
          });
        }
      } else if (taskStart >= standardTaskEnd) {
        // Task starts after standard task - needs rescheduling
        tasksToProcess.push({
          ...task,
          duration: taskDuration
        });
        tasksToDelete.push(task.id);
      }
    }

    // Delete overlapping tasks
    if (tasksToDelete.length > 0) {
      await supabase
        .from('schedules')
        .delete()
        .in('id', tasksToDelete);
    }

    // Insert the standard task
    await supabase
      .from('schedules')
      .insert({
        employee_id: workerId,
        title: selectedTask.task_name,
        description: selectedTask.description || '',
        start_time: standardTaskStart.toISOString(),
        end_time: standardTaskEnd.toISOString(),
        is_auto_generated: false
      });

    // Insert first parts of split tasks
    if (newTasks.length > 0) {
      await supabase
        .from('schedules')
        .insert(newTasks);
    }

    // Reschedule tasks that come after the standard task
    await rescheduleTasksAfterStandardTask(workerId, standardTaskEnd, tasksToProcess);
  };

  const rescheduleTasksAfterStandardTask = async (
    workerId: string,
    startFromTime: Date,
    tasksToReschedule: (ScheduleItem & { duration: number })[]
  ) => {
    if (tasksToReschedule.length === 0) return;

    console.log(`Rescheduling ${tasksToReschedule.length} tasks after standard task`);

    // Start rescheduling immediately after the standard task
    let currentTime = new Date(startFromTime);
    
    for (const task of tasksToReschedule) {
      // Find the next available slot that can accommodate this task
      const nextSlot = findNextAvailableSlotConnected(currentTime, task.duration);
      
      if (!nextSlot) {
        console.warn(`Could not reschedule task "${task.title}" - no available slot`);
        continue;
      }

      const newStartTime = nextSlot.start;
      const newEndTime = nextSlot.end;

      console.log(`Rescheduling "${task.title}" to ${newStartTime.toISOString()} - ${newEndTime.toISOString()}`);

      await supabase
        .from('schedules')
        .insert({
          employee_id: workerId,
          task_id: task.task_id,
          title: task.title,
          description: task.description,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          is_auto_generated: task.is_auto_generated
        });

      // Update current time to end of this task for next task (no gaps)
      currentTime = new Date(newEndTime);
    }
  };

  const findNextAvailableSlotConnected = (
    startSearchFrom: Date, 
    durationMinutes: number
  ): { start: Date; end: Date } | null => {
    let searchTime = new Date(startSearchFrom);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Don't add buffer - we want tasks to be connected
    while (searchTime.getHours() < 16) {
      // Find which working period this time falls into
      const currentHour = searchTime.getHours();
      const currentMinute = searchTime.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      let currentPeriod = null;
      for (const period of workingHours) {
        const periodStart = parseInt(period.start.split(':')[0]) * 60 + parseInt(period.start.split(':')[1]);
        const periodEnd = parseInt(period.end.split(':')[0]) * 60 + parseInt(period.end.split(':')[1]);
        
        if (currentTimeMinutes >= periodStart && currentTimeMinutes < periodEnd) {
          currentPeriod = period;
          break;
        }
      }

      if (!currentPeriod) {
        // We're in a break, jump to next working period
        const nextPeriod = workingHours.find(period => {
          const periodStart = parseInt(period.start.split(':')[0]) * 60 + parseInt(period.start.split(':')[1]);
          return periodStart > currentTimeMinutes;
        });
        
        if (!nextPeriod) break; // No more working periods today
        
        searchTime = new Date(selectedDate);
        searchTime.setHours(parseInt(nextPeriod.start.split(':')[0]), parseInt(nextPeriod.start.split(':')[1]), 0, 0);
        continue;
      }

      // Check if task fits in current period
      const periodEndTime = new Date(selectedDate);
      periodEndTime.setHours(parseInt(currentPeriod.end.split(':')[0]), parseInt(currentPeriod.end.split(':')[1]), 0, 0);
      
      const proposedEndTime = new Date(searchTime.getTime() + durationMinutes * 60 * 1000);
      
      if (proposedEndTime <= periodEndTime) {
        // Task fits in current period
        return { start: searchTime, end: proposedEndTime };
      } else {
        // Task doesn't fit completely in current period
        // Calculate remaining time in current period
        const remainingTimeInPeriod = (periodEndTime.getTime() - searchTime.getTime()) / (1000 * 60);
        
        if (remainingTimeInPeriod >= 5) { // Only split if meaningful time remains
          // Use remaining time in current period
          const partialEndTime = new Date(periodEndTime);
          return { start: searchTime, end: partialEndTime };
        } else {
          // Move to next period
          const nextPeriodIndex = workingHours.indexOf(currentPeriod) + 1;
          if (nextPeriodIndex >= workingHours.length) break; // No more periods
          
          const nextPeriod = workingHours[nextPeriodIndex];
          searchTime = new Date(selectedDate);
          searchTime.setHours(parseInt(nextPeriod.start.split(':')[0]), parseInt(nextPeriod.start.split(':')[1]), 0, 0);
        }
      }
    }

    return null; // No available slot found
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
                min="07:00"
                max="16:00"
              />
              <p className="text-xs text-muted-foreground">
                Working hours: 07:00-10:00, 10:15-12:30, 13:00-16:00
              </p>
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

          {scheduleWarnings.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center text-blue-700">
                  <Info className="h-4 w-4 mr-2" />
                  Schedule Adjustments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-blue-700">
                  {scheduleWarnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
                <p className="text-xs text-blue-600 mt-2">
                  Tasks will be rescheduled to maintain proper working hours and breaks while ensuring no gaps between tasks.
                </p>
              </CardContent>
            </Card>
          )}

          {selectedWorkers.length > 0 && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center text-sm text-green-700">
                <Clock className="h-4 w-4 mr-2" />
                <span>
                  Standard task will be scheduled from {startTime} for {duration} minutes
                  {selectedWorkers.length > 1 && ` for ${selectedWorkers.length} workers`}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Existing tasks will be connected without gaps while maintaining designated break times.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
          >
            {loading ? 'Assigning...' : 'Assign Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StandardTaskAssignment;
