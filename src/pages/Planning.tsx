
import React, { useState, useEffect } from 'react';
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
  Move,
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
  task_part?: number;
  total_parts?: number;
}

interface WorkerSchedule {
  employee: any;
  tasks: WorkerTask[];
  schedule: ScheduleItem[];
  totalDuration: number;
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

  useEffect(() => {
    fetchWorkersAndSchedules();
  }, [selectedDate]);

  const fetchWorkersAndSchedules = async () => {
    try {
      setLoading(true);
      
      // Fetch all workers
      const employeeData = await employeeService.getAll();
      const workerEmployees = employeeData.filter(emp => emp.role === 'worker');
      setWorkers(workerEmployees);

      // Fetch schedules and tasks for each worker
      const schedulePromises = workerEmployees.map(async (worker) => {
        // Get worker's tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            *,
            phases (
              name,
              projects (name)
            )
          `)
          .or(`assignee_id.eq.${worker.id},assignee_id.is.null`)
          .neq('status', 'COMPLETED')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true });

        if (tasksError) {
          console.error('Error fetching tasks for worker:', worker.id, tasksError);
        }

        // Get worker's schedule for the selected date
        const schedule = await planningService.getSchedulesByEmployeeAndDate(worker.id, selectedDate);

        const workerTasks = tasks || [];
        const totalDuration = workerTasks.reduce((sum, task) => sum + (task.duration || 60), 0);

        return {
          employee: worker,
          tasks: workerTasks,
          schedule: schedule,
          totalDuration
        };
      });

      const schedules = await Promise.all(schedulePromises);
      setWorkerSchedules(schedules);
      
      if (schedules.length > 0 && !selectedWorker) {
        setSelectedWorker(schedules[0].employee.id);
      }
    } catch (error) {
      console.error('Error fetching workers and schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load worker schedules",
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

      // Get worker's assigned workstations
      const { data: workerWorkstations, error: workstationsError } = await supabase
        .from('employee_workstation_links')
        .select(`
          workstations (
            id,
            name
          )
        `)
        .eq('employee_id', workerId);

      if (workstationsError) {
        console.error('Error fetching worker workstations:', workstationsError);
        throw workstationsError;
      }

      const assignedWorkstationNames = workerWorkstations?.map(link => link.workstations?.name).filter(Boolean) || [];
      
      // If no workstations assigned via links, check legacy workstation field
      if (assignedWorkstationNames.length === 0 && worker.employee.workstation) {
        assignedWorkstationNames.push(worker.employee.workstation);
      }

      if (assignedWorkstationNames.length === 0) {
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

      // Get available tasks that are assigned to the worker's workstations
      const availableTasks = worker.tasks.filter(task => {
        if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS') {
          return false;
        }
        
        // Check if task workstation matches any of the worker's assigned workstations
        return assignedWorkstationNames.includes(task.workstation);
      });

      if (availableTasks.length === 0) {
        toast({
          title: "No Tasks Available",
          description: `No tasks available for ${worker.employee.name}'s assigned workstations: ${assignedWorkstationNames.join(', ')}`,
          variant: "destructive"
        });
        return;
      }

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
          const isPartialTask = timeToAllocate < remainingTaskDuration;
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

      // Insert schedules
      if (schedulesToInsert.length > 0) {
        const { error } = await supabase
          .from('schedules')
          .insert(schedulesToInsert);

        if (error) throw error;
      }

      await fetchWorkersAndSchedules();
      
      toast({
        title: "Schedule Generated",
        description: `Continuous daily schedule generated for ${worker.employee.name} using tasks from workstations: ${assignedWorkstationNames.join(', ')}`,
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
        description: "Continuous daily schedules generated for all workers",
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

      await fetchWorkersAndSchedules();
      
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
                  />
                </PopoverContent>
              </Popover>
              
              {isAdmin && (
                <div className="flex space-x-2">
                  <Button
                    onClick={generateAllSchedules}
                    disabled={generatingSchedule}
                    className="whitespace-nowrap"
                  >
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
                          {worker.name}
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
                      Generate Continuous Schedule
                    </Button>
                    <Button
                      onClick={() => setShowTaskManager(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Manual Task
                    </Button>
                  </div>
                )}
              </div>

              {/* Worker Overview */}
              {selectedWorkerSchedule && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Available Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedWorkerSchedule.tasks.length}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{Math.round(selectedWorkerSchedule.totalDuration / 60)}h</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Working Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{Math.round(totalWorkingMinutes / 60)}h</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Scheduled Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedWorkerSchedule.schedule.length}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Schedule Efficiency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateScheduleEfficiency(selectedWorkerSchedule.schedule)}%</div>
                      <div className="text-xs text-muted-foreground">Time utilization</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Worker Schedule */}
              {selectedWorkerSchedule && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      {selectedWorkerSchedule.employee.name} - Continuous Daily Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {workingHours.map((period) => {
                        const periodSchedules = selectedWorkerSchedule.schedule.filter(item => {
                          const startTime = format(new Date(item.start_time), 'HH:mm');
                          return startTime >= period.start && startTime < period.end;
                        });

                        return (
                          <div key={period.name} className="border rounded-lg overflow-hidden">
                            <div className="bg-blue-50 px-4 py-2 border-b">
                              <h4 className="font-medium">{period.name}</h4>
                              <p className="text-sm text-gray-600">{period.start} - {period.end} ({period.duration} min)</p>
                            </div>
                            
                            <div className="p-4">
                              {periodSchedules.length > 0 ? (
                                <div className="space-y-2">
                                  {periodSchedules.map((item) => {
                                    const itemDuration = Math.round((new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / (1000 * 60));
                                    return (
                                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                        <div className="flex-1">
                                          <h5 className="font-medium">{item.title}</h5>
                                          {item.description && (
                                            <p className="text-sm text-gray-600">{item.description}</p>
                                          )}
                                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                            <span className="flex items-center">
                                              <Clock className="h-3 w-3 mr-1" />
                                              {formatTime(item.start_time)} - {formatTime(item.end_time)} ({itemDuration}m)
                                            </span>
                                            {item.task && (
                                              <Badge className={getPriorityColor(item.task.priority)}>
                                                {item.task.priority}
                                              </Badge>
                                            )}
                                            {item.is_auto_generated && (
                                              <Badge variant="outline">Auto-generated</Badge>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {isAdmin && (
                                          <div className="flex items-center space-x-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setEditingScheduleItem(item);
                                                setShowTaskManager(true);
                                              }}
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => deleteScheduleItem(item.id)}
                                              className="text-red-600 hover:bg-red-50"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center text-gray-500 py-4">
                                  No tasks scheduled for this period
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Available Tasks */}
              {selectedWorkerSchedule && selectedWorkerSchedule.tasks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Available Tasks for {selectedWorkerSchedule.employee.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedWorkerSchedule.tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1">
                            <h5 className="font-medium">{task.title}</h5>
                            {task.description && (
                              <p className="text-sm text-gray-600">{task.description}</p>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                              <span>Duration: {task.duration || 60} min</span>
                              <span>Due: {format(new Date(task.due_date), 'MMM dd')}</span>
                              {task.phases && (
                                <span>Project: {task.phases.projects.name}</span>
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
              fetchWorkersAndSchedules();
              setShowTaskManager(false);
              setEditingScheduleItem(null);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Planning;
