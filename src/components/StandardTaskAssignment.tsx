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
    const tasksToReschedule: (ScheduleItem & { originalDuration: number; splitPart?: 'before' | 'after' })[] = [];

    // Process each existing task
    for (const task of existingSchedule || []) {
      const taskStart = new Date(task.start_time);
      const taskEnd = new Date(task.end_time);
      const originalTaskDuration = (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60);

      // Check if task overlaps with standard task
      if (standardTaskStart < taskEnd && standardTaskEnd > taskStart) {
        console.log(`Task "${task.title}" overlaps with standard task, splitting...`);
        
        // Delete the original overlapping task
        tasksToDelete.push(task.id);

        // If task starts before standard task, create the "before" part
        if (taskStart < standardTaskStart) {
          const beforePartDuration = (standardTaskStart.getTime() - taskStart.getTime()) / (1000 * 60);
          tasksBeforeStandard.push({
            employee_id: workerId,
            task_id: task.task_id,
            title: `${task.title.replace(' (Part 1)', '').replace(' (Part 2)', '')} (Part 1)`,
            description: task.description,
            start_time: taskStart.toISOString(),
            end_time: standardTaskStart.toISOString(),
            is_auto_generated: task.is_auto_generated
          });
          console.log(`Created before part with duration: ${beforePartDuration}min`);
        }

        // If task extends beyond standard task, create the "after" part with remaining duration
        if (taskEnd > standardTaskEnd) {
          const beforePartDuration = taskStart < standardTaskStart 
            ? (standardTaskStart.getTime() - taskStart.getTime()) / (1000 * 60)
            : 0;
          
          // Calculate remaining duration to preserve total original duration
          const remainingDuration = originalTaskDuration - beforePartDuration;
          
          const partLabel = taskStart < standardTaskStart ? ' (Part 2)' : '';
          
          tasksToReschedule.push({
            ...task,
            title: `${task.title.replace(' (Part 1)', '').replace(' (Part 2)', '')}${partLabel}`,
            originalDuration: remainingDuration, // Use remaining duration to preserve total
            splitPart: 'after'
          });
          console.log(`Scheduling after part with remaining duration: ${remainingDuration}min (original: ${originalTaskDuration}min, before: ${beforePartDuration}min)`);
        }
      } else if (taskStart >= standardTaskEnd) {
        // Task starts after standard task - needs rescheduling with full original duration
        console.log(`Task "${task.title}" needs to be moved after standard task with full duration: ${originalTaskDuration}min`);
        tasksToReschedule.push({
          ...task,
          originalDuration: originalTaskDuration
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
    tasksToReschedule: (ScheduleItem & { originalDuration: number; splitPart?: 'before' | 'after' })[]
  ) => {
    if (tasksToReschedule.length === 0) return;

    console.log(`Rescheduling ${tasksToReschedule.length} tasks after standard task`);

    let currentTime = new Date(startFromTime);
    const tasksToInsert: any[] = [];
    
    // Schedule all tasks consecutively, respecting working hours and breaks
    for (const task of tasksToReschedule) {
      console.log(`Scheduling "${task.title}" with original duration: ${task.originalDuration}min`);
      
      let remainingDuration = task.originalDuration;
      let taskPartNumber = task.splitPart === 'after' ? 2 : 1;
      const baseTitle = task.title.replace(' (Part 1)', '').replace(' (Part 2)', '').replace(' (Shortened)', '');
      
      // Continue scheduling until all duration is allocated
      while (remainingDuration > 0) {
        const currentWorkingPeriod = findCurrentWorkingPeriod(currentTime);
        
        if (!currentWorkingPeriod) {
          // We're in a break, jump to next working period
          console.log(`Currently in break at ${currentTime.toISOString()}, moving to next period`);
          const nextPeriod = findNextWorkingPeriod(currentTime);
          if (!nextPeriod) {
            console.log('No more working periods available, dropping remaining task duration');
            break;
          }
          
          currentTime = new Date(nextPeriod.start);
          console.log(`Moved to next working period: ${currentTime.toISOString()}`);
          continue;
        }

        // Calculate available time in current working period
        const availableTimeInPeriod = (currentWorkingPeriod.end.getTime() - currentTime.getTime()) / (1000 * 60);
        console.log(`Available time in current period: ${availableTimeInPeriod}min (need ${remainingDuration}min)`);
        
        if (availableTimeInPeriod <= 0) {
          // No time left in this period, move to next
          const nextPeriod = findNextWorkingPeriod(currentWorkingPeriod.end);
          if (!nextPeriod) {
            console.log('No more working periods available');
            break;
          }
          
          currentTime = new Date(nextPeriod.start);
          continue;
        }

        // Determine how much time to allocate in this period
        const timeToAllocate = Math.min(remainingDuration, availableTimeInPeriod);
        const endTime = new Date(currentTime.getTime() + timeToAllocate * 60 * 1000);
        
        // Create task title with appropriate part numbering
        let taskTitle = baseTitle;
        if (task.originalDuration > availableTimeInPeriod || taskPartNumber > 1) {
          taskTitle = `${baseTitle} (Part ${taskPartNumber})`;
        }
        
        console.log(`Scheduling part "${taskTitle}" from ${currentTime.toISOString()} to ${endTime.toISOString()} (${timeToAllocate}min)`);
        
        tasksToInsert.push({
          employee_id: workerId,
          task_id: task.task_id,
          title: taskTitle,
          description: task.description,
          start_time: currentTime.toISOString(),
          end_time: endTime.toISOString(),
          is_auto_generated: task.is_auto_generated
        });
        
        // Update remaining duration and current time
        remainingDuration -= timeToAllocate;
        currentTime = new Date(endTime);
        taskPartNumber++;
        
        console.log(`Remaining duration: ${remainingDuration}min, next start time: ${currentTime.toISOString()}`);
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

  const findNextAvailableSlotRespectingBreaks = (
    startSearchFrom: Date, 
    durationMinutes: number
  ): { start: Date; end: Date } | null => {
    let searchTime = new Date(startSearchFrom);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(16, 0, 0, 0); // End of working day
    
    console.log(`Looking for ${durationMinutes}min slot starting from ${searchTime.toISOString()}`);
    
    while (searchTime < endOfDay) {
      const currentWorkingPeriod = findCurrentWorkingPeriod(searchTime);
      
      if (!currentWorkingPeriod) {
        // We're in a break, jump to next working period
        console.log(`Currently in break at ${searchTime.toISOString()}, moving to next period`);
        const nextPeriod = findNextWorkingPeriod(searchTime);
        if (!nextPeriod) {
          console.log('No more working periods available');
          break;
        }
        
        searchTime = new Date(nextPeriod.start);
        console.log(`Moved to next working period: ${searchTime.toISOString()}`);
        continue;
      }

      // Calculate available time in current working period
      const availableTimeInPeriod = (currentWorkingPeriod.end.getTime() - searchTime.getTime()) / (1000 * 60);
      console.log(`Available time in current period: ${availableTimeInPeriod}min (need ${durationMinutes}min)`);
      
      if (availableTimeInPeriod >= durationMinutes) {
        // Task fits completely in current period
        const proposedEndTime = new Date(searchTime.getTime() + durationMinutes * 60 * 1000);
        console.log(`Task fits! Scheduling from ${searchTime.toISOString()} to ${proposedEndTime.toISOString()}`);
        return { start: new Date(searchTime), end: proposedEndTime };
      } else {
        // Task doesn't fit in current period, move to next period
        console.log(`Task doesn't fit in current period, moving to next period`);
        const nextPeriod = findNextWorkingPeriod(currentWorkingPeriod.end);
        if (!nextPeriod) {
          console.log('No more working periods available');
          break;
        }
        
        searchTime = new Date(nextPeriod.start);
        console.log(`Moved to next working period: ${searchTime.toISOString()}`);
      }
    }

    console.log('No suitable slot found');
    return null;
  };

  const findNextAvailableSlotConsecutive = (
    startSearchFrom: Date, 
    durationMinutes: number
  ): { start: Date; end: Date } | null => {
    // Use the same logic as the breaks-respecting function
    return findNextAvailableSlotRespectingBreaks(startSearchFrom, durationMinutes);
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
                  Tasks will be properly split and rescheduled to maintain their original duration while accommodating the standard task.
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
                Overlapping tasks will be split while preserving their original total duration.
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
