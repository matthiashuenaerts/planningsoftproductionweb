import React, { useState, useEffect, useRef } from 'react';
import { format, startOfDay } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Calendar as CalendarIcon, 
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Navbar from '@/components/Navbar';
import { employeeService } from '@/services/dataService';
import { planningService } from '@/services/planningService';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PlanningTaskManager from '@/components/PlanningTaskManager';
import { supabase } from '@/integrations/supabase/client';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableScheduleItem from '@/components/DraggableScheduleItem';

interface WorkerTask {
  id: string;
  title: string;
  description?: string;
  duration: number;
  priority: string;
  status: string;
  due_date: string;
  assignee_id?: string;
  phase_id: string;
  phases?: {
    name: string;
    projects: {
      name: string;
    };
  };
  workstations?: Array<{
    id: string;
    name: string;
  }>;
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
  task?: WorkerTask;
}

interface WorkerSchedule {
  employee: any;
  tasks: WorkerTask[];
  schedule: ScheduleItem[];
  totalDuration: number;
  assignedWorkstations: string[];
}

const Planning = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [workers, setWorkers] = useState<any[]>([]);
  const [workerSchedules, setWorkerSchedules] = useState<WorkerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentEmployee?.role === 'admin';

  // Working hours configuration
  const workingHours = [
    { name: 'Morning', start: '07:00', end: '10:00', duration: 180 },
    { name: 'Mid-day', start: '10:15', end: '12:30', duration: 135 },
    { name: 'Afternoon', start: '13:00', end: '16:00', duration: 180 },
  ];

  const totalWorkingMinutes = workingHours.reduce((sum, period) => sum + period.duration, 0);

  // Timeline configuration
  const TIMELINE_START_HOUR = 7;
  const TIMELINE_END_HOUR = 16;
  const MINUTE_TO_PIXEL_SCALE = 2; // pixels per minute

  const getMinutesFromTimelineStart = (time: string | Date | number): number => {
    const date = new Date(time);
    const timelineStartDate = new Date(date);
    timelineStartDate.setHours(TIMELINE_START_HOUR, 0, 0, 0);
    const diff = (date.getTime() - timelineStartDate.getTime()) / (1000 * 60);
    return Math.max(0, diff);
  };
  
  useEffect(() => {
    fetchAllData();
  }, [selectedDate]);

  const fetchAllTodoTasks = async () => {
    try {
      // Get all TODO tasks with project information and linked workstations
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phases (
            name,
            projects (
              name
            )
          ),
          task_workstation_links (
            workstations (
              id,
              name
            )
          )
        `)
        .eq('status', 'TODO')
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching all TODO tasks:', error);
        return [];
      }

      console.log(`Found ${tasks?.length || 0} TODO tasks in total`);
      
      return tasks?.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High" | "Urgent",
        status: task.status as "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD",
        workstations: task.task_workstation_links?.map((link: any) => link.workstations).filter(Boolean) || []
      })) || [];
    } catch (error) {
      console.error('Error in fetchAllTodoTasks:', error);
      return [];
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch all workers
      const employeeData = await employeeService.getAll();
      const workerEmployees = employeeData.filter(emp => emp.role === 'worker');
      setWorkers(workerEmployees);

      // Fetch all TODO tasks with workstation links
      const todoTasks = await fetchAllTodoTasks();

      // Fetch schedules and tasks for each worker
      const schedulePromises = workerEmployees.map(async (worker) => {
        console.log(`Fetching data for worker: ${worker.name} (${worker.id})`);
        
        // Get worker's assigned workstations
        const { data: workerWorkstations, error: workstationsError } = await supabase
          .from('employee_workstation_links')
          .select(`
            workstations (
              id,
              name
            )
          `)
          .eq('employee_id', worker.id);

        if (workstationsError) {
          console.error('Error fetching worker workstations:', workstationsError);
        }

        let assignedWorkstationNames = workerWorkstations?.map(link => link.workstations?.name).filter(Boolean) || [];
        
        // If no workstations assigned via links, check legacy workstation field
        const legacyWorkstation = (worker as any).workstation;
        if (assignedWorkstationNames.length === 0 && legacyWorkstation) {
          assignedWorkstationNames.push(legacyWorkstation);
        }

        console.log(`${worker.name} assigned workstations:`, assignedWorkstationNames);

        // Filter TODO tasks for this worker based on workstation links and direct assignment
        const workerTasks = todoTasks.filter(task => {
          const isAssignedToWorker = task.assignee_id === worker.id;
          
          // Check if any of the task's linked workstations match worker's workstations
          const hasMatchingWorkstation = task.workstations && task.workstations.some((taskWorkstation: any) => 
            assignedWorkstationNames.includes(taskWorkstation.name)
          );
          
          return isAssignedToWorker || hasMatchingWorkstation;
        });

        console.log(`${worker.name} has ${workerTasks.length} TODO tasks`);

        // Get worker's schedule for the selected date
        const schedule = await planningService.getSchedulesByEmployeeAndDate(worker.id, selectedDate);

        // Enhance schedule items with task data
        const enhancedSchedule = await Promise.all(schedule.map(async (scheduleItem) => {
          if (scheduleItem.task_id) {
            const taskData = todoTasks.find(t => t.id === scheduleItem.task_id);
            return { ...scheduleItem, task: taskData };
          }
          return scheduleItem;
        }));

        enhancedSchedule.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        const totalDuration = workerTasks.reduce((sum, task) => sum + (task.duration || 60), 0);

        return {
          employee: worker,
          tasks: workerTasks,
          schedule: enhancedSchedule,
          totalDuration,
          assignedWorkstations: assignedWorkstationNames
        };
      });

      const schedules = await Promise.all(schedulePromises);
      setWorkerSchedules(schedules);
      
      if (schedules.length > 0 && !selectedWorker) {
        setSelectedWorker(schedules[0].employee.id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDailySchedule = async (workerId: string) => {
    try {
      setGeneratingSchedule(true);
      
      const worker = workerSchedules.find(w => w.employee.id === workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      console.log(`Generating schedule for ${worker.employee.name}`);
      console.log(`Available TODO tasks: ${worker.tasks.length}`);
      console.log(`Assigned workstations: ${worker.assignedWorkstations.join(', ')}`);

      if (worker.assignedWorkstations.length === 0) {
        toast({
          title: "No Workstations Assigned",
          description: "This worker has no workstations assigned. Please assign workstations first.",
          variant: "destructive"
        });
        return;
      }

      // Clear existing auto-generated schedules for this worker and date
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await supabase
        .from('schedules')
        .delete()
        .eq('employee_id', workerId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .eq('is_auto_generated', true);

      const availableTasks = worker.tasks;

      console.log(`TODO tasks ready for scheduling: ${availableTasks.length}`);

      if (availableTasks.length === 0) {
        toast({
          title: "No TODO Tasks Available",
          description: `No TODO tasks available for ${worker.employee.name}'s workstations: ${worker.assignedWorkstations.join(', ')}.`,
          variant: "destructive"
        });
        return;
      }

      // Sort tasks by priority and due date
      const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      availableTasks.sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
        
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA.getTime() - dateB.getTime();
      });

      // Create continuous schedule that fills the entire day
      const schedulesToInsert = [];
      let currentTaskIndex = 0;
      let remainingTaskDuration = availableTasks[currentTaskIndex]?.duration || 60;
      let currentTask = availableTasks[currentTaskIndex];
      let taskPartCounter = 1;

      for (const period of workingHours) {
        if (!currentTask) break;

        const periodStartTime = new Date(`${dateStr}T${period.start}:00`);
        let periodRemainingMinutes = period.duration;
        let periodCurrentTime = new Date(periodStartTime);

        while (periodRemainingMinutes > 0 && currentTask) {
          const timeToAllocate = Math.min(remainingTaskDuration, periodRemainingMinutes);
          const endTime = new Date(periodCurrentTime.getTime() + (timeToAllocate * 60000));

          // Determine if this is a partial task
          const totalParts = Math.ceil((availableTasks[currentTaskIndex]?.duration || 60) / period.duration);
          
          let taskTitle = currentTask.title;
          if (totalParts > 1) {
            taskTitle = `${currentTask.title} (Part ${taskPartCounter})`;
          }

          schedulesToInsert.push({
            employee_id: workerId,
            task_id: currentTask.id,
            title: taskTitle,
            description: currentTask.description || '',
            start_time: periodCurrentTime.toISOString(),
            end_time: endTime.toISOString(),
            is_auto_generated: true
          });

          // Update counters
          remainingTaskDuration -= timeToAllocate;
          periodRemainingMinutes -= timeToAllocate;
          periodCurrentTime = new Date(endTime);

          // If task is completed, move to next task
          if (remainingTaskDuration <= 0) {
            currentTaskIndex++;
            currentTask = availableTasks[currentTaskIndex];
            remainingTaskDuration = currentTask?.duration || 60;
            taskPartCounter = 1;
          } else {
            taskPartCounter++;
          }
        }
      }

      console.log(`Schedules to insert: ${schedulesToInsert.length}`);

      // Insert schedules
      if (schedulesToInsert.length > 0) {
        const { error } = await supabase
          .from('schedules')
          .insert(schedulesToInsert);

        if (error) throw error;
      }

      await fetchAllData();
      
      toast({
        title: "Schedule Generated",
        description: `Generated ${schedulesToInsert.length} schedule items for ${worker.employee.name}`,
      });
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedule: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const generateAllSchedules = async () => {
    try {
      setGeneratingSchedule(true);
      
      for (const workerSchedule of workerSchedules) {
        await generateDailySchedule(workerSchedule.employee.id);
      }
      
      toast({
        title: "All Schedules Generated",
        description: "Generated schedules for all workers",
      });
    } catch (error: any) {
      console.error('Error generating all schedules:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedules: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const deleteScheduleItem = async (scheduleId: string) => {
    try {
      await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      await fetchAllData();
      
      toast({
        title: "Schedule Item Deleted",
        description: "Schedule item has been removed",
      });
    } catch (error: any) {
      console.error('Error deleting schedule item:', error);
      toast({
        title: "Error",
        description: "Failed to delete schedule item",
        variant: "destructive"
      });
    }
  };

  const markTaskCompleted = async (scheduleItem: ScheduleItem) => {
    try {
      // If linked to a task, update the task status
      if (scheduleItem.task_id) {
        await supabase
          .from('tasks')
          .update({ 
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            completed_by: currentEmployee?.id
          })
          .eq('id', scheduleItem.task_id);
      }

      // Remove the schedule item
      await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleItem.id);

      await fetchAllData();
      
      toast({
        title: "Task Completed",
        description: "Task marked as completed and removed from schedule",
      });
    } catch (error: any) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTime = (timeStr: string) => {
    return format(new Date(timeStr), 'HH:mm');
  };

  const calculateScheduleEfficiency = (schedule: ScheduleItem[]) => {
    if (schedule.length === 0) return 0;
    
    let totalScheduledMinutes = 0;
    schedule.forEach(item => {
      const start = new Date(item.start_time);
      const end = new Date(item.end_time);
      totalScheduledMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    });
    
    return Math.round((totalScheduledMinutes / totalWorkingMinutes) * 100);
  };

  const handleMoveTask = async (itemId: string, deltaY: number) => {
    const workerSchedule = workerSchedules.find(w => w.employee.id === selectedWorker);
    const itemToMove = workerSchedule?.schedule.find(i => i.id === itemId);
    if (!itemToMove) return;

    const minutesChange = Math.round(deltaY / MINUTE_TO_PIXEL_SCALE);
    const newStartTime = new Date(itemToMove.start_time);
    newStartTime.setMinutes(newStartTime.getMinutes() + minutesChange);

    const newEndTime = new Date(itemToMove.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + minutesChange);

    try {
      await supabase
        .from('schedules')
        .update({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
        })
        .eq('id', itemId);
      
      await fetchAllData();
      toast({ title: "Task moved", description: "Task time has been updated." });
    } catch (error: any) {
      console.error('Error moving task:', error);
      toast({ title: "Error", description: "Failed to move task.", variant: "destructive" });
    }
  };

  const handleResizeTask = async (itemId: string, deltaY: number) => {
    const workerSchedule = workerSchedules.find(w => w.employee.id === selectedWorker);
    const itemToResize = workerSchedule?.schedule.find(i => i.id === itemId);
    if (!itemToResize) return;

    const minutesChange = Math.round(deltaY / MINUTE_TO_PIXEL_SCALE);
    const newEndTime = new Date(itemToResize.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + minutesChange);

    const newDuration = (newEndTime.getTime() - new Date(itemToResize.start_time).getTime()) / 60000;
    if (newDuration < 5) {
      toast({ title: "Invalid duration", description: "Task duration cannot be less than 5 minutes.", variant: "destructive" });
      return;
    }

    try {
      await supabase
        .from('schedules')
        .update({ end_time: newEndTime.toISOString() })
        .eq('id', itemId);

      await fetchAllData();
      toast({ title: "Task resized", description: "Task duration has been updated." });
    } catch (error: any) {
      console.error('Error resizing task:', error);
      toast({ title: "Error", description: "Failed to resize task.", variant: "destructive" });
    }
  };

  const selectedWorkerSchedule = workerSchedules.find(w => w.employee.id === selectedWorker);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold">Worker Daily Planning</h1>
                <p className="text-slate-600 mt-1">
                  Create and manage continuous daily schedules for workers based on their assigned tasks
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => setSelectedDate(date || new Date())}
                      initialFocus
                      weekStartsOn={1}
                    />
                  </PopoverContent>
                </Popover>
                
                <Button
                  onClick={fetchAllData}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                
                {isAdmin && (
                  <div className="flex space-x-2">
                    <Button
                      onClick={generateAllSchedules}
                      disabled={generatingSchedule}
                      className="whitespace-nowrap"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      {generatingSchedule ? 'Generating...' : 'Generate All Schedules'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {workers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Workers Found</AlertTitle>
                <AlertDescription>
                  No employees with the 'worker' role were found. Please ensure workers are properly configured in the system.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {/* Worker Selection */}
                <div className="flex items-center justify-between">
                  <div className="w-64">
                    <Select value={selectedWorker || ''} onValueChange={setSelectedWorker}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {workers.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{worker.name}</span>
                              {(worker as any).workstation && (
                                <Badge variant="outline" className="ml-2">
                                  {(worker as any).workstation}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin && selectedWorker && (
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => generateDailySchedule(selectedWorker)}
                        disabled={generatingSchedule}
                        variant="outline"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Generate Schedule
                      </Button>
                      <Button
                        onClick={() => setShowTaskManager(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                      </Button>
                    </div>
                  )}
                </div>

                {/* Worker Overview */}
                {selectedWorkerSchedule && (
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">TODO Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{selectedWorkerSchedule.tasks.length}</div>
                        <p className="text-xs text-muted-foreground">Ready to schedule</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Workstations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{selectedWorkerSchedule.assignedWorkstations.length}</div>
                        <p className="text-xs text-muted-foreground">{selectedWorkerSchedule.assignedWorkstations.join(', ') || 'None assigned'}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{Math.round(selectedWorkerSchedule.totalDuration / 60)}h</div>
                        <p className="text-xs text-muted-foreground">Of TODO tasks</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Working Hours</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{Math.round(totalWorkingMinutes / 60)}h</div>
                        <p className="text-xs text-muted-foreground">Daily capacity</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{selectedWorkerSchedule.schedule.length}</div>
                        <p className="text-xs text-muted-foreground">Today's schedule</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{calculateScheduleEfficiency(selectedWorkerSchedule.schedule)}%</div>
                        <p className="text-xs text-muted-foreground">Time utilization</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Worker Schedule */}
                {selectedWorkerSchedule && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Users className="h-5 w-5 mr-2" />
                          {selectedWorkerSchedule.employee.name} - Daily Schedule
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedWorkerSchedule.assignedWorkstations.map(ws => (
                            <Badge key={ws} variant="outline">{ws}</Badge>
                          ))}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedWorkerSchedule.schedule.length > 0 ? (
                        <div className="flex">
                          {/* Timeline Axis */}
                          <div className="w-16 text-right pr-4 flex-shrink-0">
                            {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }).map((_, i) => {
                              const hour = TIMELINE_START_HOUR + i;
                              return (
                                <div
                                  key={hour}
                                  style={{ height: `${60 * MINUTE_TO_PIXEL_SCALE}px` }}
                                  className="relative border-t border-gray-200 first:border-t-0 -mr-4"
                                >
                                  <p className="text-xs text-gray-500 absolute -top-2 right-2">{`${hour.toString().padStart(2, '0')}:00`}</p>
                                </div>
                              );
                            })}
                          </div>
                          {/* Schedule container */}
                          <div className="relative flex-1 border-l border-gray-200">
                            {/* Hour lines */}
                            {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }).map((_, i) => (
                                <div
                                  key={`line-${i}`}
                                  className="absolute w-full h-px bg-gray-200"
                                  style={{ top: `${(i + 1) * 60 * MINUTE_TO_PIXEL_SCALE}px` }}
                                />
                              ))}

                            {/* Breaks */}
                            <div
                              className="absolute w-full flex items-center justify-center bg-gray-100 border-y border-dashed border-gray-300 z-0"
                              style={{
                                top: `${getMinutesFromTimelineStart(new Date(selectedDate).setHours(10, 0, 0, 0)) * MINUTE_TO_PIXEL_SCALE}px`,
                                height: `${15 * MINUTE_TO_PIXEL_SCALE}px`,
                              }}
                            >
                              <p className="text-xs text-gray-500">Break</p>
                            </div>
                            <div
                              className="absolute w-full flex items-center justify-center bg-gray-100 border-y border-dashed border-gray-300 z-0"
                              style={{
                                top: `${getMinutesFromTimelineStart(new Date(selectedDate).setHours(12, 30, 0, 0)) * MINUTE_TO_PIXEL_SCALE}px`,
                                height: `${30 * MINUTE_TO_PIXEL_SCALE}px`,
                              }}
                            >
                              <p className="text-xs text-gray-500">Lunch</p>
                            </div>

                            {/* Schedule Items */}
                            {selectedWorkerSchedule.schedule.map((item) => {
                              const itemDuration = Math.round((new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / (1000 * 60));
                              const top = getMinutesFromTimelineStart(item.start_time) * MINUTE_TO_PIXEL_SCALE;
                              const height = itemDuration * MINUTE_TO_PIXEL_SCALE;
                              
                              return (
                                <div
                                  key={item.id}
                                  className="absolute left-2 right-2 z-10"
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                  }}
                                >
                                  <DraggableScheduleItem
                                    item={item}
                                    onMove={handleMoveTask}
                                    onResize={handleResizeTask}
                                    isAdmin={isAdmin}
                                  >
                                    <div className={cn(
                                        "relative h-full overflow-hidden rounded border p-2",
                                        getPriorityColor(item.task?.priority || '')
                                      )}>
                                      <div className="flex justify-between h-full">
                                        <div className="flex-1 pr-2 overflow-hidden">
                                          <h5 className="font-medium text-sm truncate" title={item.title}>{item.title}</h5>
                                          {item.task?.phases?.projects?.name && (
                                            <p className="text-xs text-blue-700 truncate" title={item.task.phases.projects.name}>
                                              {item.task.phases.projects.name}
                                            </p>
                                          )}
                                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                            <span className="flex items-center">
                                              <Clock className="mr-1 h-3 w-3" />
                                              {formatTime(item.start_time)} - {formatTime(item.end_time)} ({itemDuration}m)
                                            </span>
                                            {item.is_auto_generated && (
                                              <Badge variant="outline" className="py-0 px-1 text-[10px] bg-white/50">Auto</Badge>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {isAdmin && (
                                          <div className="flex flex-col items-center justify-center space-y-1 bg-white/30 backdrop-blur-sm p-1 rounded">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => markTaskCompleted(item)}
                                              className="text-green-700 hover:bg-green-200 h-6 w-6"
                                              title="Mark as completed"
                                            >
                                              <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => {
                                                setEditingScheduleItem(item);
                                                setShowTaskManager(true);
                                              }}
                                              className="hover:bg-gray-200 h-6 w-6"
                                              title="Edit task"
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => deleteScheduleItem(item.id)}
                                              className="text-red-700 hover:bg-red-200 h-6 w-6"
                                              title="Delete task"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </DraggableScheduleItem>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded border-2 border-dashed border-gray-200 py-8 text-center text-gray-500">
                          <Clock className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                          <p>No tasks scheduled for this day</p>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowTaskManager(true)}
                              className="mt-2"
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Add Task
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Available Tasks */}
                {selectedWorkerSchedule && selectedWorkerSchedule.tasks.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Available TODO Tasks for {selectedWorkerSchedule.employee.name}</CardTitle>
                      <p className="text-sm text-gray-600">
                        Tasks from assigned workstations: {selectedWorkerSchedule.assignedWorkstations.join(', ') || 'None'}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedWorkerSchedule.tasks.slice(0, 10).map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex-1">
                              <h5 className="font-medium">{task.title}</h5>
                              {task.phases && (
                                <p className="text-sm text-blue-600">Project: {task.phases.projects.name}</p>
                              )}
                              {task.description && (
                                <p className="text-sm text-gray-600">{task.description}</p>
                              )}
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                <span>Duration: {task.duration || 60} min</span>
                                <span>Due: {format(new Date(task.due_date), 'MMM dd')}</span>
                                <span>Workstations: {task.workstations?.map(ws => ws.name).join(', ') || 'None'}</span>
                                {task.assignee_id === selectedWorkerSchedule.employee.id && (
                                  <Badge variant="secondary">Directly Assigned</Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              <Badge variant="outline">
                                {task.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        
                        {selectedWorkerSchedule.tasks.length > 10 && (
                          <div className="text-center py-4 text-sm text-gray-500">
                            ... and {selectedWorkerSchedule.tasks.length - 10} more TODO tasks
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Show message when no TODO tasks available */}
                {selectedWorkerSchedule && selectedWorkerSchedule.tasks.length === 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>No TODO Tasks Available</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 mb-2">
                          No TODO tasks found for {selectedWorkerSchedule.employee.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Assigned workstations: {selectedWorkerSchedule.assignedWorkstations.join(', ') || 'None assigned'}
                        </p>
                        {isAdmin && (
                          <Button
                            onClick={() => setShowTaskManager(true)}
                            className="mt-4"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Task
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <PlanningTaskManager
              isOpen={showTaskManager}
              onClose={() => {
                setShowTaskManager(false);
                setEditingScheduleItem(null);
              }}
              selectedDate={selectedDate}
              selectedEmployee={selectedWorker || ''}
              scheduleItem={editingScheduleItem}
              onSave={() => {
                fetchAllData();
                setShowTaskManager(false);
                setEditingScheduleItem(null);
              }}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default Planning;
