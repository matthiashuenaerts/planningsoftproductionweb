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
        warnings.push(`${worker?.name}: Schedule will be automatically adjusted to accommodate the standard task. Overlapping tasks will be split and moved to later times, with only the last tasks potentially shortened if needed.`);
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

    // Separate tasks into different categories
    const tasksToDelete: string[] = [];
    const tasksBeforeStandard: any[] = [];
    const tasksToReschedule: (ScheduleItem & { duration: number; originalStart: Date; originalEnd: Date })[] = [];

    // Process each existing task
    for (const task of existingSchedule || []) {
      const taskStart = new Date(task.start_time);
      const taskEnd = new Date(task.end_time);
      const taskDuration = (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60);

      // Check if task overlaps with standard task
      if (standardTaskStart < taskEnd && standardTaskEnd > taskStart) {
        console.log(`Task "${task.title}" overlaps with standard task, processing...`);
        
        // Delete the original overlapping task
        tasksToDelete.push(task.id);

        // If task starts before standard task, keep the part before
        if (taskStart < standardTaskStart) {
          const beforePartEnd = new Date(standardTaskStart);
          const beforePartDuration = (beforePartEnd.getTime() - taskStart.getTime()) / (1000 * 60);
          tasksBeforeStandard.push({
            employee_id: workerId,
            task_id: task.task_id,
            title: `${task.title} (Part 1)`,
            description: task.description,
            start_time: taskStart.toISOString(),
            end_time: beforePartEnd.toISOString(),
            is_auto_generated: task.is_auto_generated
          });
          console.log(`Keeping part before standard task: ${beforePartDuration}min`);
        }

        // If task extends beyond standard task, schedule the remainder for later
        // Keep the FULL remaining duration of the original task
        if (taskEnd > standardTaskEnd) {
          const remainingDuration = taskStart < standardTaskStart 
            ? (taskEnd.getTime() - standardTaskEnd.getTime()) / (1000 * 60)
            : taskDuration; // Full duration if task starts after standard task start
          
          tasksToReschedule.push({
            ...task,
            title: taskStart < standardTaskStart ? `${task.title} (Part 2)` : task.title,
            duration: remainingDuration,
            originalStart: taskStart,
            originalEnd: taskEnd
          });
          console.log(`Scheduling remainder with duration: ${remainingDuration}min`);
        }
      } else if (taskStart >= standardTaskEnd) {
        // Task starts after standard task - needs rescheduling with full duration
        console.log(`Task "${task.title}" needs to be moved after standard task with full duration: ${taskDuration}min`);
        tasksToReschedule.push({
          ...task,
          duration: taskDuration,
          originalStart: taskStart,
          originalEnd: taskEnd
        });
        tasksToDelete.push(task.id);
      }
    }

    // Delete overlapping and moved tasks
    if (tasksToDelete.length > 0) {
      await supabase
        .from('schedules')
        .delete()
        .in('id', tasksToDelete);
    }

    // Insert tasks that come before the standard task
    if (tasksBeforeStandard.length > 0) {
      await supabase
        .from('schedules')
        .insert(tasksBeforeStandard);
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

    // Reschedule tasks that come after the standard task
    await rescheduleTasksAfterStandardTask(workerId, standardTaskEnd, tasksToReschedule);
  };

  const rescheduleTasksAfterStandardTask = async (
    workerId: string,
    startFromTime: Date,
    tasksToReschedule: (ScheduleItem & { duration: number; originalStart: Date; originalEnd: Date })[]
  ) => {
    if (tasksToReschedule.length === 0) return;

    console.log(`Rescheduling ${tasksToReschedule.length} tasks after standard task`);

    // Start rescheduling immediately after the standard task
    let currentTime = new Date(startFromTime);
    const tasksToInsert: any[] = [];
    const tasksForFinalProcessing: typeof tasksToReschedule = [];
    
    // First pass: schedule all tasks with their FULL duration if possible
    for (const task of tasksToReschedule) {
      console.log(`Attempting to schedule "${task.title}" with full duration: ${task.duration}min`);
      
      const nextSlot = findNextAvailableSlot(currentTime, task.duration);
      
      if (nextSlot) {
        const actualDuration = (nextSlot.end.getTime() - nextSlot.start.getTime()) / (1000 * 60);
        
        if (actualDuration >= task.duration) {
          // Perfect fit - schedule with full duration
          console.log(`Perfect fit for "${task.title}": ${nextSlot.start.toISOString()} - ${nextSlot.end.toISOString()}`);
          
          tasksToInsert.push({
            employee_id: workerId,
            task_id: task.task_id,
            title: task.title,
            description: task.description,
            start_time: nextSlot.start.toISOString(),
            end_time: new Date(nextSlot.start.getTime() + task.duration * 60 * 1000).toISOString(),
            is_auto_generated: task.is_auto_generated
          });
          
          // Update current time to end of this task (connected scheduling)
          currentTime = new Date(nextSlot.start.getTime() + task.duration * 60 * 1000);
        } else {
          // This task needs to be handled in final processing (potential shortening)
          console.log(`Task "${task.title}" doesn't fit with full duration, adding to final processing`);
          tasksForFinalProcessing.push(task);
        }
      } else {
        // No slot found - add to final processing
        console.log(`No slot found for "${task.title}", adding to final processing`);
        tasksForFinalProcessing.push(task);
      }
    }

    // Handle remaining tasks - these are the LAST tasks that may need shortening or dropping
    for (const task of tasksForFinalProcessing) {
      console.log(`Final processing for "${task.title}"`);
      
      // Try to find any remaining time slot
      const availableSlot = findNextAvailableSlotWithShortening(currentTime, task.duration);
      
      if (availableSlot) {
        const actualDuration = (availableSlot.end.getTime() - availableSlot.start.getTime()) / (1000 * 60);
        
        if (actualDuration >= 5) { // Minimum 5 minutes to be worth scheduling
          const finalTitle = actualDuration < task.duration ? `${task.title} (Shortened)` : task.title;
          console.log(`Scheduling final task "${finalTitle}" from ${task.duration}min to ${actualDuration}min`);
          
          tasksToInsert.push({
            employee_id: workerId,
            task_id: task.task_id,
            title: finalTitle,
            description: task.description,
            start_time: availableSlot.start.toISOString(),
            end_time: availableSlot.end.toISOString(),
            is_auto_generated: task.is_auto_generated
          });
          
          currentTime = new Date(availableSlot.end);
        } else {
          console.log(`Dropping final task "${task.title}" - insufficient time remaining`);
        }
      } else {
        console.log(`Dropping final task "${task.title}" - no available time slot`);
      }
    }

    // Insert all scheduled tasks
    if (tasksToInsert.length > 0) {
      console.log(`Inserting ${tasksToInsert.length} rescheduled tasks`);
      await supabase
        .from('schedules')
        .insert(tasksToInsert);
    }
  };

  const findNextAvailableSlot = (
    startSearchFrom: Date, 
    durationMinutes: number
  ): { start: Date; end: Date } | null => {
    let searchTime = new Date(startSearchFrom);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(16, 0, 0, 0); // End of working day
    
    while (searchTime < endOfDay) {
      const currentTimeSlot = findCurrentWorkingPeriod(searchTime);
      
      if (!currentTimeSlot) {
        // We're in a break, jump to next working period
        const nextPeriod = findNextWorkingPeriod(searchTime);
        if (!nextPeriod) break;
        
        searchTime = nextPeriod.start;
        continue;
      }

      // Check if task fits completely in current period
      const proposedEndTime = new Date(searchTime.getTime() + durationMinutes * 60 * 1000);
      
      if (proposedEndTime <= currentTimeSlot.end) {
        // Task fits completely in current period
        return { start: new Date(searchTime), end: proposedEndTime };
      } else {
        // Task doesn't fit in current period, move to next period
        const nextPeriod = findNextWorkingPeriod(currentTimeSlot.end);
        if (!nextPeriod) break;
        
        searchTime = nextPeriod.start;
      }
    }

    return null;
  };

  const findNextAvailableSlotWithShortening = (
    startSearchFrom: Date, 
    durationMinutes: number
  ): { start: Date; end: Date } | null => {
    let searchTime = new Date(startSearchFrom);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(16, 0, 0, 0);
    
    while (searchTime < endOfDay) {
      const currentTimeSlot = findCurrentWorkingPeriod(searchTime);
      
      if (!currentTimeSlot) {
        const nextPeriod = findNextWorkingPeriod(searchTime);
        if (!nextPeriod) break;
        
        searchTime = nextPeriod.start;
        continue;
      }

      const availableTime = (currentTimeSlot.end.getTime() - searchTime.getTime()) / (1000 * 60);
      
      if (availableTime >= durationMinutes) {
        // Full duration fits
        const proposedEndTime = new Date(searchTime.getTime() + durationMinutes * 60 * 1000);
        return { start: new Date(searchTime), end: proposedEndTime };
      } else if (availableTime >= 5) {
        // Use whatever time is available (shortened task)
        return { start: new Date(searchTime), end: new Date(currentTimeSlot.end) };
      } else {
        // Move to next period
        const nextPeriod = findNextWorkingPeriod(currentTimeSlot.end);
        if (!nextPeriod) break;
        
        searchTime = nextPeriod.start;
      }
    }

    return null;
  };

  const findCurrentWorkingPeriod = (time: Date): { start: Date; end: Date } | null => {
    const timeMinutes = time.getHours() * 60 + time.getMinutes();
    
    for (const period of workingHours) {
      const periodStart = parseInt(period.start.split(':')[0]) * 60 + parseInt(period.start.split(':')[1]);
      const periodEnd = parseInt(period.end.split(':')[0]) * 60 + parseInt(period.end.split(':')[1]);
      
      if (timeMinutes >= periodStart && timeMinutes < periodEnd) {
        const startTime = new Date(selectedDate);
        startTime.setHours(parseInt(period.start.split(':')[0]), parseInt(period.start.split(':')[1]), 0, 0);
        
        const endTime = new Date(selectedDate);
        endTime.setHours(parseInt(period.end.split(':')[0]), parseInt(period.end.split(':')[1]), 0, 0);
        
        return { start: startTime, end: endTime };
      }
    }
    
    return null;
  };

  const findNextWorkingPeriod = (afterTime: Date): { start: Date; end: Date } | null => {
    const timeMinutes = afterTime.getHours() * 60 + afterTime.getMinutes();
    
    for (const period of workingHours) {
      const periodStart = parseInt(period.start.split(':')[0]) * 60 + parseInt(period.start.split(':')[1]);
      
      if (periodStart > timeMinutes) {
        const startTime = new Date(selectedDate);
        startTime.setHours(parseInt(period.start.split(':')[0]), parseInt(period.start.split(':')[1]), 0, 0);
        
        const endTime = new Date(selectedDate);
        endTime.setHours(parseInt(period.end.split(':')[0]), parseInt(period.end.split(':')[1]), 0, 0);
        
        return { start: startTime, end: endTime };
      }
    }
    
    return null;
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
