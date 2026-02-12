import React, { useState, useEffect, useRef } from 'react';
import { format, startOfDay, addDays, parseISO } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';
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
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import Navbar from '@/components/Navbar';
import { employeeService } from '@/services/dataService';
import { planningService } from '@/services/planningService';
import { holidayService } from '@/services/holidayService';
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
import TaskConflictResolver from '@/components/TaskConflictResolver';
import StandardTaskAssignment from '@/components/StandardTaskAssignment';
import { supabase } from '@/integrations/supabase/client';
import DraggableScheduleItem from '@/components/DraggableScheduleItem';
import WorkstationScheduleView from '@/components/WorkstationScheduleView';
import WorkstationGanttChart from '@/components/WorkstationGanttChart';
import { ProjectCompletionInfo } from '@/services/automaticSchedulingService';
import ProductionCompletionTimeline, { ProjectCompletionData } from '@/components/planning/ProductionCompletionTimeline';
import { projectCompletionService } from '@/services/projectCompletionService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';

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
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [workers, setWorkers] = useState<any[]>([]);
  const [workerSchedules, setWorkerSchedules] = useState<WorkerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [taskConflicts, setTaskConflicts] = useState<any[]>([]);
  const [excludedTasksPerUser, setExcludedTasksPerUser] = useState<Record<string, string[]>>({});
  const [showStandardTaskAssignment, setShowStandardTaskAssignment] = useState(false);
  const [activeView, setActiveView] = useState<'worker' | 'workstation' | 'gantt'>('worker');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [showSchedulingMethodDialog, setShowSchedulingMethodDialog] = useState(false);
  const [projectCompletions, setProjectCompletions] = useState<ProjectCompletionData[]>([]);
  const [lastProductionStepName, setLastProductionStepName] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const ganttChartRef = useRef<any>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentEmployee?.role === 'admin';
  const isMobile = useIsMobile();
  const { tenant } = useTenant();

  // Scroll position preservation
  const scrollPositionRef = useRef<number>(0);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Save scroll position before updates
  const saveScrollPosition = () => {
    if (mainContentRef.current) {
      scrollPositionRef.current = mainContentRef.current.scrollTop;
    }
  };

  // Restore scroll position after updates
  const restoreScrollPosition = () => {
    if (mainContentRef.current && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        if (mainContentRef.current) {
          mainContentRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  };

  // Working hours configuration: 7:00 - 16:00 with proper breaks
  const workingHours = [
    { name: 'Early Morning', start: '07:00', end: '10:00', duration: 180 },     // 3 hours
    { name: 'Late Morning', start: '10:15', end: '12:30', duration: 135 },      // 2h 15min (break 10:00-10:15)
    { name: 'Afternoon', start: '13:00', end: '16:00', duration: 180 }           // 3 hours continuous (lunch 12:30-13:00)
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

  // Load holidays
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const holidayData = await holidayService.getHolidays(tenant?.id);
        setHolidays(holidayData);
      } catch (error) {
        console.error('Error loading holidays:', error);
      }
    };
    loadHolidays();
  }, []);

  // Load production completion timeline from database on mount
  useEffect(() => {
    const loadCompletionData = async () => {
      try {
        setTimelineLoading(true);
        const { data, lastProductionStepName: stepName } = await projectCompletionService.getCompletionData();
        setProjectCompletions(data);
        setLastProductionStepName(stepName);
      } catch (error) {
        console.error('Error loading completion data:', error);
      } finally {
        setTimelineLoading(false);
      }
    };
    loadCompletionData();
    
    // Subscribe to real-time updates
    const channel = projectCompletionService.subscribeToCompletionData(() => {
      loadCompletionData();
    });
    
    return () => {
      projectCompletionService.unsubscribeFromCompletionData(channel);
    };
  }, []);

  // Check if a date is a production team holiday
  const isProductionHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(holiday => 
      holiday.date === dateStr && holiday.team === 'production'
    );
  };

  // Get next non-holiday working day
  const getNextWorkingDay = (fromDate: Date): Date => {
    let nextDay = addDays(fromDate, 1);
    while (isProductionHoliday(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  };

  // Check if today has schedules
  const checkTodayHasSchedules = (): boolean => {
    const today = startOfDay(new Date());
    if (selectedDate.getTime() !== today.getTime()) return true; // Not today, so allow
    
    return workerSchedules.some(worker => worker.schedule.length > 0);
  };

  // Check if selected date is the next working day
  const isNextWorkingDay = (): boolean => {
    const today = startOfDay(new Date());
    const nextWorkingDay = getNextWorkingDay(today);
    return selectedDate.getTime() === nextWorkingDay.getTime();
  };

  // Check if selected date is a holiday
  const isSelectedDateHoliday = (): boolean => {
    return isProductionHoliday(selectedDate);
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
      saveScrollPosition(); // Save scroll position before data update
      
      // Fetch all workers (exclude admins from schedule generation)
      const employeeData = await employeeService.getAll(tenant?.id);
      const workerEmployees = employeeData.filter(emp => ['worker', 'preparater', 'teamleader'].includes(emp.role));
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
      // Restore scroll position after data is loaded
      setTimeout(restoreScrollPosition, 50);
    }
  };

  const detectTaskConflicts = (schedules: any[]) => {
    const taskAssignments: Record<string, any[]> = {};
    
    // Group schedules by task_id
    for (const schedule of schedules) {
      for (const item of schedule.schedule) {
        if (item.task_id) {
          if (!taskAssignments[item.task_id]) {
            taskAssignments[item.task_id] = [];
          }
          
          const existingUser = taskAssignments[item.task_id].find(u => u.userId === schedule.employee.id);
          if (existingUser) {
            existingUser.scheduleItems.push({
              id: item.id,
              startTime: item.start_time,
              endTime: item.end_time
            });
          } else {
            // Calculate total open task hours for this user
            const totalOpenTaskMinutes = schedule.tasks.reduce((sum: number, task: any) => sum + (task.duration || 60), 0);
            const totalOpenTaskHours = totalOpenTaskMinutes / 60;

            taskAssignments[item.task_id].push({
              userId: schedule.employee.id,
              userName: schedule.employee.name,
              totalOpenTaskHours: totalOpenTaskHours,
              scheduleItems: [{
                id: item.id,
                startTime: item.start_time,
                endTime: item.end_time
              }]
            });
          }
        }
      }
    }
    
    // Find conflicts (tasks assigned to multiple users)
    const conflicts: any[] = [];
    for (const [taskId, assignments] of Object.entries(taskAssignments)) {
      if (assignments.length > 1) {
        // Get task details from the first assignment
        const firstItem = assignments[0].scheduleItems[0];
        const scheduleItem = schedules
          .flatMap(s => s.schedule)
          .find(item => item.id === firstItem.id);
        
        if (scheduleItem && scheduleItem.task) {
          conflicts.push({
            taskId,
            taskTitle: scheduleItem.task.title,
            taskDescription: scheduleItem.task.description,
            projectName: scheduleItem.task.phases?.projects?.name || 'Unknown Project',
            priority: scheduleItem.task.priority || 'Medium',
            duration: scheduleItem.task.duration || 60,
            assignedUsers: assignments
          });
        }
      }
    }

    console.log('Detected conflicts:', conflicts);
    return conflicts;
  };

  const resolveTaskConflicts = async (resolutions: Record<string, string[]>) => {
    try {
      console.log('Resolving conflicts with resolutions:', resolutions);
      
      // Track excluded tasks per user for this resolution cycle
      const newExcludedTasksPerUser: Record<string, string[]> = {};
      
      // For each resolution, handle the task assignments
      for (const [taskId, selectedUserIds] of Object.entries(resolutions)) {
        const conflict = taskConflicts.find(c => c.taskId === taskId);
        if (!conflict) continue;

        // Remove schedule items from non-selected users
        const usersToRemoveFrom = conflict.assignedUsers.filter(
          user => !selectedUserIds.includes(user.userId)
        );

        console.log(`Task ${taskId} - Selected users: ${selectedUserIds.join(', ')}`);
        console.log(`Task ${taskId} - Removing from users: ${usersToRemoveFrom.map(u => u.userName).join(', ')}`);

        for (const user of usersToRemoveFrom) {
          // Track this task as excluded for this user
          if (!newExcludedTasksPerUser[user.userId]) {
            newExcludedTasksPerUser[user.userId] = [];
          }
          newExcludedTasksPerUser[user.userId].push(taskId);

          // Remove schedule items for this user
          for (const scheduleItem of user.scheduleItems) {
            console.log(`Deleting schedule item ${scheduleItem.id} for user ${user.userName}`);
            await supabase
              .from('schedules')
              .delete()
              .eq('id', scheduleItem.id);
          }
        }
      }

      // Update the excluded tasks state
      setExcludedTasksPerUser(prev => {
        const updated = { ...prev };
        for (const [userId, taskIds] of Object.entries(newExcludedTasksPerUser)) {
          updated[userId] = [...(updated[userId] || []), ...taskIds];
        }
        return updated;
      });

      // Regenerate schedules for users who had tasks removed, excluding the conflicted tasks
      const usersToRegenerate = new Set<string>();
      for (const [taskId, selectedUserIds] of Object.entries(resolutions)) {
        const conflict = taskConflicts.find(c => c.taskId === taskId);
        if (!conflict) continue;

        const usersToRemoveFrom = conflict.assignedUsers.filter(
          user => !selectedUserIds.includes(user.userId)
        );

        for (const user of usersToRemoveFrom) {
          usersToRegenerate.add(user.userId);
        }
      }

      console.log(`Regenerating schedules for users: ${Array.from(usersToRegenerate).join(', ')}`);

      // Regenerate schedules with excluded tasks
      for (const userId of usersToRegenerate) {
        const userExcludedTasks = newExcludedTasksPerUser[userId] || [];
        const allExcludedForUser = [...(excludedTasksPerUser[userId] || []), ...userExcludedTasks];
        
        console.log(`Regenerating schedule for user ${userId} excluding tasks: ${allExcludedForUser.join(', ')}`);
        await generateDailySchedule(userId, allExcludedForUser);
      }

      // Refresh the data to show updated schedules
      await fetchAllData();
      
      // Check for new conflicts after regeneration
      const updatedSchedules = workerSchedules;
      const newConflicts = detectTaskConflicts(updatedSchedules);
      
      if (newConflicts.length > 0) {
        console.log('New conflicts detected after resolution, showing resolver again');
        setTaskConflicts(newConflicts);
        setShowConflictResolver(true);
      } else {
        // Clear excluded tasks when all conflicts are resolved
        setExcludedTasksPerUser({});
        toast({
          title: "Conflicts Resolved",
          description: "Task assignment conflicts have been resolved successfully.",
        });
      }
    } catch (error: any) {
      console.error('Error resolving conflicts:', error);
      toast({
        title: "Error",
        description: `Failed to resolve conflicts: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const generateDailySchedule = async (workerId: string, excludedTaskIds: string[] = []) => {
    try {
      setGeneratingSchedule(true);
      saveScrollPosition(); // Save scroll position before schedule generation
      
      const worker = workerSchedules.find(w => w.employee.id === workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      console.log(`Generating schedule for ${worker.employee.name}`);
      console.log(`Excluded task IDs: ${excludedTaskIds.join(', ')}`);

      // Check if the selected date is a production holiday
      if (isProductionHoliday(selectedDate)) {
        toast({
          title: "Holiday - No Scheduling",
          description: `Cannot schedule work on ${format(selectedDate, 'PPP')} as it's a production team holiday.`,
          variant: "destructive"
        });
        return;
      }

      // CRITICAL: Check if employee is on holiday for this date FIRST
      const isOnHoliday = await planningService.isEmployeeOnHoliday(workerId, selectedDate);
      if (isOnHoliday) {
        toast({
          title: "Employee on Approved Holiday",
          description: `${worker.employee.name} has an approved holiday request and cannot be scheduled.`,
          variant: "destructive"
        });
        return;
      }

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

      // Filter out excluded tasks
      const availableTasks = worker.tasks.filter(task => !excludedTaskIds.includes(task.id));

      console.log(`TODO tasks ready for scheduling: ${availableTasks.length}`);

      if (availableTasks.length === 0) {
        toast({
          title: "No TODO Tasks Available",
          description: `No TODO tasks available for ${worker.employee.name} after excluding conflicted tasks.`,
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

  const generateTomorrowSchedule = async () => {
    try {
      setGeneratingSchedule(true);
      saveScrollPosition();
      
      const today = startOfDay(new Date());
      const nextWorkingDay = getNextWorkingDay(today);
      
      console.log('Generating schedule for next working day based on today\'s progress...');
      
      // Get today's schedules to understand what's planned
      const { data: todaySchedules, error: todayError } = await supabase
        .from('schedules')
        .select(`
          *,
          task:tasks(*)
        `)
        .gte('start_time', format(today, 'yyyy-MM-dd') + 'T00:00:00')
        .lte('start_time', format(today, 'yyyy-MM-dd') + 'T23:59:59');

      if (todayError) throw todayError;

      console.log(`Found ${todaySchedules?.length || 0} schedules for today`);

      // Calculate remaining durations for tasks that are partially completed
      const taskRemainingDurations: Record<string, number> = {};
      
      if (todaySchedules) {
        for (const schedule of todaySchedules) {
          if (schedule.task_id && schedule.task) {
            const scheduledDuration = Math.round(
              (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / (1000 * 60)
            );
            const originalTaskDuration = schedule.task.duration || 60;
            
            if (!taskRemainingDurations[schedule.task_id]) {
              taskRemainingDurations[schedule.task_id] = originalTaskDuration;
            }
            
            // Subtract the time already scheduled for this task
            taskRemainingDurations[schedule.task_id] -= scheduledDuration;
            
            // Ensure we don't go negative
            if (taskRemainingDurations[schedule.task_id] < 0) {
              taskRemainingDurations[schedule.task_id] = 0;
            }
          }
        }
      }

      console.log('Task remaining durations:', taskRemainingDurations);

      // Clear existing schedules for next working day
      const nextWorkingDayStr = format(nextWorkingDay, 'yyyy-MM-dd');
      await supabase
        .from('schedules')
        .delete()
        .gte('start_time', `${nextWorkingDayStr}T00:00:00`)
        .lte('start_time', `${nextWorkingDayStr}T23:59:59`)
        .eq('is_auto_generated', true);

      let skippedOnHoliday = 0;
      let successfullyGenerated = 0;

      // Generate schedules for each worker
      for (const workerSchedule of workerSchedules) {
        // Check if employee is on holiday for next working day
        const isOnHoliday = await planningService.isEmployeeOnHoliday(workerSchedule.employee.id, nextWorkingDay);
        if (isOnHoliday) {
          console.log(`Skipping schedule generation for ${workerSchedule.employee.name} - on approved holiday on next working day`);
          skippedOnHoliday++;
          continue;
        }

        if (workerSchedule.assignedWorkstations.length === 0) {
          console.log(`Skipping ${workerSchedule.employee.name} - no workstations assigned`);
          continue;
        }

        // Get tasks that still have remaining duration or new TODO tasks
        const availableTasks = [];
        
        // First, add tasks with remaining duration from today
        for (const [taskId, remainingDuration] of Object.entries(taskRemainingDurations)) {
          if (remainingDuration > 0) {
            const task = workerSchedule.tasks.find(t => t.id === taskId);
            if (task) {
              // Create a modified task with the remaining duration
              availableTasks.push({
                ...task,
                duration: remainingDuration,
                title: `${task.title} (Continued)`,
                isContinuation: true
              });
            }
          }
        }
        
        // Then add new TODO tasks that weren't scheduled today
        const scheduledTaskIds = new Set(todaySchedules?.filter(s => s.task_id).map(s => s.task_id) || []);
        const newTasks = workerSchedule.tasks.filter(task => !scheduledTaskIds.has(task.id));
        availableTasks.push(...newTasks);

        console.log(`${workerSchedule.employee.name} has ${availableTasks.length} tasks available for next working day`);

        if (availableTasks.length === 0) {
          console.log(`No tasks available for ${workerSchedule.employee.name} on next working day`);
          continue;
        }

        // Sort tasks by priority (continuations first, then by priority and due date)
        availableTasks.sort((a, b) => {
          if (a.isContinuation && !b.isContinuation) return -1;
          if (!a.isContinuation && b.isContinuation) return 1;
          
          const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
          const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
          
          if (priorityA !== priorityB) return priorityA - priorityB;
          
          const dateA = new Date(a.due_date);
          const dateB = new Date(b.due_date);
          return dateA.getTime() - dateB.getTime();
        });

        // Create schedules for next working day
        const schedulesToInsert = [];
        let currentTaskIndex = 0;
        let remainingTaskDuration = availableTasks[currentTaskIndex]?.duration || 60;
        let currentTask = availableTasks[currentTaskIndex];
        let taskPartCounter = 1;

        for (const period of workingHours) {
          if (!currentTask) break;

          const periodStartTime = new Date(`${nextWorkingDayStr}T${period.start}:00`);
          let periodRemainingMinutes = period.duration;
          let periodCurrentTime = new Date(periodStartTime);

          while (periodRemainingMinutes > 0 && currentTask) {
            const timeToAllocate = Math.min(remainingTaskDuration, periodRemainingMinutes);
            const endTime = new Date(periodCurrentTime.getTime() + (timeToAllocate * 60000));

            let taskTitle = currentTask.title;
            if (currentTask.isContinuation) {
              taskTitle = currentTask.title; // Already includes "(Continued)"
            } else {
              const totalParts = Math.ceil((availableTasks[currentTaskIndex]?.duration || 60) / period.duration);
              if (totalParts > 1) {
                taskTitle = `${currentTask.title} (Part ${taskPartCounter})`;
              }
            }

            schedulesToInsert.push({
              employee_id: workerSchedule.employee.id,
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

        console.log(`Schedules to insert for ${workerSchedule.employee.name}: ${schedulesToInsert.length}`);

        // Insert schedules
        if (schedulesToInsert.length > 0) {
          const { error } = await supabase
            .from('schedules')
            .insert(schedulesToInsert);

          if (error) throw error;
          successfullyGenerated++;
        }
      }

      await fetchAllData();
      
      let message = `Generated schedule for the next working day (${format(nextWorkingDay, 'PPP')}) for ${successfullyGenerated} workers, building on today's progress`;
      if (skippedOnHoliday > 0) {
        message += ` (${skippedOnHoliday} workers skipped due to approved holidays)`;
      }
      
      toast({
        title: "Next Working Day Schedule Generated",
        description: message,
      });
    } catch (error: any) {
      console.error('Error generating next working day schedule:', error);
      toast({
        title: "Error",
        description: `Failed to generate next working day schedule: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const generateAllSchedules = async () => {
    try {
      setGeneratingSchedule(true);
      saveScrollPosition();
      
      // Check if the selected date is a production holiday
      if (isProductionHoliday(selectedDate)) {
        toast({
          title: "Holiday - No Scheduling",
          description: `Cannot schedule work on ${format(selectedDate, 'PPP')} as it's a production team holiday.`,
          variant: "destructive"
        });
        return;
      }
      
      console.log('🚀 Starting Advanced Schedule Generation Algorithm...');
      
      // Clear previous state
      setExcludedTasksPerUser({});
      let skippedOnHoliday = 0;
      let successfullyGenerated = 0;
      
      // PHASE 1: Data Collection & Analysis
      console.log('📊 Phase 1: Collecting and analyzing data...');
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get all available tasks for the date
      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(
            id,
            project_id,
            projects!inner(
              id,
              name
            )
          ),
          task_workstation_links(
            workstation:workstations(id, name)
          )
        `)
        .eq('status', 'TODO')
        .lte('due_date', dateStr);
      
      if (tasksError) throw tasksError;
      
      // Get task history to determine who has worked on tasks before
      const { data: taskHistory, error: historyError } = await supabase
        .from('schedules')
        .select('task_id, employee_id, start_time')
        .not('task_id', 'is', null)
        .order('start_time', { ascending: true });
      
      if (historyError) throw historyError;
      
      // Get employee-standard task assignments (PRIMARY eligibility source)
      const { data: employeeStandardTaskLinks, error: empStdTaskError } = await supabase
        .from('employee_standard_task_links')
        .select(`
          employee_id,
          standard_task_id
        `);
      
      if (empStdTaskError) throw empStdTaskError;
      
      // Get employee-workstation assignments (for workstation placement only)
      const { data: employeeWorkstations, error: empWsError } = await supabase
        .from('employee_workstation_links')
        .select(`
          employee_id,
          workstation:workstations(id, name)
        `);
      
      if (empWsError) throw empWsError;
      
      // Get standard task assignments
      const { data: standardTaskLinks, error: stdTaskError } = await supabase
        .from('standard_task_workstation_links')
        .select(`
          standard_task_id,
          workstation:workstations(id, name)
        `);
      
      if (stdTaskError) throw stdTaskError;
      
      // PHASE 2: Task Ownership & Continuity Analysis
      console.log('🔍 Phase 2: Analyzing task ownership and continuity...');
      
      // Build task ownership map (who started each task)
      const taskOwnershipMap = new Map<string, string>();
      const taskWorkHistoryMap = new Map<string, Set<string>>();
      
      for (const history of taskHistory || []) {
        if (history.task_id && history.employee_id) {
          // Record who started the task (first occurrence)
          if (!taskOwnershipMap.has(history.task_id)) {
            taskOwnershipMap.set(history.task_id, history.employee_id);
          }
          
          // Track all employees who have worked on this task
          if (!taskWorkHistoryMap.has(history.task_id)) {
            taskWorkHistoryMap.set(history.task_id, new Set());
          }
          taskWorkHistoryMap.get(history.task_id)!.add(history.employee_id);
        }
      }
      
      // Build employee standard task competency map (PRIMARY eligibility check)
      const employeeStandardTaskMap = new Map<string, Set<string>>();
      for (const empStdTask of employeeStandardTaskLinks || []) {
        if (!employeeStandardTaskMap.has(empStdTask.employee_id)) {
          employeeStandardTaskMap.set(empStdTask.employee_id, new Set());
        }
        employeeStandardTaskMap.get(empStdTask.employee_id)!.add(empStdTask.standard_task_id);
      }
      
      // Build employee workstation map (for workstation placement only)
      const employeeWorkstationMap = new Map<string, Set<string>>();
      for (const empWs of employeeWorkstations || []) {
        if (!employeeWorkstationMap.has(empWs.employee_id)) {
          employeeWorkstationMap.set(empWs.employee_id, new Set());
        }
        employeeWorkstationMap.get(empWs.employee_id)!.add(empWs.workstation?.id || '');
      }
      
      // Build task-workstation requirement map
      const taskWorkstationMap = new Map<string, Set<string>>();
      for (const task of allTasks || []) {
        const workstationIds = new Set<string>();
        for (const link of task.task_workstation_links || []) {
          if (link.workstation?.id) {
            workstationIds.add(link.workstation.id);
          }
        }
        taskWorkstationMap.set(task.id, workstationIds);
      }
      
      // PHASE 3: Intelligent Task Assignment Algorithm
      console.log('🧠 Phase 3: Running intelligent task assignment algorithm...');
      
      // Create assignment state
      const taskAssignments = new Map<string, string>(); // taskId -> employeeId
      const employeeTaskQueue = new Map<string, any[]>(); // employeeId -> task[]
      const conflictedTasks = new Set<string>();
      
      // Priority scoring function
      const getTaskPriorityScore = (task: any): number => {
        const priorityScores = { 'Urgent': 100, 'High': 75, 'Medium': 50, 'Low': 25 };
        const baseScore = priorityScores[task.priority as keyof typeof priorityScores] || 25;
        
        // Boost score for overdue tasks
        const dueDate = new Date(task.due_date);
        const daysDiff = Math.floor((dueDate.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
        const overdueBoost = daysDiff < 0 ? Math.abs(daysDiff) * 10 : 0;
        
        return baseScore + overdueBoost;
      };
      
      // Sort tasks by priority and other factors
      const sortedTasks = (allTasks || []).sort((a, b) => {
        // 1. Tasks with ownership (continuation) get highest priority
        const aHasOwner = taskOwnershipMap.has(a.id);
        const bHasOwner = taskOwnershipMap.has(b.id);
        if (aHasOwner && !bHasOwner) return -1;
        if (!aHasOwner && bHasOwner) return 1;
        
        // 2. Priority score
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        // 3. Due date
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA.getTime() - dateB.getTime();
      });
      
      console.log(`Processing ${sortedTasks.length} tasks for assignment...`);
      
      // PHASE 4: Task Assignment Logic
      console.log('⚡ Phase 4: Executing task assignment logic...');
      
      for (const task of sortedTasks) {
        // CRITICAL: Check if task already assigned (prevent duplicates)
        if (taskAssignments.has(task.id)) {
          console.log(`⚠️ Task ${task.title} already assigned, skipping duplicate`);
          continue;
        }
        
        let assignedEmployee: string | null = null;
        const taskWorkstations = taskWorkstationMap.get(task.id) || new Set();
        
        // RULE 1: Continuation - If task has been started, only the original employee can continue
        if (taskOwnershipMap.has(task.id)) {
          const originalEmployee = taskOwnershipMap.get(task.id)!;
          
          // PRIMARY CHECK: Employee must be linked to this standard task
          const employeeStandardTasks = employeeStandardTaskMap.get(originalEmployee) || new Set();
          const canDoStandardTask = task.standard_task_id && employeeStandardTasks.has(task.standard_task_id);
          
          if (canDoStandardTask) {
            // Check if employee is not on holiday
            const isOnHoliday = await planningService.isEmployeeOnHoliday(originalEmployee, selectedDate);
            if (!isOnHoliday) {
              assignedEmployee = originalEmployee;
              console.log(`✅ Task ${task.title} (standard_task: ${task.standard_task_id}) assigned to original owner ${originalEmployee} (continuation)`);
            } else {
              console.log(`❌ Original owner ${originalEmployee} on holiday, task ${task.title} cannot be continued`);
              conflictedTasks.add(task.id);
              continue;
            }
          } else {
            console.log(`❌ Original owner ${originalEmployee} not linked to standard task ${task.standard_task_id} for task ${task.title}`);
            conflictedTasks.add(task.id);
            continue;
          }
        }
        
        // RULE 2: New task assignment - Find best available employee
        if (!assignedEmployee) {
          // Skip tasks without standard_task_id
          if (!task.standard_task_id) {
            console.log(`⚠️ Task ${task.title} has no standard_task_id, cannot assign`);
            conflictedTasks.add(task.id);
            continue;
          }
          
          const candidateEmployees: Array<{employeeId: string, score: number}> = [];
          
          for (const workerSchedule of workerSchedules) {
            const employeeId = workerSchedule.employee.id;
            
            // Skip if employee is on holiday
            const isOnHoliday = await planningService.isEmployeeOnHoliday(employeeId, selectedDate);
            if (isOnHoliday) continue;
            
            // PRIMARY CHECK: Employee must be linked to this standard task
            const employeeStandardTasks = employeeStandardTaskMap.get(employeeId) || new Set();
            const canDoStandardTask = employeeStandardTasks.has(task.standard_task_id);
            
            if (!canDoStandardTask) continue;
            
            // Calculate assignment score
            let score = 0;
            
            // Experience bonus (if employee worked on this task before)
            if (taskWorkHistoryMap.has(task.id) && taskWorkHistoryMap.get(task.id)!.has(employeeId)) {
              score += 50;
            }
            
            // Workload balancing (fewer assigned tasks = higher score)
            const currentTaskCount = employeeTaskQueue.get(employeeId)?.length || 0;
            score += Math.max(0, 100 - (currentTaskCount * 10));
            
            // Workstation efficiency bonus (if employee also has matching workstation)
            const employeeWorkstations = employeeWorkstationMap.get(employeeId) || new Set();
            if (taskWorkstations.size > 0) {
              const matchingWorkstations = Array.from(taskWorkstations).filter(wsId => 
                employeeWorkstations.has(wsId)
              );
              score += matchingWorkstations.length * 25;
            }
            
            candidateEmployees.push({ employeeId, score });
          }
          
          // Select best candidate
          if (candidateEmployees.length > 0) {
            candidateEmployees.sort((a, b) => b.score - a.score);
            assignedEmployee = candidateEmployees[0].employeeId;
            console.log(`✅ Task ${task.title} (standard_task: ${task.standard_task_id}) assigned to ${assignedEmployee} (score: ${candidateEmployees[0].score})`);
          } else {
            console.log(`❌ No employee linked to standard_task ${task.standard_task_id} for task ${task.title}`);
            conflictedTasks.add(task.id);
            continue;
          }
        }
        
        // CRITICAL: Final duplicate check before recording
        if (taskAssignments.has(task.id)) {
          console.log(`🛑 DUPLICATE PREVENTION: Task ${task.title} already assigned to ${taskAssignments.get(task.id)}, skipping`);
          continue;
        }
        
        // Record assignment (ONE task to ONE employee)
        if (assignedEmployee) {
          taskAssignments.set(task.id, assignedEmployee);
          
          if (!employeeTaskQueue.has(assignedEmployee)) {
            employeeTaskQueue.set(assignedEmployee, []);
          }
          employeeTaskQueue.get(assignedEmployee)!.push(task);
          
          console.log(`📝 Recorded: Task ${task.id} -> Employee ${assignedEmployee}`);
        }
      }
      
      // PHASE 5: Generate Actual Schedules
      console.log('📅 Phase 5: Generating actual schedules...');
      console.log(`✅ Total unique tasks assigned: ${taskAssignments.size}`);
      console.log(`👥 Employees with assignments: ${employeeTaskQueue.size}`);
      
      // Clear existing schedules for the date
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .eq('is_auto_generated', true);
      
      if (deleteError) console.error('Error clearing existing schedules:', deleteError);
      
      // Define proper working hours: 7:00 - 16:00 with correct breaks
      const workingHours = [
        { start: '07:00', end: '10:00', duration: 180, name: 'Early Morning' },     // 3 hours
        { start: '10:15', end: '12:30', duration: 135, name: 'Late Morning' },      // 2h 15min (break 10:00-10:15)
        { start: '13:00', end: '16:00', duration: 180, name: 'Afternoon' }          // 3 hours continuous (lunch 12:30-13:00)
      ];
      
      // Generate schedules for each employee
      for (const [employeeId, tasks] of employeeTaskQueue.entries()) {
        if (tasks.length === 0) continue;
        
        const employee = workerSchedules.find(ws => ws.employee.id === employeeId)?.employee;
        if (!employee) continue;
        
        console.log(`📋 Creating schedule for ${employee.name} with ${tasks.length} tasks`);
        
        // Sort tasks by priority within employee queue
        tasks.sort((a, b) => {
          const scoreA = getTaskPriorityScore(a);
          const scoreB = getTaskPriorityScore(b);
          return scoreB - scoreA;
        });
        
        const schedulesToInsert = [];
        let currentTaskIndex = 0;
        let remainingTaskDuration = tasks[currentTaskIndex]?.duration || 60;
        let currentTask = tasks[currentTaskIndex];
        let taskPartCounter = 1;
        
        for (const period of workingHours) {
          if (!currentTask) break;
          
          const periodStartTime = new Date(`${dateStr}T${period.start}:00`);
          let periodRemainingMinutes = period.duration;
          let periodCurrentTime = new Date(periodStartTime);
          
          while (periodRemainingMinutes > 0 && currentTask) {
            const timeToAllocate = Math.min(remainingTaskDuration, periodRemainingMinutes);
            const endTime = new Date(periodCurrentTime.getTime() + (timeToAllocate * 60000));
            
            // Determine task title with continuation logic
            let taskTitle = currentTask.title;
            if (taskOwnershipMap.has(currentTask.id)) {
              taskTitle = `${currentTask.title} (Continued)`;
            } else {
              const totalParts = Math.ceil((currentTask.duration || 60) / period.duration);
              if (totalParts > 1) {
                taskTitle = `${currentTask.title} (Part ${taskPartCounter})`;
              }
            }
            
            schedulesToInsert.push({
              employee_id: employeeId,
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
            
            // Move to next task if current is completed
            if (remainingTaskDuration <= 0) {
              currentTaskIndex++;
              currentTask = tasks[currentTaskIndex];
              remainingTaskDuration = currentTask?.duration || 60;
              taskPartCounter = 1;
            } else {
              taskPartCounter++;
            }
          }
        }
        
        // Insert schedules for this employee
        if (schedulesToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('schedules')
            .insert(schedulesToInsert);
          
          if (insertError) {
            console.error(`Error inserting schedules for ${employee.name}:`, insertError);
          } else {
            successfullyGenerated++;
            console.log(`✅ Created ${schedulesToInsert.length} schedule items for ${employee.name}`);
          }
        }
      }
      
      // PHASE 6: Generate Workstation Schedules
      console.log('🏭 Phase 6: Generating workstation schedules...');
      await fetchAllData();
      await generateWorkstationSchedulesFromWorkerSchedules();
      
      // PHASE 7: Summary and Reporting
      console.log('📊 Phase 7: Generating summary report...');
      
      const totalAssignedTasks = Array.from(employeeTaskQueue.values()).reduce((sum, tasks) => sum + tasks.length, 0);
      const unassignedTasks = conflictedTasks.size;
      
      let message = `Advanced algorithm completed: ${successfullyGenerated} workers scheduled with ${totalAssignedTasks} tasks assigned`;
      if (unassignedTasks > 0) {
        message += ` (${unassignedTasks} tasks couldn't be assigned due to constraints)`;
      }
      if (skippedOnHoliday > 0) {
        message += ` (${skippedOnHoliday} workers on holiday)`;
      }
      
      console.log(`🎯 Algorithm Results:
        - Assignment Method: employee_standard_task_links (strict enforcement)
        - Unique tasks assigned: ${taskAssignments.size}
        - Total task slots created: ${totalAssignedTasks}
        - Employees scheduled: ${successfullyGenerated}
        - Unassigned tasks: ${unassignedTasks}
        - Continued tasks: ${Array.from(taskOwnershipMap.keys()).length}
        - New task assignments: ${taskAssignments.size - Array.from(taskOwnershipMap.keys()).length}
        - Duplicate assignments prevented: ${sortedTasks.length - taskAssignments.size - unassignedTasks}`);
      
      // Verify no duplicate assignments
      const uniqueAssignedTasks = new Set(taskAssignments.keys());
      if (uniqueAssignedTasks.size !== taskAssignments.size) {
        console.error('🚨 CRITICAL: Duplicate task assignments detected!');
      } else {
        console.log('✅ VERIFIED: All task assignments are unique (one task = one employee)');
      }
      
      toast({
        title: "Advanced Schedule Generation Complete",
        description: message,
      });
      
    } catch (error: any) {
      console.error('Error in advanced schedule generation:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedules: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const generateSchedulesFromGantt = async () => {
    try {
      setGeneratingSchedule(true);
      saveScrollPosition();
      
      console.log('🎯 Generating schedules from gantt_schedules DB for the following 7 days...');
      
      const startDate = startOfDay(selectedDate);
      const endDate = addDays(startDate, 7);
      
      // Step 1: Read all gantt_schedules from DB for the 7-day window
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
      const { data: ganttSchedules, error: ganttError } = await supabase
        .from('gantt_schedules')
        .select(`
          *,
          tasks (id, title, description, duration, status, priority, phase_id),
          employees (id, name),
          workstations (id, name)
        `)
        .gte('scheduled_date', startStr)
        .lt('scheduled_date', endStr)
        .order('scheduled_date')
        .order('start_time');
      
      if (ganttError) throw ganttError;
      
      console.log(`Found ${ganttSchedules?.length || 0} gantt schedule entries for 7 days`);
      
      if (!ganttSchedules || ganttSchedules.length === 0) {
        toast({
          title: "No schedules found",
          description: "No Gantt chart schedules found for the next 7 days. Please run the optimizer first.",
          variant: "default"
        });
        return;
      }
      
      // Step 2: Clear ALL existing schedules in the schedules table
      const { error: clearSchedulesError } = await supabase
        .from('schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (clearSchedulesError) {
        console.error('Error clearing schedules:', clearSchedulesError);
        throw clearSchedulesError;
      }
      
      // Also clear workstation_schedules for the period
      await supabase
        .from('workstation_schedules')
        .delete()
        .gte('start_time', startDate.toISOString())
        .lt('start_time', endDate.toISOString());
      
      // Step 3: Build schedule inserts from gantt_schedules
      const scheduleInserts: any[] = [];
      const workstationScheduleInserts: any[] = [];
      
      for (const gs of ganttSchedules) {
        if (!gs.employee_id || !gs.tasks) continue;
        
        const employeeName = gs.employees?.name || 'Unknown';
        
        scheduleInserts.push({
          employee_id: gs.employee_id,
          task_id: gs.task_id,
          title: gs.tasks.title || 'Unknown Task',
          description: gs.tasks.description || '',
          start_time: gs.start_time,
          end_time: gs.end_time,
          is_auto_generated: true,
        });
        
        if (gs.workstation_id) {
          workstationScheduleInserts.push({
            workstation_id: gs.workstation_id,
            task_id: gs.task_id,
            task_title: gs.tasks.title || 'Unknown Task',
            user_name: employeeName,
            start_time: gs.start_time,
            end_time: gs.end_time,
          });
        }
      }
      
      console.log(`Total schedule inserts: ${scheduleInserts.length}`);
      console.log(`Total workstation schedule inserts: ${workstationScheduleInserts.length}`);
      
      // Step 4: Insert in batches
      const batchSize = 100;
      for (let i = 0; i < scheduleInserts.length; i += batchSize) {
        const batch = scheduleInserts.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('schedules')
          .insert(batch);
        
        if (insertError) {
          console.error('Error inserting schedule batch:', insertError);
          throw insertError;
        }
      }
      
      for (let i = 0; i < workstationScheduleInserts.length; i += batchSize) {
        const batch = workstationScheduleInserts.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('workstation_schedules')
          .insert(batch);
        
        if (insertError) {
          console.error('Error inserting workstation schedule batch:', insertError);
          throw insertError;
        }
      }
      
      await fetchAllData();
      
      toast({
        title: "Schedules Generated from Gantt Chart",
        description: `Successfully created ${scheduleInserts.length} worker schedules and ${workstationScheduleInserts.length} workstation schedules for the next 7 days.`,
      });
      
    } catch (error: any) {
      console.error('Error generating schedules from Gantt:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedules from Gantt chart: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const handleSchedulingMethodChoice = (method: 'algorithm' | 'gantt') => {
    setShowSchedulingMethodDialog(false);
    if (method === 'algorithm') {
      generateAllSchedules();
    } else {
      generateSchedulesFromGantt();
    }
  };

  const generateWorkstationSchedulesFromWorkerSchedules = async () => {
    if (!selectedDate) return;

    try {
      console.log('Generating workstation schedules from worker schedules...');

      // Get all worker schedules for the selected date with their task-workstation links
      const { data: workerSchedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          *,
          employee:employees(id, name, role, workstation),
          task:tasks(
            id,
            title,
            description,
            priority,
            task_workstation_links(
              workstation:workstations(
                id,
                name
              )
            )
          )
        `)
        .gte('start_time', format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00')
        .lte('start_time', format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59')
        .not('task_id', 'is', null); // Only get schedules that have actual tasks

      if (schedulesError) throw schedulesError;

      console.log('Worker schedules found:', workerSchedulesData?.length || 0);

      // Delete existing workstation schedules for the selected date
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { error: deleteError } = await supabase
        .from('workstation_schedules')
        .delete()
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`);

      if (deleteError) {
        console.error('Error deleting existing workstation schedules:', deleteError);
      }

      const workstationSchedulesToCreate = [];

      // Process each worker schedule and create corresponding workstation schedules
      for (const schedule of workerSchedulesData || []) {
        const taskWorkstationLinks = schedule.task?.task_workstation_links || [];
        const userName = schedule.employee?.name || 'Unknown User';
        const startTime = new Date(schedule.start_time);
        const endTime = new Date(schedule.end_time);
        
        console.log(`Processing schedule for ${userName}: ${schedule.title}`);
        console.log(`Task workstation links:`, taskWorkstationLinks);
        
        // Only create workstation schedules for tasks that have workstation links
        if (taskWorkstationLinks && taskWorkstationLinks.length > 0) {
          // Create a workstation schedule for each linked workstation
          for (const link of taskWorkstationLinks) {
            const workstation = link.workstation;
            if (workstation) {
              console.log(`Creating workstation schedule for workstation: ${workstation.name}`);
              
              workstationSchedulesToCreate.push({
                workstation_id: workstation.id,
                task_id: schedule.task_id,
                task_title: schedule.title,
                user_name: userName,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
              });
            }
          }
        } else {
          console.log(`No workstation links found for task: ${schedule.title}`);
        }
      }

      console.log(`Creating ${workstationSchedulesToCreate.length} workstation schedules`);

      // Insert workstation schedules
      if (workstationSchedulesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('workstation_schedules')
          .insert(workstationSchedulesToCreate);

        if (insertError) {
          console.error('Error creating workstation schedules:', insertError);
          throw insertError;
        }
      }

      console.log(`Successfully created ${workstationSchedulesToCreate.length} workstation schedule assignments`);

    } catch (error: any) {
      console.error('Error generating workstation schedules from worker schedules:', error);
      throw error;
    }
  };

  const generateWorkstationSchedules = async () => {
    if (!selectedDate) return;

    try {
      setGeneratingSchedule(true);
      await generateWorkstationSchedulesFromWorkerSchedules();
      
      toast({
        title: "Workstation Schedules Generated",
        description: "Generated workstation schedules based on current worker schedules",
      });

    } catch (error: any) {
      console.error('Error generating workstation schedules:', error);
      toast({
        title: "Error",
        description: `Failed to generate workstation schedules: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const deleteScheduleItem = async (scheduleId: string) => {
    try {
      saveScrollPosition(); // Save scroll position before deletion
      
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
      saveScrollPosition(); // Save scroll position before completion
      
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

  const formatTime = (timeStr: string | Date) => {
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

  const isOverlapping = (startTime: Date, endTime: Date, schedule: ScheduleItem[], ignoreItemId?: string): { overlap: boolean; reason?: string; details?: string; conflictingItem?: any; outOfBounds?: 'start' | 'end' } => {
    const start = startTime.getTime();
    const end = endTime.getTime();

    // Check timeline boundaries
    const dayStart = new Date(startTime);
    dayStart.setHours(TIMELINE_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(TIMELINE_END_HOUR, 0, 0, 0);

    if (start < dayStart.getTime()) {
      return { overlap: true, reason: "Out of working hours", details: "Task must be within the timeline.", outOfBounds: 'start' };
    }
    if (end > dayEnd.getTime()) {
      return { overlap: true, reason: "Out of working hours", details: "Task must be within the timeline.", outOfBounds: 'end' };
    }

    // Check for overlap with other tasks
    for (const item of schedule) {
      if (item.id === ignoreItemId) continue;
      const itemStart = new Date(item.start_time).getTime();
      const itemEnd = new Date(item.end_time).getTime();
      if (start < itemEnd && end > itemStart) {
        return { overlap: true, reason: "Task Overlap", details: `Overlaps with: ${item.title}`, conflictingItem: item };
      }
    }

    // Check for overlap with breaks
    const getBreaks = () => {
      const breaks = [];
      for (let i = 0; i < workingHours.length - 1; i++) {
        breaks.push({
          start: workingHours[i].end,
          end: workingHours[i + 1].start,
          title: 'Break',
        });
      }
      return breaks;
    };
    const breaks = getBreaks();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    for (const breakPeriod of breaks) {
      const breakStart = new Date(`${dateStr}T${breakPeriod.start}:00`);
      const breakEnd = new Date(`${dateStr}T${breakPeriod.end}:00`);
      if (start < breakEnd.getTime() && end > breakStart.getTime()) {
        return { overlap: true, reason: "Break Overlap", details: "Cannot schedule tasks during breaks.", conflictingItem: { start_time: breakStart.toISOString(), end_time: breakEnd.toISOString(), title: 'Break' } };
      }
    }

    return { overlap: false };
  };

  const handleMoveTask = async (itemId: string, deltaY: number) => {
    const workerSchedule = workerSchedules.find(w => w.employee.id === selectedWorker);
    const itemToMove = workerSchedule?.schedule.find(i => i.id === itemId);
    if (!workerSchedule || !itemToMove) return;

    const unroundedMinutes = deltaY / MINUTE_TO_PIXEL_SCALE;
    const minutesChange = Math.round(unroundedMinutes / 5) * 5;

    if (minutesChange === 0) return;

    let newStartTime = new Date(itemToMove.start_time);
    newStartTime.setMinutes(newStartTime.getMinutes() + minutesChange);

    let newEndTime = new Date(itemToMove.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + minutesChange);

    const itemDuration = new Date(itemToMove.end_time).getTime() - new Date(itemToMove.start_time).getTime();

    const { overlap, reason, details, conflictingItem, outOfBounds } = isOverlapping(newStartTime, newEndTime, workerSchedule.schedule, itemId);
    
    if (overlap) {
      if (outOfBounds) {
        const dayStart = new Date(newStartTime);
        dayStart.setHours(TIMELINE_START_HOUR, 0, 0, 0);
        const dayEnd = new Date(newStartTime);
        dayEnd.setHours(TIMELINE_END_HOUR, 0, 0, 0);

        if (outOfBounds === 'start') {
            newStartTime = dayStart;
        } else { // 'end'
            newStartTime = new Date(dayEnd.getTime() - itemDuration);
        }
        const roundedMinutes = Math.round(newStartTime.getMinutes() / 5) * 5;
        newStartTime.setMinutes(roundedMinutes, 0, 0);
        
        newEndTime = new Date(newStartTime.getTime() + itemDuration);
      } else if (conflictingItem) {
        const conflictingItemStart = new Date(conflictingItem.start_time);
        const conflictingItemEnd = new Date(conflictingItem.end_time);

        let adjustedStartTime;
        
        // Snap based on which half of the conflicting item is overlapped
        const conflictingItemCenter = conflictingItemStart.getTime() + (conflictingItemEnd.getTime() - conflictingItemStart.getTime()) / 2;
        
        if (newStartTime.getTime() < conflictingItemCenter) { // Snap before
          adjustedStartTime = new Date(conflictingItemStart.getTime() - itemDuration);
        } else { // Snap after
          adjustedStartTime = new Date(conflictingItemEnd.getTime());
        }
        
        const roundedMinutes = Math.round(adjustedStartTime.getMinutes() / 5) * 5;
        adjustedStartTime.setMinutes(roundedMinutes, 0, 0);

        const adjustedEndTime = new Date(adjustedStartTime.getTime() + itemDuration);
        
        const finalCheck = isOverlapping(adjustedStartTime, adjustedEndTime, workerSchedule.schedule, itemId);
        if (finalCheck.overlap) {
            toast({
                title: "Cannot place task",
                description: finalCheck.details ? `Blocked: ${finalCheck.details}` : "The adjusted position is also blocked.",
                variant: "destructive"
            });
            return; // Abort move
        }
        newStartTime = adjustedStartTime;
        newEndTime = adjustedEndTime;
      } else {
        toast({
          title: reason,
          description: details,
          variant: "destructive"
        });
        return;
      }
    }

    try {
      saveScrollPosition(); // Save scroll position before move
      
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
    if (!workerSchedule || !itemToResize) return;

    const unroundedMinutes = deltaY / MINUTE_TO_PIXEL_SCALE;
    const minutesChange = Math.round(unroundedMinutes / 5) * 5;

    if (minutesChange === 0) return;

    let newEndTime = new Date(itemToResize.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + minutesChange);

    const startTime = new Date(itemToResize.start_time);
    const newDuration = (newEndTime.getTime() - startTime.getTime()) / 60000;
    
    if (newDuration < 5) {
      toast({ title: "Invalid duration", description: "Task duration cannot be less than 5 minutes.", variant: "destructive" });
      return;
    }

    const { overlap, reason, details } = isOverlapping(startTime, newEndTime, workerSchedule.schedule, itemId);
    if (overlap) {
      toast({
        title: reason,
        description: details,
        variant: "destructive"
      });
      return;
    }

    try {
      saveScrollPosition(); // Save scroll position before resize
      
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
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`w-full p-6 flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex min-h-screen w-full">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0 left-0 z-10">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div 
          ref={mainContentRef}
          className={`w-full p-4 md:p-6 overflow-y-auto ${!isMobile ? 'md:ml-64' : 'pt-16'}`}
          style={{ height: '100vh' }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold">{t('planning_title')}</h1>
                <p className="text-slate-600 mt-1">
                  {t('planning_description')}
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
                      {selectedDate ? format(selectedDate, "PPP") : <span>{t('planning_pick_date')}</span>}
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
                  {t('planning_refresh')}
                </Button>
                
                {isAdmin && (
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setShowStandardTaskAssignment(true)}
                      variant="outline"
                      className="whitespace-nowrap"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {t('planning_add_standard_task')}
                    </Button>
                    <Button
                      onClick={() => setShowSchedulingMethodDialog(true)}
                      disabled={generatingSchedule || isSelectedDateHoliday()}
                      className="whitespace-nowrap"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      {generatingSchedule ? t('planning_generating') : t('planning_generate_all')}
                    </Button>
                    <Button
                      onClick={generateTomorrowSchedule}
                      disabled={generatingSchedule || !checkTodayHasSchedules() || !isNextWorkingDay()}
                      variant="secondary"
                      className="whitespace-nowrap"
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {generatingSchedule ? t('planning_generating') : t('planning_generate_next_day')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Show info message when selected date is a holiday */}
            {isSelectedDateHoliday() && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('planning_production_holiday')}</AlertTitle>
                <AlertDescription>
                  {t('planning_holiday_message').replace('{{date}}', format(selectedDate, 'PPP'))}
                </AlertDescription>
              </Alert>
            )}

            {/* Show info message when next working day button is disabled */}
            {isAdmin && isNextWorkingDay() && !checkTodayHasSchedules() && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('planning_schedule_today_first_title')}</AlertTitle>
                <AlertDescription>
                  {t('planning_schedule_today_first_desc')}
                </AlertDescription>
              </Alert>
            )}

            {/* View Toggle */}
            <div className="mb-6">
              <div className="flex space-x-2">
                <Button
                  onClick={() => setActiveView('worker')}
                  variant={activeView === 'worker' ? "default" : "outline"}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {t('planning_worker_schedules')}
                </Button>
                <Button
                  onClick={() => setActiveView('workstation')}
                  variant={activeView === 'workstation' ? "default" : "outline"}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {t('planning_workstation_schedules')}
                </Button>
                <Button
                  onClick={() => setActiveView('gantt')}
                  variant={activeView === 'gantt' ? "default" : "outline"}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {t('planning_gantt_chart')}
                </Button>
              </div>
            </div>

            {/* Production Completion Timeline - Show in Gantt view */}
            {activeView === 'gantt' && (
              <div className="mb-4">
                <ProductionCompletionTimeline 
                  projectCompletions={projectCompletions}
                  loading={timelineLoading}
                  lastProductionStepName={lastProductionStepName || undefined}
                />
              </div>
            )}

            {activeView === 'gantt' ? (
              <WorkstationGanttChart 
                ref={ganttChartRef} 
                selectedDate={selectedDate} 
                onDateChange={setSelectedDate}
                onPlanningGenerated={(completions, lastStepName, isGenerating) => {
                  setTimelineLoading(isGenerating);
                  if (!isGenerating) {
                    setProjectCompletions(completions);
                    setLastProductionStepName(lastStepName);
                  }
                }}
              />
            ) : activeView === 'workstation' ? (
              <WorkstationScheduleView selectedDate={selectedDate} />
            ) : (
              <>
                {workers.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('planning_no_workers_title')}</AlertTitle>
                    <AlertDescription>
                      {t('planning_no_workers_desc')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {/* Worker Selection */}
                    <div className="flex items-center justify-between">
                      <div className="w-64">
                        <Select value={selectedWorker || ''} onValueChange={setSelectedWorker}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('planning_select_worker')} />
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
                            disabled={generatingSchedule || isSelectedDateHoliday()}
                            variant="outline"
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            {t('planning_generate_schedule')}
                          </Button>
                          <Button
                            onClick={() => setShowTaskManager(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('planning_add_task')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Worker Overview */}
                    {selectedWorkerSchedule && (
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('planning_todo_tasks')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{selectedWorkerSchedule.tasks.length}</div>
                            <p className="text-xs text-muted-foreground">{t('planning_ready_to_schedule')}</p>
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
                            <CardTitle className="text-sm font-medium">{t('planning_total_duration')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{Math.round(selectedWorkerSchedule.totalDuration / 60)}h</div>
                            <p className="text-xs text-muted-foreground">{t('planning_of_todo_tasks')}</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('planning_working_hours')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{Math.round(totalWorkingMinutes / 60)}h</div>
                            <p className="text-xs text-muted-foreground">{t('planning_daily_capacity')}</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('planning_scheduled_items')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{selectedWorkerSchedule.schedule.length}</div>
                            <p className="text-xs text-muted-foreground">{t('planning_todays_schedule')}</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('planning_efficiency')}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{calculateScheduleEfficiency(selectedWorkerSchedule.schedule)}%</div>
                            <p className="text-xs text-muted-foreground">{t('planning_time_utilization')}</p>
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
                              {selectedWorkerSchedule.employee.name} - {t('planning_daily_schedule')}
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
                                        MINUTE_TO_PIXEL_SCALE={MINUTE_TO_PIXEL_SCALE}
                                        formatTime={formatTime}
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
                              <p>{t('planning_no_tasks_today')}</p>
                              {isAdmin && (
                                <Button variant="ghost" size="sm" onClick={() => setShowTaskManager(true)} className="mt-2">
                                  <Plus className="h-4 w-4 mr-2" />
                                  {t('planning_add_task')}
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
              </>
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
                saveScrollPosition(); // Save scroll position before task manager save
                fetchAllData();
                setShowTaskManager(false);
                setEditingScheduleItem(null);
              }}
            />

            <TaskConflictResolver
              isOpen={showConflictResolver}
              onClose={() => setShowConflictResolver(false)}
              conflicts={taskConflicts}
              onResolve={resolveTaskConflicts}
            />

            <StandardTaskAssignment
              isOpen={showStandardTaskAssignment}
              onClose={() => setShowStandardTaskAssignment(false)}
              selectedDate={selectedDate}
              workers={workers}
              onSave={() => {
                saveScrollPosition(); // Save scroll position before standard task save
                fetchAllData();
                setShowStandardTaskAssignment(false);
              }}
            />

            {/* Scheduling Method Dialog */}
            <AlertDialog open={showSchedulingMethodDialog} onOpenChange={setShowSchedulingMethodDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>{t('planning_choose_method')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('planning_choose_method_desc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('planning_algorithm_method')}</h4>
                    <p className="text-sm text-muted-foreground">{t('planning_algorithm_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('planning_gantt_method')}</h4>
                    <p className="text-sm text-muted-foreground">{t('planning_gantt_desc')}</p>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSchedulingMethodChoice('algorithm')}>
                    {t('planning_algorithm_method')}
                  </AlertDialogAction>
                  <AlertDialogAction onClick={() => handleSchedulingMethodChoice('gantt')}>
                    {t('planning_gantt_method')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planning;
