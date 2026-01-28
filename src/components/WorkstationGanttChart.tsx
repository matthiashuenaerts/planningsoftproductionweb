import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  subDays,
  getDay,
  isBefore,
  parseISO,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { ganttScheduleService, GanttScheduleInsert } from '@/services/ganttScheduleService';
import { capacityCheckService } from '@/services/capacityCheckService';
import { standardTasksService } from '@/services/standardTasksService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus, ChevronDown, ChevronRight, ChevronLeft, User, Wand2, Calendar, Save } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ProjectDeadlineWarningDialog } from './ProjectDeadlineWarningDialog';

interface ProjectDeadlineWarning {
  projectId: string;
  projectName: string;
  clientName: string;
  installationDate: Date;
  estimatedCompletionDate: Date;
  daysOverdue: number;
  canReschedule: boolean;
}

interface Project {
  id: string;
  name: string;
  start_date: string;
  installation_date: string;
  status: string;
  client: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  duration: number;
  status: string;
  due_date: string;
  phase_id: string;
  standard_task_id?: string;
  priority: string;
  phases?: {
    name: string;
    projects: Project;
  };
  workstations?: Array<{ id: string; name: string }>;
}

interface LimitPhase {
  id: string;
  standard_task_id: string;
  limit_standard_task_id: string;
}

interface WorkstationGanttChartProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
}

interface DailyEmployeeAssignment {
  date: string; // ISO date string
  workstationId: string;
  workerIndex: number;
  employeeId: string;
  employeeName: string;
}

export interface WorkstationGanttChartRef {
  getDailyAssignments: () => DailyEmployeeAssignment[];
  getSchedule: () => Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>;
  getTasks: () => Task[];
  getWorkstations: () => Workstation[];
}

const WorkstationGanttChart = forwardRef<WorkstationGanttChartRef, WorkstationGanttChartProps>(({ selectedDate, onDateChange }, ref) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [limitPhases, setLimitPhases] = useState<LimitPhase[]>([]);
  const [standardTasks, setStandardTasks] = useState<Array<{ id: string; task_name: string; task_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyAssignments, setDailyAssignments] = useState<DailyEmployeeAssignment[]>([]);
  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [employeeStandardTaskLinks, setEmployeeStandardTaskLinks] = useState<Map<string, Array<{ id: string; name: string; standardTasks: string[] }>>>(new Map());
  const [workstationEmployeeLinks, setWorkstationEmployeeLinks] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [generatingPlanning, setGeneratingPlanning] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const [deadlineWarnings, setDeadlineWarnings] = useState<ProjectDeadlineWarning[]>([]);
  const [showDeadlineWarning, setShowDeadlineWarning] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedulingProjectId, setReschedulingProjectId] = useState<string | null>(null);
  const [capacityIssue, setCapacityIssue] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<any>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 250;

  // Day-based scale - always show a single day with hour granularity
  const scale = useMemo(() => {
    // Day-based view: show 24 hours for the selected day
    const unitWidth = 60 * zoom; // 60 pixels per hour base
    return {
      unitInMinutes: 60,
      unitWidth,
      totalUnits: 24,
      format: (d: Date) => format(d, 'HH:mm')
    };
  }, [zoom]);

  // fetch all once
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ws, wh, hd] = await Promise.all([
        workstationService.getAll(),
        workingHoursService.getWorkingHours(),
        holidayService.getHolidays(),
      ]);
      setWorkstations(ws || []);
      setWorkingHours(wh || []);
      setHolidays(hd || []);
      
      // Fetch standard tasks
      const { data: standardTasksData, error: standardTasksError } = await supabase
        .from('standard_tasks')
        .select('id, task_name, task_number')
        .order('task_number');
      
      if (standardTasksError) {
        console.error('Error fetching standard tasks:', standardTasksError);
      } else {
        setStandardTasks(standardTasksData || []);
      }
      
      // Fetch workstation-employee links for UI
      const linksMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const workstation of ws || []) {
        const employees = await workstationService.getEmployeesForWorkstation(workstation.id);
        linksMap.set(workstation.id, employees);
      }
      setWorkstationEmployeeLinks(linksMap);
      
      // Fetch employee-standard_task links for planning
      const { data: employeeTaskLinks, error: linksError } = await supabase
        .from('employee_standard_task_links')
        .select('employee_id, standard_task_id, employees(id, name)');
      
      if (linksError) {
        console.error('Error fetching employee task links:', linksError);
      }
      
      // Group by employee
      const employeeTaskMap = new Map<string, Array<{ id: string; name: string; standardTasks: string[] }>>();
      (employeeTaskLinks || []).forEach((link: any) => {
        if (!link.employees) return;
        
        if (!employeeTaskMap.has(link.employee_id)) {
          employeeTaskMap.set(link.employee_id, [{
            id: link.employees.id,
            name: link.employees.name,
            standardTasks: [link.standard_task_id]
          }]);
        } else {
          const existing = employeeTaskMap.get(link.employee_id)![0];
          if (!existing.standardTasks.includes(link.standard_task_id)) {
            existing.standardTasks.push(link.standard_task_id);
          }
        }
      });
      
      setEmployeeStandardTaskLinks(employeeTaskMap);
      
      // Fetch ALL TODO and HOLD tasks using pagination (Supabase limits to 1000 per request)
      const BATCH_SIZE = 1000;
      let allTasks: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            id, title, description, duration, status, due_date, phase_id, standard_task_id, priority,
            phases ( 
              name, 
              projects ( id, name, start_date, installation_date, status, client ) 
            ),
            task_workstation_links ( workstations ( id, name ) )
          `)
          .in('status', ['TODO', 'HOLD'])
          .order('due_date')
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
          console.error('Error fetching tasks batch:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allTasks = [...allTasks, ...data];
          offset += BATCH_SIZE;
          hasMore = data.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Loaded ${allTasks.length} TODO/HOLD tasks from database`);
      
      const t = allTasks.map((d: any) => ({
        ...d,
        workstations: d.task_workstation_links?.map((x: any) => x.workstations).filter(Boolean) || [],
      }));
      setTasks(t);
      const { data: lp } = await supabase.from('standard_task_limit_phases').select('*');
      setLimitPhases(lp || []);
      setLoading(false);
    })();
  }, [selectedDate]);

  // Load saved schedules from database for the selected date
  const loadSavedSchedules = useCallback(async () => {
    try {
      const schedules = await ganttScheduleService.getSchedulesWithDetailsForDate(selectedDate);
      setSavedSchedules(schedules);
      
      if (schedules.length > 0) {
        // Build daily assignments from saved schedules
        const assignments: DailyEmployeeAssignment[] = [];
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        schedules.forEach((schedule: any) => {
          if (schedule.employee_id && schedule.employees) {
            assignments.push({
              date: dateStr,
              workstationId: schedule.workstation_id,
              workerIndex: schedule.worker_index,
              employeeId: schedule.employee_id,
              employeeName: schedule.employees.name,
            });
          }
        });
        
        // Remove duplicates
        const uniqueAssignments = assignments.filter((a, index, self) =>
          index === self.findIndex(t => 
            t.date === a.date && 
            t.workstationId === a.workstationId && 
            t.workerIndex === a.workerIndex &&
            t.employeeId === a.employeeId
          )
        );
        
        setDailyAssignments(uniqueAssignments);
        setScheduleGenerated(true);
      }
    } catch (error) {
      console.error('Error loading saved schedules:', error);
    }
  }, [selectedDate]);

  // Load schedules when date changes
  useEffect(() => {
    loadSavedSchedules();
  }, [loadSavedSchedules]);

  // Real-time subscription for schedule updates
  useEffect(() => {
    // Cleanup previous subscription
    if (realtimeChannelRef.current) {
      ganttScheduleService.unsubscribeFromSchedules(realtimeChannelRef.current);
    }
    
    // Subscribe to real-time updates for the selected date
    realtimeChannelRef.current = ganttScheduleService.subscribeToSchedules(
      selectedDate,
      (payload) => {
        console.log('Real-time schedule update:', payload);
        loadSavedSchedules();
      }
    );
    
    return () => {
      if (realtimeChannelRef.current) {
        ganttScheduleService.unsubscribeFromSchedules(realtimeChannelRef.current);
      }
    };
  }, [selectedDate, loadSavedSchedules]);

  // Day navigation handlers
  const handlePreviousDay = useCallback(() => {
    const newDate = subDays(selectedDate, 1);
    if (onDateChange) {
      onDateChange(newDate);
    }
  }, [selectedDate, onDateChange]);

  const handleNextDay = useCallback(() => {
    const newDate = addDays(selectedDate, 1);
    if (onDateChange) {
      onDateChange(newDate);
    }
  }, [selectedDate, onDateChange]);

  const handleToday = useCallback(() => {
    const today = startOfDay(new Date());
    if (onDateChange) {
      onDateChange(today);
    }
  }, [onDateChange]);

  // precomputed lookup structures
  const workingHoursMap = useMemo(() => {
    const m = new Map<number, WorkingHours>();
    workingHours
      .filter((w) => w.team === 'production' && w.is_active)
      .forEach((w) => m.set(w.day_of_week, w));
    return m;
  }, [workingHours]);

  const holidaySet = useMemo(() => new Set(holidays.filter((h) => h.team === 'production').map((h) => h.date)), [holidays]);

  const isWorkingDay = (date: Date) => {
    const day = getDay(date);
    return !isWeekend(date) && workingHoursMap.has(day) && !holidaySet.has(format(date, 'yyyy-MM-dd'));
  };

  const getNextWorkday = (date: Date) => {
    let d = addDays(date, 1);
    while (!isWorkingDay(d)) d = addDays(d, 1);
    return d;
  };

  const getWorkHours = (date: Date) => {
    const wh = workingHoursMap.get(getDay(date));
    if (!wh) return null;
    const [sh, sm] = wh.start_time.split(':').map(Number);
    const [eh, em] = wh.end_time.split(':').map(Number);
    const s = setMinutes(setHours(startOfDay(date), sh), sm);
    const e = setMinutes(setHours(startOfDay(date), eh), em);
    
    // Parse breaks and convert to Date objects for this specific day
    const breaks = (wh.breaks || [])
      .map(b => {
        const [bsh, bsm] = b.start_time.split(':').map(Number);
        const [beh, bem] = b.end_time.split(':').map(Number);
        return {
          start: setMinutes(setHours(startOfDay(date), bsh), bsm),
          end: setMinutes(setHours(startOfDay(date), beh), bem)
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    return { start: s, end: e, breaks };
  };

  // split task across days and breaks — optimized loop
  const getTaskSlots = (from: Date, duration: number) => {
    const res: { start: Date; end: Date }[] = [];
    let remaining = duration;
    let cur = from;
    let wh = getWorkHours(cur);
    if (!wh) {
      cur = getNextWorkday(cur);
      wh = getWorkHours(cur);
    }
    if (cur < wh!.start) cur = wh!.start;

    while (remaining > 0) {
      const endToday = wh!.end;
      const breaks = wh!.breaks || [];
      
      // Find the next break that starts at or after current position
      const nextBreak = breaks.find(b => b.start >= cur);
      
      if (nextBreak && nextBreak.start < endToday) {
        // There's a break before end of day
        const availableBeforeBreak = differenceInMinutes(nextBreak.start, cur);
        
        if (availableBeforeBreak > 0) {
          // Schedule work before the break
          const used = Math.min(remaining, availableBeforeBreak);
          res.push({ start: cur, end: addMinutes(cur, used) });
          remaining -= used;
          
          if (remaining > 0) {
            // Continue after the break
            cur = nextBreak.end;
          }
        } else {
          // We're at or past the break start, skip to after break
          cur = nextBreak.end;
        }
      } else {
        // No more breaks today, use remaining time until end of day
        const available = differenceInMinutes(endToday, cur);
        const used = Math.min(remaining, available);
        
        if (used > 0) {
          res.push({ start: cur, end: addMinutes(cur, used) });
          remaining -= used;
        }
        
        if (remaining > 0) {
          // Move to next workday
          cur = getNextWorkday(cur);
          wh = getWorkHours(cur);
          cur = wh!.start;
        }
      }
    }
    return res;
  };

  // Build limit task dependencies map (maps standard_task_id -> array of limit_standard_task_id)
  const limitTaskMap = useMemo(() => {
    const map = new Map<string, string[]>();
    limitPhases.forEach((lp) => {
      const limits = map.get(lp.standard_task_id) || [];
      limits.push(lp.limit_standard_task_id);
      map.set(lp.standard_task_id, limits);
    });
    return map;
  }, [limitPhases]);

  // Given a HOLD task and the current scheduledTaskEndTimes, return the earliest Date this task is allowed to start
  // due to limit-task dependencies in the same project. If there are limit tasks in the project that are not yet scheduled,
  // return null to indicate this HOLD task cannot be scheduled in this pass.
  const getRequiredDependencyEndForTask = (
    task: Task,
    scheduledTaskEndTimes: Map<string, Date>
  ): Date | null => {
    if (!task.standard_task_id) return new Date(0); // no dependency

    const limitStdIds = limitTaskMap.get(task.standard_task_id);
    if (!limitStdIds || limitStdIds.length === 0) return new Date(0);

    let maxEnd: Date | null = new Date(0);

    for (const limitStdId of limitStdIds) {
      // find the limit task in the same project
      const limitTask = tasks.find(
        (t) => t.standard_task_id === limitStdId && t.phases?.projects?.id === task.phases?.projects?.id
      );

      // if no such task exists in the project, it doesn't block scheduling
      if (!limitTask) continue;

      const endTime = scheduledTaskEndTimes.get(limitTask.id);
      if (!endTime) {
        // limit task exists but hasn't been scheduled yet -> cannot schedule this HOLD task now
        return null;
      }

      if (!maxEnd || endTime > maxEnd) maxEnd = endTime;
    }

    return maxEnd || new Date(0);
  };

  // Handler for updating active workers count
  const handleUpdateWorkers = async (workstationId: string, delta: number) => {
    const ws = workstations.find(w => w.id === workstationId);
    if (!ws) return;
    
    const newCount = Math.max(1, Math.min(10, ws.active_workers + delta));
    if (newCount === ws.active_workers) return;
    
    try {
      await workstationService.updateActiveWorkers(workstationId, newCount);
      setWorkstations(prev => prev.map(w => 
        w.id === workstationId ? { ...w, active_workers: newCount } : w
      ));
      
      toast.success(`Werknemers bijgewerkt naar ${newCount}`);
    } catch (error) {
      toast.error('Fout bij het bijwerken van werknemers');
    }
  };

  // Calculate daily workload for each workstation
  const calculateDailyWorkload = (
    date: Date,
    workstationId: string,
    scheduleMap: Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>
  ): number => {
    const workerMap = scheduleMap.get(workstationId);
    if (!workerMap) return 0;

    const dateStr = format(date, 'yyyy-MM-dd');
    let totalMinutes = 0;

    workerMap.forEach((tasks) => {
      tasks.forEach(({ start, end }) => {
        const taskDateStr = format(start, 'yyyy-MM-dd');
        if (taskDateStr === dateStr) {
          totalMinutes += differenceInMinutes(end, start);
        }
      });
    });

    return totalMinutes;
  };

  // ========================================================================================
  // NEW OPTIMAL SCHEDULER - Clean sequential assignment, one task per employee at a time
  // ========================================================================================
  const handleGeneratePlanning = async () => {
    try {
      setGeneratingPlanning(true);
      console.log('🚀 Starting NEW optimal sequential scheduler...');
      
      // Validate last production step is configured
      const validation = await capacityCheckService.validateLastProductionStepExists();
      if (!validation.valid) {
        toast.error(validation.message);
        setGeneratingPlanning(false);
        return;
      }
      
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      const daysToSchedule = 120; // Extended to 120 days to schedule all tasks
      
      // Build employee data
      const employees: Array<{
        id: string;
        name: string;
        standardTasks: string[];
        workstations: string[];
      }> = [];
      
      employeeStandardTaskLinks.forEach((empList) => {
        empList.forEach(emp => {
          if (employees.some(e => e.id === emp.id)) return;
          
          const linkedWorkstations: string[] = [];
          workstations.forEach(ws => {
            const links = workstationEmployeeLinks.get(ws.id) || [];
            if (links.some(e => e.id === emp.id)) {
              linkedWorkstations.push(ws.id);
            }
          });
          
          employees.push({
            id: emp.id,
            name: emp.name,
            standardTasks: [...emp.standardTasks],
            workstations: linkedWorkstations
          });
        });
      });
      
      // Build workstation capacity
      const wsCapacity = new Map<string, number>();
      workstations.forEach(ws => wsCapacity.set(ws.id, ws.active_workers || 1));
      
      // Build working hours config
      const whConfig = new Map<number, { start_time: string; end_time: string; breaks?: Array<{ start_time: string; end_time: string }> }>();
      workingHours
        .filter(w => w.team === 'production' && w.is_active)
        .forEach(w => {
          whConfig.set(w.day_of_week, {
            start_time: w.start_time,
            end_time: w.end_time,
            breaks: w.breaks
          });
        });
      
      // Prepare tasks with project info
      const scheduleTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        status: t.status,
        due_date: t.due_date,
        standard_task_id: t.standard_task_id,
        priority: t.priority,
        project: t.phases?.projects,
        workstations: t.workstations
      }));
      
      // ===== CORE SCHEDULING ALGORITHM =====
      const scheduledTasks = new Set<string>();
      const taskEndTimes = new Map<string, Date>();
      const taskAssignments = new Map<string, { employeeId: string; employeeName: string; workstationId: string; start: Date; end: Date }>();
      
      // Employee schedule: ONE task at a time
      const employeeSchedule = new Map<string, Array<{ start: Date; end: Date; taskId: string; workstationId: string }>>();
      employees.forEach(e => employeeSchedule.set(e.id, []));
      
      // Workstation schedule for capacity tracking
      const wsSchedule = new Map<string, Map<string, Array<{ start: Date; end: Date; empId: string }>>>();
      
      // Helper: Get task priority score
      const getScore = (task: typeof scheduleTasks[0]): number => {
        if (!task.project) return -2000;
        if (task.project.start_date > today) return -1000;
        
        let score = 0;
        const daysToInstall = differenceInMinutes(new Date(task.project.installation_date), new Date()) / (24 * 60);
        score += Math.max(0, 100 - daysToInstall) * 0.4;
        
        if (task.project.status === 'in_progress') score += 12.5;
        else if (task.project.status === 'planned') score += 7.5;
        
        if (task.priority === 'high') score += 6;
        else if (task.priority === 'medium') score += 3;
        
        const daysToDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
        score += Math.max(0, 50 - daysToDue) * 0.15;
        
        return score;
      };
      
      // Helper: Check if it's a working day
      const isWorkDay = (date: Date): boolean => {
        const day = getDay(date);
        return !isWeekend(date) && 
               whConfig.has(day) && 
               !holidaySet.has(format(date, 'yyyy-MM-dd'));
      };
      
      // Helper: Get next workday
      const nextWorkday = (date: Date): Date => {
        let d = addDays(date, 1);
        let iter = 0;
        while (!isWorkDay(d) && iter < 365) { d = addDays(d, 1); iter++; }
        return d;
      };
      
      // Helper: Get work hours for a day
      const getDayHours = (date: Date) => {
        const wh = whConfig.get(getDay(date));
        if (!wh) return null;
        const [sh, sm] = wh.start_time.split(':').map(Number);
        const [eh, em] = wh.end_time.split(':').map(Number);
        return {
          start: setMinutes(setHours(startOfDay(date), sh), sm),
          end: setMinutes(setHours(startOfDay(date), eh), em),
          breaks: (wh.breaks || []).map(b => ({
            start: setMinutes(setHours(startOfDay(date), parseInt(b.start_time.split(':')[0])), parseInt(b.start_time.split(':')[1])),
            end: setMinutes(setHours(startOfDay(date), parseInt(b.end_time.split(':')[0])), parseInt(b.end_time.split(':')[1]))
          }))
        };
      };
      
      // Helper: Check workstation capacity
      const hasWsCapacity = (wsId: string, dateStr: string, start: Date, end: Date): boolean => {
        const cap = wsCapacity.get(wsId) || 1;
        if (!wsSchedule.has(dateStr)) return true;
        const dayWs = wsSchedule.get(dateStr)!.get(wsId);
        if (!dayWs) return true;
        
        // Check concurrent usage
        const times = new Set<number>([start.getTime(), end.getTime()]);
        dayWs.forEach(s => { times.add(s.start.getTime()); times.add(s.end.getTime()); });
        
        for (const t of times) {
          if (t < start.getTime() || t >= end.getTime()) continue;
          let concurrent = 1;
          for (const slot of dayWs) {
            if (t >= slot.start.getTime() && t < slot.end.getTime()) concurrent++;
          }
          if (concurrent > cap) return false;
        }
        return true;
      };
      
      // Helper: Find earliest slot for employee
      const findSlot = (
        empId: string,
        duration: number,
        wsId: string,
        minStart: Date
      ): { start: Date; end: Date; dateStr: string } | null => {
        const empSlots = employeeSchedule.get(empId) || [];
        const sorted = [...empSlots].sort((a, b) => a.start.getTime() - b.start.getTime());
        
        for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
          const date = addDays(startOfDay(timelineStart), dayOffset);
          if (!isWorkDay(date)) continue;
          
          const dateStr = format(date, 'yyyy-MM-dd');
          const hours = getDayHours(date);
          if (!hours) continue;
          
          // Get this day's slots for this employee
          const daySlots = sorted
            .filter(s => format(s.start, 'yyyy-MM-dd') === dateStr)
            .sort((a, b) => a.start.getTime() - b.start.getTime());
          
          // Find available gaps
          let candidate = date.getTime() < minStart.getTime() && format(minStart, 'yyyy-MM-dd') === dateStr
            ? (minStart < hours.start ? hours.start : minStart)
            : hours.start;
          
          // Build timeline with all boundaries
          const boundaries: { time: Date; type: 'slot_start' | 'slot_end' | 'break_start' | 'break_end' | 'day_end' }[] = [
            ...daySlots.map(s => ({ time: s.start, type: 'slot_start' as const })),
            ...daySlots.map(s => ({ time: s.end, type: 'slot_end' as const })),
            ...hours.breaks.map(b => ({ time: b.start, type: 'break_start' as const })),
            ...hours.breaks.map(b => ({ time: b.end, type: 'break_end' as const })),
            { time: hours.end, type: 'day_end' as const }
          ].sort((a, b) => a.time.getTime() - b.time.getTime());
          
          for (const boundary of boundaries) {
            if (boundary.time.getTime() <= candidate.getTime()) {
              if (boundary.type === 'slot_end' || boundary.type === 'break_end') {
                if (boundary.time > candidate) candidate = boundary.time;
              }
              continue;
            }
            
            // Check if candidate is in a break
            const inBreak = hours.breaks.some(b => candidate >= b.start && candidate < b.end);
            if (inBreak) {
              const brk = hours.breaks.find(b => candidate >= b.start && candidate < b.end)!;
              candidate = brk.end;
              continue;
            }
            
            // Check if candidate is in an existing slot
            const inSlot = daySlots.some(s => candidate >= s.start && candidate < s.end);
            if (inSlot) {
              const slot = daySlots.find(s => candidate >= s.start && candidate < s.end)!;
              candidate = slot.end;
              continue;
            }
            
            const available = differenceInMinutes(boundary.time, candidate);
            if (available >= duration) {
              const potentialEnd = addMinutes(candidate, duration);
              if (hasWsCapacity(wsId, dateStr, candidate, potentialEnd)) {
                return { start: candidate, end: potentialEnd, dateStr };
              }
            }
            
            // Move past this boundary
            if (boundary.type === 'slot_end' || boundary.type === 'break_end') {
              candidate = boundary.time;
            } else if (boundary.type === 'slot_start') {
              const s = daySlots.find(x => x.start.getTime() === boundary.time.getTime());
              if (s) candidate = s.end;
            } else if (boundary.type === 'break_start') {
              const b = hours.breaks.find(x => x.start.getTime() === boundary.time.getTime());
              if (b) candidate = b.end;
            }
          }
        }
        return null;
      };
      
      // Helper: Schedule a task
      const scheduleTask = (
        task: typeof scheduleTasks[0],
        empId: string,
        empName: string,
        wsId: string,
        start: Date,
        end: Date,
        dateStr: string
      ) => {
        // Add to employee schedule
        employeeSchedule.get(empId)!.push({ start, end, taskId: task.id, workstationId: wsId });
        
        // Add to workstation schedule
        if (!wsSchedule.has(dateStr)) wsSchedule.set(dateStr, new Map());
        if (!wsSchedule.get(dateStr)!.has(wsId)) wsSchedule.get(dateStr)!.set(wsId, []);
        wsSchedule.get(dateStr)!.get(wsId)!.push({ start, end, empId });
        
        // Track
        taskEndTimes.set(task.id, end);
        scheduledTasks.add(task.id);
        taskAssignments.set(task.id, { employeeId: empId, employeeName: empName, workstationId: wsId, start, end });
      };
      
      // Helper: Try to assign a task
      const tryAssign = (task: typeof scheduleTasks[0]): boolean => {
        if (!task.standard_task_id) return false;
        
        const eligible = employees.filter(e => e.standardTasks.includes(task.standard_task_id!));
        if (eligible.length === 0) return false;
        
        // Use the task's workstations directly - ignore employee_workstation_links
        const taskWsIds = task.workstations?.map(w => w.id) || [];
        if (taskWsIds.length === 0) return false;
        
        // Score employees: least loaded only (no workstation matching)
        const scored = eligible.map(emp => {
          const slots = employeeSchedule.get(emp.id) || [];
          const workload = slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
          return { emp, score: (100000 - workload) };
        }).sort((a, b) => b.score - a.score);
        
        // Try to assign using task's workstations directly
        for (const { emp } of scored) {
          for (const wsId of taskWsIds) {
            const slot = findSlot(emp.id, task.duration, wsId, timelineStart);
            if (slot) {
              scheduleTask(task, emp.id, emp.name, wsId, slot.start, slot.end, slot.dateStr);
              return true;
            }
          }
        }
        return false;
      };
      
      // ===== EXECUTE SCHEDULING =====
      
      // Filter valid tasks
      const validTasks = scheduleTasks.filter(t => {
        if (!t.standard_task_id) return false;
        if (t.status !== 'TODO' && t.status !== 'HOLD') return false;
        if (t.project && t.project.start_date > today) return false;
        return true;
      });
      
      // Sort by priority
      const sortedTasks = [...validTasks].sort((a, b) => {
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      
      const todoTasks = sortedTasks.filter(t => t.status === 'TODO');
      const holdTasks = sortedTasks.filter(t => t.status === 'HOLD');
      const unassignedTasks: typeof scheduleTasks = [];
      
      console.log(`📋 Tasks: ${todoTasks.length} TODO, ${holdTasks.length} HOLD, ${employees.length} employees`);
      
      // PHASE 1: Schedule TODO tasks
      console.log('📅 PHASE 1: Scheduling TODO tasks...');
      for (const task of todoTasks) {
        if (!tryAssign(task)) {
          unassignedTasks.push(task);
        }
      }
      console.log(`✅ PHASE 1: ${scheduledTasks.size} scheduled`);
      
      // PHASE 2: Schedule HOLD tasks
      console.log('📅 PHASE 2: Scheduling HOLD tasks...');
      let remaining = new Set(holdTasks.map(t => t.id));
      let iter = 0;
      while (remaining.size > 0 && iter < holdTasks.length * 3) {
        iter++;
        let progress = false;
        for (const task of holdTasks) {
          if (!remaining.has(task.id)) continue;
          if (scheduledTasks.has(task.id)) {
            remaining.delete(task.id);
            continue;
          }
          if (tryAssign(task)) {
            remaining.delete(task.id);
            progress = true;
          }
        }
        if (!progress) break;
      }
      for (const taskId of remaining) {
        const task = holdTasks.find(t => t.id === taskId);
        if (task) unassignedTasks.push(task);
      }
      console.log(`✅ PHASE 2: ${scheduledTasks.size} scheduled`);
      
      // PHASE 3: Gap-filling
      console.log('📅 PHASE 3: Gap-filling...');
      const stillUnassigned = [...unassignedTasks];
      unassignedTasks.length = 0;
      for (const task of stillUnassigned) {
        if (scheduledTasks.has(task.id)) continue;
        if (!tryAssign(task)) {
          unassignedTasks.push(task);
        }
      }
      console.log(`✅ PHASE 3: ${scheduledTasks.size} scheduled`);
      
      // PHASE 4: Validation
      console.log('🔍 PHASE 4: Validation...');
      let errors = 0;
      employeeSchedule.forEach((slots, empId) => {
        const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].end > sorted[i + 1].start) {
            console.error(`❌ Employee overlap: ${empId}`);
            errors++;
          }
        }
      });
      console.log(errors === 0 ? '✅ Validation passed!' : `⚠️ ${errors} errors`);
      
      // PHASE 5: Build UI assignments
      console.log('🎨 PHASE 5: Building UI...');
      const newAssignments: DailyEmployeeAssignment[] = [];
      const empWsDays = new Map<string, Set<string>>();
      
      taskAssignments.forEach(({ employeeId, workstationId, start }) => {
        const dateStr = format(start, 'yyyy-MM-dd');
        const key = `${dateStr}|${workstationId}`;
        if (!empWsDays.has(key)) empWsDays.set(key, new Set());
        empWsDays.get(key)!.add(employeeId);
      });
      
      empWsDays.forEach((emps, key) => {
        const [date, wsId] = key.split('|');
        Array.from(emps).forEach((empId, index) => {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            newAssignments.push({
              date,
              workstationId: wsId,
              workerIndex: index,
              employeeId: empId,
              employeeName: emp.name,
            });
          }
        });
      });
      
      // Stats
      let totalUsed = 0;
      employeeSchedule.forEach(slots => {
        totalUsed += slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
      });
      const avgPerEmployee = employees.length > 0 ? (totalUsed / employees.length).toFixed(0) : 0;
      
      console.log('📊 ===== STATISTICS =====');
      console.log(`✅ Scheduled: ${scheduledTasks.size} tasks`);
      console.log(`❌ Unassigned: ${unassignedTasks.length} tasks`);
      console.log(`👥 Employees: ${new Set(Array.from(taskAssignments.values()).map(a => a.employeeId)).size}`);
      console.log(`📈 Avg per employee: ${avgPerEmployee} min`);
      
      if (unassignedTasks.length > 0) {
        console.warn('⚠️ Unassigned:', unassignedTasks.map(t => ({ title: t.title, std: t.standard_task_id })));
      }
      
      setDailyAssignments(newAssignments);
      setScheduleGenerated(true);
      
      // ===== PHASE 6: Check project deadlines =====
      console.log('🔍 PHASE 6: Checking project deadlines...');
      
      // Get the last production step and build task order map
      const lastProductionStep = await standardTasksService.getLastProductionStep();
      const taskOrderMap = new Map<string, number>();
      standardTasks.forEach((st, index) => {
        taskOrderMap.set(st.id, index);
      });
      
      const lastProductionStepOrder = lastProductionStep 
        ? (taskOrderMap.get(lastProductionStep.id) ?? Infinity)
        : Infinity;
      
      // Helper to check if a task is at or before the last production step
      const isProductionTask = (task: typeof scheduleTasks[0]): boolean => {
        if (!lastProductionStep || !task.standard_task_id) return true; // Include if no filter
        const taskOrder = taskOrderMap.get(task.standard_task_id) ?? Infinity;
        return taskOrder <= lastProductionStepOrder;
      };
      
      const projectCompletionDates = new Map<string, { lastEndDate: Date; project: any; tasks: typeof scheduleTasks }>();
      
      // Group tasks by project and find the latest end date for production tasks only
      taskAssignments.forEach(({ start, end }, taskId) => {
        const task = scheduleTasks.find(t => t.id === taskId);
        if (!task?.project) return;
        
        // Only consider tasks up to and including the last production step
        if (!isProductionTask(task)) return;
        
        const existing = projectCompletionDates.get(task.project.id);
        if (!existing || end > existing.lastEndDate) {
          projectCompletionDates.set(task.project.id, {
            lastEndDate: end,
            project: task.project,
            tasks: existing ? [...existing.tasks, task] : [task]
          });
        } else if (existing) {
          existing.tasks.push(task);
        }
      });
      
      // Also check for unassigned production tasks by project
      const projectsWithUnassignedTasks = new Set<string>();
      unassignedTasks.forEach(task => {
        if (task.project?.id && isProductionTask(task)) {
          projectsWithUnassignedTasks.add(task.project.id);
        }
      });
      
      const warnings: ProjectDeadlineWarning[] = [];
      let hasCapacityIssue = false;
      
      projectCompletionDates.forEach(({ lastEndDate, project }, projectId) => {
        const installationDate = new Date(project.installation_date);
        
        // Check if project will be completed after installation date
        if (lastEndDate > installationDate) {
          const daysOverdue = Math.ceil(differenceInMinutes(lastEndDate, installationDate) / (24 * 60));
          
          warnings.push({
            projectId,
            projectName: project.name,
            clientName: project.client || 'Onbekende klant',
            installationDate,
            estimatedCompletionDate: lastEndDate,
            daysOverdue,
            canReschedule: !projectsWithUnassignedTasks.has(projectId)
          });
          
          // If project has unassigned production tasks, it's a capacity issue
          if (projectsWithUnassignedTasks.has(projectId)) {
            hasCapacityIssue = true;
          }
        }
      });
      
      // Check for completely unscheduled projects (all production tasks unassigned)
      const unscheduledProjects = new Map<string, { project: any; tasks: typeof scheduleTasks }>();
      unassignedTasks.forEach(task => {
        if (!task.project || !isProductionTask(task)) return;
        const existing = unscheduledProjects.get(task.project.id);
        if (existing) {
          existing.tasks.push(task);
        } else {
          unscheduledProjects.set(task.project.id, {
            project: task.project,
            tasks: [task]
          });
        }
      });
      
      unscheduledProjects.forEach(({ project, tasks }, projectId) => {
        // Only add if not already in warnings
        if (!warnings.some(w => w.projectId === projectId)) {
          const installationDate = new Date(project.installation_date);
          const estimatedDuration = tasks.reduce((sum, t) => sum + t.duration, 0);
          const estimatedDays = Math.ceil(estimatedDuration / (8 * 60)); // Assuming 8-hour workdays
          const estimatedCompletion = addDays(new Date(), estimatedDays + 30); // Add buffer
          
          if (isBefore(installationDate, estimatedCompletion)) {
            warnings.push({
              projectId,
              projectName: project.name,
              clientName: project.client || 'Onbekende klant',
              installationDate,
              estimatedCompletionDate: estimatedCompletion,
              daysOverdue: Math.ceil(differenceInMinutes(estimatedCompletion, installationDate) / (24 * 60)),
              canReschedule: false
            });
            hasCapacityIssue = true;
          }
        }
      });
      
      // Sort warnings by overdue days (most urgent first)
      warnings.sort((a, b) => b.daysOverdue - a.daysOverdue);
      
      if (warnings.length > 0) {
        console.warn(`⚠️ ${warnings.length} projects cannot meet their deadlines:`, warnings);
        setDeadlineWarnings(warnings);
        setCapacityIssue(hasCapacityIssue);
        setShowDeadlineWarning(true);
      } else {
        console.log('✅ All projects scheduled to complete before their installation dates');
        toast.success(`Planning: ${scheduledTasks.size} taken, gemiddeld ${avgPerEmployee} min/werknemer - Alle deadlines gehaald!`);
      }
      
      // ===== PHASE 7: Save schedules to database =====
      console.log('💾 PHASE 7: Saving schedules to database...');
      try {
        // Group schedules by date
        const schedulesByDate = new Map<string, GanttScheduleInsert[]>();
        
        taskAssignments.forEach(({ employeeId, workstationId, start, end }, taskId) => {
          const dateStr = format(start, 'yyyy-MM-dd');
          
          if (!schedulesByDate.has(dateStr)) {
            schedulesByDate.set(dateStr, []);
          }
          
          // Find worker index for this employee at this workstation
          const assignment = newAssignments.find(
            a => a.date === dateStr && a.workstationId === workstationId && a.employeeId === employeeId
          );
          
          schedulesByDate.get(dateStr)!.push({
            task_id: taskId,
            workstation_id: workstationId,
            employee_id: employeeId,
            scheduled_date: dateStr,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            worker_index: assignment?.workerIndex || 0,
          });
        });
        
        // Save all schedules
        for (const [dateStr, dateSchedules] of schedulesByDate) {
          await ganttScheduleService.saveSchedulesForDate(parseISO(dateStr), dateSchedules);
        }
        
        console.log(`✅ Saved ${taskAssignments.size} schedules to database`);
        toast.success('Planning opgeslagen in database');
      } catch (saveError) {
        console.error('Error saving schedules:', saveError);
        toast.error('Fout bij opslaan van planning');
      }
      
    } catch (error) {
      console.error('Generate planning error:', error);
      toast.error('Fout bij het genereren van planning');
    } finally {
      setGeneratingPlanning(false);
    }
  };
  
  // Reschedule to prioritize projects that are at risk of missing deadlines
  const handleRescheduleForDeadlines = async () => {
    setIsRescheduling(true);
    setShowDeadlineWarning(false);
    
    try {
      // Get projects that need prioritization
      const urgentProjectIds = new Set(deadlineWarnings.filter(w => w.canReschedule).map(w => w.projectId));
      
      console.log('🚨 Rescheduling with urgent project prioritization:', urgentProjectIds);
      
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      const daysToSchedule = 120;
      
      // Build employee data
      const employees: Array<{
        id: string;
        name: string;
        standardTasks: string[];
        workstations: string[];
      }> = [];
      
      employeeStandardTaskLinks.forEach((empList) => {
        empList.forEach(emp => {
          if (employees.some(e => e.id === emp.id)) return;
          
          const linkedWorkstations: string[] = [];
          workstations.forEach(ws => {
            const links = workstationEmployeeLinks.get(ws.id) || [];
            if (links.some(e => e.id === emp.id)) {
              linkedWorkstations.push(ws.id);
            }
          });
          
          employees.push({
            id: emp.id,
            name: emp.name,
            standardTasks: [...emp.standardTasks],
            workstations: linkedWorkstations
          });
        });
      });
      
      // Build workstation capacity
      const wsCapacity = new Map<string, number>();
      workstations.forEach(ws => wsCapacity.set(ws.id, ws.active_workers || 1));
      
      // Build working hours config
      const whConfig = new Map<number, { start_time: string; end_time: string; breaks?: Array<{ start_time: string; end_time: string }> }>();
      workingHours
        .filter(w => w.team === 'production' && w.is_active)
        .forEach(w => {
          whConfig.set(w.day_of_week, {
            start_time: w.start_time,
            end_time: w.end_time,
            breaks: w.breaks
          });
        });
      
      // Prepare tasks with project info
      const scheduleTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        status: t.status,
        due_date: t.due_date,
        standard_task_id: t.standard_task_id,
        priority: t.priority,
        project: t.phases?.projects,
        workstations: t.workstations
      }));
      
      const scheduledTasks = new Set<string>();
      const taskEndTimes = new Map<string, Date>();
      const taskAssignments = new Map<string, { employeeId: string; employeeName: string; workstationId: string; start: Date; end: Date }>();
      const employeeSchedule = new Map<string, Array<{ start: Date; end: Date; taskId: string; workstationId: string }>>();
      employees.forEach(e => employeeSchedule.set(e.id, []));
      const wsSchedule = new Map<string, Map<string, Array<{ start: Date; end: Date; empId: string }>>>();
      
      // Enhanced priority scoring that strongly prioritizes urgent projects
      const getScore = (task: typeof scheduleTasks[0]): number => {
        if (!task.project) return -2000;
        if (task.project.start_date > today) return -1000;
        
        let score = 0;
        
        // MASSIVE boost for urgent projects
        if (urgentProjectIds.has(task.project.id)) {
          score += 10000;
        }
        
        const daysToInstall = differenceInMinutes(new Date(task.project.installation_date), new Date()) / (24 * 60);
        score += Math.max(0, 100 - daysToInstall) * 2; // Double the installation urgency weight
        
        if (task.project.status === 'in_progress') score += 50;
        if (task.priority === 'high') score += 100;
        else if (task.priority === 'medium') score += 50;
        
        return score;
      };
      
      // Helper functions (same as in handleGeneratePlanning)
      const isWorkDay = (date: Date): boolean => {
        const day = getDay(date);
        return !isWeekend(date) && whConfig.has(day) && !holidaySet.has(format(date, 'yyyy-MM-dd'));
      };
      
      const getNextWorkDay = (date: Date): Date => {
        let d = addDays(date, 1);
        while (!isWorkDay(d)) d = addDays(d, 1);
        return d;
      };
      
      const getDayHours = (date: Date) => {
        const wh = whConfig.get(getDay(date));
        if (!wh) return null;
        const [sh, sm] = wh.start_time.split(':').map(Number);
        const [eh, em] = wh.end_time.split(':').map(Number);
        return {
          start: setMinutes(setHours(startOfDay(date), sh), sm),
          end: setMinutes(setHours(startOfDay(date), eh), em),
          breaks: (wh.breaks || []).map(b => ({
            start: setMinutes(setHours(startOfDay(date), parseInt(b.start_time.split(':')[0])), parseInt(b.start_time.split(':')[1])),
            end: setMinutes(setHours(startOfDay(date), parseInt(b.end_time.split(':')[0])), parseInt(b.end_time.split(':')[1]))
          }))
        };
      };
      
      const hasWsCapacity = (wsId: string, dateStr: string, start: Date, end: Date): boolean => {
        const cap = wsCapacity.get(wsId) || 1;
        if (!wsSchedule.has(dateStr)) return true;
        const dayWs = wsSchedule.get(dateStr)!.get(wsId);
        if (!dayWs) return true;
        
        const times = new Set<number>([start.getTime(), end.getTime()]);
        dayWs.forEach(s => { times.add(s.start.getTime()); times.add(s.end.getTime()); });
        
        for (const t of times) {
          if (t < start.getTime() || t >= end.getTime()) continue;
          let concurrent = 1;
          for (const slot of dayWs) {
            if (t >= slot.start.getTime() && t < slot.end.getTime()) concurrent++;
          }
          if (concurrent > cap) return false;
        }
        return true;
      };
      
      const findSlot = (
        empId: string,
        duration: number,
        wsId: string,
        minStart: Date
      ): { start: Date; end: Date; dateStr: string } | null => {
        const empSlots = employeeSchedule.get(empId) || [];
        const sorted = [...empSlots].sort((a, b) => a.start.getTime() - b.start.getTime());
        
        for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
          const date = addDays(startOfDay(timelineStart), dayOffset);
          if (!isWorkDay(date)) continue;
          
          const dateStr = format(date, 'yyyy-MM-dd');
          const hours = getDayHours(date);
          if (!hours) continue;
          
          const daySlots = sorted
            .filter(s => format(s.start, 'yyyy-MM-dd') === dateStr)
            .sort((a, b) => a.start.getTime() - b.start.getTime());
          
          let candidate = date.getTime() < minStart.getTime() && format(minStart, 'yyyy-MM-dd') === dateStr
            ? (minStart < hours.start ? hours.start : minStart)
            : hours.start;
          
          const boundaries: { time: Date; type: 'slot_start' | 'slot_end' | 'break_start' | 'break_end' | 'day_end' }[] = [
            ...daySlots.map(s => ({ time: s.start, type: 'slot_start' as const })),
            ...daySlots.map(s => ({ time: s.end, type: 'slot_end' as const })),
            ...hours.breaks.map(b => ({ time: b.start, type: 'break_start' as const })),
            ...hours.breaks.map(b => ({ time: b.end, type: 'break_end' as const })),
            { time: hours.end, type: 'day_end' as const }
          ].sort((a, b) => a.time.getTime() - b.time.getTime());
          
          for (const boundary of boundaries) {
            if (boundary.time.getTime() <= candidate.getTime()) {
              if (boundary.type === 'slot_end' || boundary.type === 'break_end') {
                if (boundary.time > candidate) candidate = boundary.time;
              }
              continue;
            }
            
            const inBreak = hours.breaks.some(b => candidate >= b.start && candidate < b.end);
            if (inBreak) {
              const brk = hours.breaks.find(b => candidate >= b.start && candidate < b.end)!;
              candidate = brk.end;
              continue;
            }
            
            const inSlot = daySlots.some(s => candidate >= s.start && candidate < s.end);
            if (inSlot) {
              const slot = daySlots.find(s => candidate >= s.start && candidate < s.end)!;
              candidate = slot.end;
              continue;
            }
            
            const available = differenceInMinutes(boundary.time, candidate);
            if (available >= duration) {
              const potentialEnd = addMinutes(candidate, duration);
              if (hasWsCapacity(wsId, dateStr, candidate, potentialEnd)) {
                return { start: candidate, end: potentialEnd, dateStr };
              }
            }
            
            if (boundary.type === 'slot_end' || boundary.type === 'break_end') {
              candidate = boundary.time;
            } else if (boundary.type === 'slot_start') {
              const s = daySlots.find(x => x.start.getTime() === boundary.time.getTime());
              if (s) candidate = s.end;
            } else if (boundary.type === 'break_start') {
              const b = hours.breaks.find(x => x.start.getTime() === boundary.time.getTime());
              if (b) candidate = b.end;
            }
          }
        }
        return null;
      };
      
      const scheduleTask = (
        task: typeof scheduleTasks[0],
        empId: string,
        empName: string,
        wsId: string,
        start: Date,
        end: Date,
        dateStr: string
      ) => {
        employeeSchedule.get(empId)!.push({ start, end, taskId: task.id, workstationId: wsId });
        
        if (!wsSchedule.has(dateStr)) wsSchedule.set(dateStr, new Map());
        if (!wsSchedule.get(dateStr)!.has(wsId)) wsSchedule.get(dateStr)!.set(wsId, []);
        wsSchedule.get(dateStr)!.get(wsId)!.push({ start, end, empId });
        
        taskEndTimes.set(task.id, end);
        scheduledTasks.add(task.id);
        taskAssignments.set(task.id, { employeeId: empId, employeeName: empName, workstationId: wsId, start, end });
      };
      
      const tryAssign = (task: typeof scheduleTasks[0]): boolean => {
        if (!task.standard_task_id) return false;
        
        const eligible = employees.filter(e => e.standardTasks.includes(task.standard_task_id!));
        if (eligible.length === 0) return false;
        
        const taskWsIds = task.workstations?.map(w => w.id) || [];
        
        const scored = eligible.map(emp => {
          const slots = employeeSchedule.get(emp.id) || [];
          const workload = slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
          const wsMatch = taskWsIds.some(wsId => emp.workstations.includes(wsId)) ? 500 : 0;
          return { emp, score: (100000 - workload) + wsMatch };
        }).sort((a, b) => b.score - a.score);
        
        for (const { emp } of scored) {
          const compatWs = taskWsIds.filter(wsId => emp.workstations.includes(wsId));
          const wsToTry = compatWs.length > 0 ? compatWs : emp.workstations;
          
          for (const wsId of wsToTry) {
            const slot = findSlot(emp.id, task.duration, wsId, timelineStart);
            if (slot) {
              scheduleTask(task, emp.id, emp.name, wsId, slot.start, slot.end, slot.dateStr);
              return true;
            }
          }
        }
        return false;
      };
      
      // Filter and sort tasks with urgent projects first
      const validTasks = scheduleTasks.filter(t => {
        if (!t.standard_task_id) return false;
        if (t.status !== 'TODO' && t.status !== 'HOLD') return false;
        if (t.project && t.project.start_date > today) return false;
        return true;
      });
      
      const sortedTasks = [...validTasks].sort((a, b) => {
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      
      // Schedule all tasks
      const unassignedTasks: typeof scheduleTasks = [];
      for (const task of sortedTasks) {
        if (!tryAssign(task)) {
          unassignedTasks.push(task);
        }
      }
      
      // Build UI assignments
      const newAssignments: DailyEmployeeAssignment[] = [];
      const empWsDays = new Map<string, Set<string>>();
      
      taskAssignments.forEach(({ employeeId, workstationId, start }) => {
        const dateStr = format(start, 'yyyy-MM-dd');
        const key = `${dateStr}|${workstationId}`;
        if (!empWsDays.has(key)) empWsDays.set(key, new Set());
        empWsDays.get(key)!.add(employeeId);
      });
      
      empWsDays.forEach((emps, key) => {
        const [date, wsId] = key.split('|');
        Array.from(emps).forEach((empId, index) => {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            newAssignments.push({
              date,
              workstationId: wsId,
              workerIndex: index,
              employeeId: empId,
              employeeName: emp.name,
            });
          }
        });
      });
      
      setDailyAssignments(newAssignments);
      
      // Recheck deadlines - only consider production tasks
      const lastProductionStep = await standardTasksService.getLastProductionStep();
      const taskOrderMap = new Map<string, number>();
      standardTasks.forEach((st, index) => {
        taskOrderMap.set(st.id, index);
      });
      const lastProductionStepOrder = lastProductionStep 
        ? (taskOrderMap.get(lastProductionStep.id) ?? Infinity)
        : Infinity;
      
      const isProductionTask = (task: typeof scheduleTasks[0]): boolean => {
        if (!lastProductionStep || !task.standard_task_id) return true;
        const taskOrder = taskOrderMap.get(task.standard_task_id) ?? Infinity;
        return taskOrder <= lastProductionStepOrder;
      };
      
      const projectCompletionDates = new Map<string, { lastEndDate: Date; project: any }>();
      taskAssignments.forEach(({ end }, taskId) => {
        const task = scheduleTasks.find(t => t.id === taskId);
        if (!task?.project || !isProductionTask(task)) return;
        
        const existing = projectCompletionDates.get(task.project.id);
        if (!existing || end > existing.lastEndDate) {
          projectCompletionDates.set(task.project.id, {
            lastEndDate: end,
            project: task.project
          });
        }
      });
      
      const newWarnings: ProjectDeadlineWarning[] = [];
      projectCompletionDates.forEach(({ lastEndDate, project }, projectId) => {
        const installationDate = new Date(project.installation_date);
        if (lastEndDate > installationDate) {
          newWarnings.push({
            projectId,
            projectName: project.name,
            clientName: project.client || 'Onbekende klant',
            installationDate,
            estimatedCompletionDate: lastEndDate,
            daysOverdue: Math.ceil(differenceInMinutes(lastEndDate, installationDate) / (24 * 60)),
            canReschedule: false
          });
        }
      });
      
      if (newWarnings.length > 0) {
        setDeadlineWarnings(newWarnings);
        setCapacityIssue(true);
        setShowDeadlineWarning(true);
        toast.error(`${newWarnings.length} projecten kunnen niet op tijd worden afgerond - onvoldoende capaciteit`);
      } else {
        toast.success('Herplanning succesvol - alle projecten worden op tijd afgerond!');
      }
      
    } catch (error) {
      console.error('Reschedule error:', error);
      toast.error('Fout bij het herplannen');
    } finally {
      setIsRescheduling(false);
      setReschedulingProjectId(null);
    }
  };

  // Reschedule a single project to prioritize it
  const handleRescheduleProject = async (projectId: string) => {
    setIsRescheduling(true);
    setReschedulingProjectId(projectId);
    
    try {
      console.log('🚨 Rescheduling single project:', projectId);
      
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      const daysToSchedule = 120;
      
      // Build employee data
      const employees: Array<{
        id: string;
        name: string;
        standardTasks: string[];
        workstations: string[];
      }> = [];
      
      employeeStandardTaskLinks.forEach((empList) => {
        empList.forEach(emp => {
          if (employees.some(e => e.id === emp.id)) return;
          
          const linkedWorkstations: string[] = [];
          workstations.forEach(ws => {
            const links = workstationEmployeeLinks.get(ws.id) || [];
            if (links.some(e => e.id === emp.id)) {
              linkedWorkstations.push(ws.id);
            }
          });
          
          employees.push({
            id: emp.id,
            name: emp.name,
            standardTasks: [...emp.standardTasks],
            workstations: linkedWorkstations
          });
        });
      });
      
      // Build workstation capacity
      const wsCapacity = new Map<string, number>();
      workstations.forEach(ws => wsCapacity.set(ws.id, ws.active_workers || 1));
      
      // Build working hours config
      const whConfig = new Map<number, { start_time: string; end_time: string; breaks?: Array<{ start_time: string; end_time: string }> }>();
      workingHours
        .filter(w => w.team === 'production' && w.is_active)
        .forEach(w => {
          whConfig.set(w.day_of_week, {
            start_time: w.start_time,
            end_time: w.end_time,
            breaks: w.breaks
          });
        });
      
      // Prepare tasks with project info
      const scheduleTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        status: t.status,
        due_date: t.due_date,
        standard_task_id: t.standard_task_id,
        priority: t.priority,
        project: t.phases?.projects,
        workstations: t.workstations
      }));
      
      const scheduledTasks = new Set<string>();
      const taskEndTimes = new Map<string, Date>();
      const taskAssignments = new Map<string, { employeeId: string; employeeName: string; workstationId: string; start: Date; end: Date }>();
      const employeeSchedule = new Map<string, Array<{ start: Date; end: Date; taskId: string; workstationId: string }>>();
      employees.forEach(e => employeeSchedule.set(e.id, []));
      const wsSchedule = new Map<string, Map<string, Array<{ start: Date; end: Date; empId: string }>>>();
      
      // Priority scoring with MASSIVE boost for the selected project
      const getScore = (task: typeof scheduleTasks[0]): number => {
        if (!task.project) return -2000;
        if (task.project.start_date > today) return -1000;
        
        let score = 0;
        
        // MASSIVE boost for the selected project
        if (task.project.id === projectId) {
          score += 50000;
        }
        
        const daysToInstall = differenceInMinutes(new Date(task.project.installation_date), new Date()) / (24 * 60);
        score += Math.max(0, 100 - daysToInstall) * 2;
        
        if (task.project.status === 'in_progress') score += 50;
        if (task.priority === 'high') score += 100;
        else if (task.priority === 'medium') score += 50;
        
        return score;
      };
      
      // Helper functions (same as main scheduling)
      const isWorkDay = (date: Date): boolean => {
        const dayOfWeek = date.getDay();
        const dateStr = format(date, 'yyyy-MM-dd');
        if (holidaySet.has(dateStr)) return false;
        return whConfig.has(dayOfWeek);
      };
      
      const getNextSlotForEmployee = (empId: string, wsId: string, duration: number, minStart: Date): { start: Date; end: Date } | null => {
        const slots = employeeSchedule.get(empId) || [];
        let cursor = new Date(Math.max(minStart.getTime(), timelineStart.getTime()));
        const maxDate = addDays(timelineStart, daysToSchedule);
        
        while (cursor < maxDate) {
          if (!isWorkDay(cursor)) {
            cursor = addDays(startOfDay(cursor), 1);
            continue;
          }
          
          const dayOfWeek = cursor.getDay();
          const wh = whConfig.get(dayOfWeek);
          if (!wh) {
            cursor = addDays(startOfDay(cursor), 1);
            continue;
          }
          
          const [sh, sm] = wh.start_time.split(':').map(Number);
          const [eh, em] = wh.end_time.split(':').map(Number);
          const dayStart = setHours(setMinutes(startOfDay(cursor), sm), sh);
          const dayEnd = setHours(setMinutes(startOfDay(cursor), em), eh);
          
          if (cursor < dayStart) cursor = dayStart;
          if (cursor >= dayEnd) {
            cursor = addDays(startOfDay(cursor), 1);
            continue;
          }
          
          const potentialEnd = addMinutes(cursor, duration);
          if (potentialEnd > dayEnd) {
            cursor = addDays(startOfDay(cursor), 1);
            continue;
          }
          
          const hasConflict = slots.some(s => 
            (cursor >= s.start && cursor < s.end) ||
            (potentialEnd > s.start && potentialEnd <= s.end) ||
            (cursor <= s.start && potentialEnd >= s.end)
          );
          
          if (!hasConflict) {
            const dateStr = format(cursor, 'yyyy-MM-dd');
            if (!wsSchedule.has(wsId)) wsSchedule.set(wsId, new Map());
            const daySchedule = wsSchedule.get(wsId)!;
            if (!daySchedule.has(dateStr)) daySchedule.set(dateStr, []);
            const daySlots = daySchedule.get(dateStr)!;
            
            const concurrentWorkers = daySlots.filter(s =>
              (cursor >= s.start && cursor < s.end) ||
              (potentialEnd > s.start && potentialEnd <= s.end) ||
              (cursor <= s.start && potentialEnd >= s.end)
            ).length;
            
            const capacity = wsCapacity.get(wsId) || 1;
            if (concurrentWorkers >= capacity) {
              cursor = addMinutes(cursor, 15);
              continue;
            }
            
            return { start: cursor, end: potentialEnd };
          }
          
          cursor = addMinutes(cursor, 15);
        }
        return null;
      };
      
      const tryAssign = (task: typeof scheduleTasks[0]): boolean => {
        if (!task.standard_task_id) return false;
        if (scheduledTasks.has(task.id)) return true;
        
        const eligible = employees.filter(e => e.standardTasks.includes(task.standard_task_id!));
        if (eligible.length === 0) return false;
        
        // Use the task's workstations directly - ignore employee_workstation_links
        const taskWsIds = task.workstations?.map(w => w.id) || [];
        if (taskWsIds.length === 0) return false;
        
        // Score employees: least loaded only (no workstation matching)
        const scored = eligible.map(emp => {
          const slots = employeeSchedule.get(emp.id) || [];
          const workload = slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
          return { emp, score: (100000 - workload) };
        }).sort((a, b) => b.score - a.score);
        
        // Try to assign using task's workstations directly
        for (const { emp } of scored) {
          for (const wsId of taskWsIds) {
            const slot = getNextSlotForEmployee(emp.id, wsId, task.duration, timelineStart);
            if (slot) {
              scheduledTasks.add(task.id);
              taskEndTimes.set(task.id, slot.end);
              taskAssignments.set(task.id, {
                employeeId: emp.id,
                employeeName: emp.name,
                workstationId: wsId,
                start: slot.start,
                end: slot.end
              });
              
              const empSlots = employeeSchedule.get(emp.id)!;
              empSlots.push({ start: slot.start, end: slot.end, taskId: task.id, workstationId: wsId });
              
              const dateStr = format(slot.start, 'yyyy-MM-dd');
              if (!wsSchedule.has(wsId)) wsSchedule.set(wsId, new Map());
              if (!wsSchedule.get(wsId)!.has(dateStr)) wsSchedule.get(wsId)!.set(dateStr, []);
              wsSchedule.get(wsId)!.get(dateStr)!.push({ start: slot.start, end: slot.end, empId: emp.id });
              
              return true;
            }
          }
        }
        return false;
      };
      
      // Schedule tasks with priority scoring
      const todoTasks = scheduleTasks.filter(t => t.status === 'TODO' && !scheduledTasks.has(t.id));
      const holdTasks = scheduleTasks.filter(t => t.status === 'HOLD' && !scheduledTasks.has(t.id));
      const unassignedTasks: typeof scheduleTasks = [];
      
      todoTasks.sort((a, b) => getScore(b) - getScore(a));
      holdTasks.sort((a, b) => getScore(b) - getScore(a));
      
      // Schedule TODO tasks first
      for (const task of todoTasks) {
        if (!tryAssign(task)) unassignedTasks.push(task);
      }
      
      // Schedule HOLD tasks
      for (const task of holdTasks) {
        if (!tryAssign(task)) unassignedTasks.push(task);
      }
      
      // Gap-filling
      const stillUnassigned = [...unassignedTasks];
      unassignedTasks.length = 0;
      for (const task of stillUnassigned) {
        if (!tryAssign(task)) unassignedTasks.push(task);
      }
      
      // Build UI assignments
      const newAssignments: DailyEmployeeAssignment[] = [];
      const empWsDays = new Map<string, Set<string>>();
      
      taskAssignments.forEach(({ employeeId, workstationId, start }) => {
        const dateStr = format(start, 'yyyy-MM-dd');
        const key = `${dateStr}|${workstationId}`;
        if (!empWsDays.has(key)) empWsDays.set(key, new Set());
        empWsDays.get(key)!.add(employeeId);
      });
      
      empWsDays.forEach((emps, key) => {
        const [date, wsId] = key.split('|');
        Array.from(emps).forEach((empId, index) => {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            newAssignments.push({
              date,
              workstationId: wsId,
              workerIndex: index,
              employeeId: empId,
              employeeName: emp.name,
            });
          }
        });
      });
      
      setDailyAssignments(newAssignments);
      setScheduleGenerated(true);
      
      // Check if the project is now on time
      let projectOnTime = true;
      let projectEndDate: Date | null = null;
      
      taskAssignments.forEach(({ start, end }, taskId) => {
        const task = scheduleTasks.find(t => t.id === taskId);
        if (task?.project?.id === projectId) {
          if (!projectEndDate || end > projectEndDate) {
            projectEndDate = end;
          }
        }
      });
      
      const targetProject = deadlineWarnings.find(w => w.projectId === projectId);
      if (targetProject && projectEndDate) {
        if (projectEndDate > targetProject.installationDate) {
          projectOnTime = false;
        }
      }
      
      // Update warnings - only consider production tasks
      const lastProductionStep = await standardTasksService.getLastProductionStep();
      const taskOrderMap = new Map<string, number>();
      standardTasks.forEach((st, index) => {
        taskOrderMap.set(st.id, index);
      });
      const lastProductionStepOrder = lastProductionStep 
        ? (taskOrderMap.get(lastProductionStep.id) ?? Infinity)
        : Infinity;
      
      const isProductionTask = (task: typeof scheduleTasks[0]): boolean => {
        if (!lastProductionStep || !task.standard_task_id) return true;
        const taskOrder = taskOrderMap.get(task.standard_task_id) ?? Infinity;
        return taskOrder <= lastProductionStepOrder;
      };
      
      const projectCompletionDates = new Map<string, { lastEndDate: Date; project: any }>();
      taskAssignments.forEach(({ start, end }, taskId) => {
        const task = scheduleTasks.find(t => t.id === taskId);
        if (!task?.project || !isProductionTask(task)) return;
        
        const existing = projectCompletionDates.get(task.project.id);
        if (!existing || end > existing.lastEndDate) {
          projectCompletionDates.set(task.project.id, {
            lastEndDate: end,
            project: task.project
          });
        }
      });
      
      const newWarnings: ProjectDeadlineWarning[] = [];
      projectCompletionDates.forEach(({ lastEndDate, project }, pId) => {
        const installationDate = new Date(project.installation_date);
        if (lastEndDate > installationDate) {
          newWarnings.push({
            projectId: pId,
            projectName: project.name,
            clientName: project.client || 'Onbekende klant',
            installationDate,
            estimatedCompletionDate: lastEndDate,
            daysOverdue: Math.ceil(differenceInMinutes(lastEndDate, installationDate) / (24 * 60)),
            canReschedule: true
          });
        }
      });
      
      newWarnings.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setDeadlineWarnings(newWarnings);
      
      if (projectOnTime) {
        toast.success(`Project "${targetProject?.projectName}" wordt nu op tijd afgerond!`);
        if (newWarnings.length === 0) {
          setShowDeadlineWarning(false);
        }
      } else {
        toast.warning(`Project "${targetProject?.projectName}" kan nog steeds niet op tijd worden afgerond - onvoldoende capaciteit`);
      }
      
    } catch (error) {
      console.error('Reschedule project error:', error);
      toast.error('Fout bij het herplannen van project');
    } finally {
      setIsRescheduling(false);
      setReschedulingProjectId(null);
    }
  };

  // Smart auto-assign employees with project prioritization and optimal worker allocation
  const handleAutoAssign = () => {
    try {
      const newAssignments: DailyEmployeeAssignment[] = [];
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Generate timeline for next 30 days
      const daysToOptimize = 30;
      const dates = Array.from({ length: daysToOptimize }, (_, i) => addDays(timelineStart, i));

      // Get project priority score for tasks
      const getProjectPriorityScore = (task: Task): number => {
        const project = task.phases?.projects;
        if (!project) return 0;
        if (project.start_date > today) return -1000;
        
        let score = 0;
        const daysUntilInstallation = differenceInMinutes(
          new Date(project.installation_date), 
          new Date()
        ) / (24 * 60);
        score += Math.max(0, 100 - daysUntilInstallation);
        
        if (project.status === 'in_progress') score += 50;
        else if (project.status === 'planned') score += 30;
        else if (project.status === 'on_hold') score -= 20;
        
        if (task.priority === 'high') score += 30;
        else if (task.priority === 'medium') score += 15;
        else if (task.priority === 'low') score += 5;
        
        const daysUntilDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
        score += Math.max(0, 50 - daysUntilDue);
        
        return score;
      };

      // For each day, optimize employee assignments
      dates.forEach((date) => {
        if (!isWorkingDay(date)) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Calculate workload and priority per workstation
        const workstationWorkloads = workstations
          .map((ws) => {
            const workerMap = schedule.get(ws.id);
            if (!workerMap) return { workstation: ws, workload: 0, priorityScore: 0, taskCount: 0 };

            let totalMinutes = 0;
            let totalPriorityScore = 0;
            let taskCount = 0;

            workerMap.forEach((tasks) => {
              tasks.forEach(({ task, start, end }) => {
                const taskDateStr = format(start, 'yyyy-MM-dd');
                if (taskDateStr === dateStr) {
                  const minutes = differenceInMinutes(end, start);
                  const priorityScore = getProjectPriorityScore(task);
                  
                  if (priorityScore > 0) {
                    totalMinutes += minutes;
                    totalPriorityScore += priorityScore * minutes;
                    taskCount++;
                  }
                }
              });
            });

            return {
              workstation: ws,
              workload: totalMinutes,
              priorityScore: taskCount > 0 ? totalPriorityScore / totalMinutes : 0,
              taskCount,
            };
          })
          .filter((w) => w.workload > 0 && w.priorityScore > 0)
          .sort((a, b) => {
            // Sort by priority first, then workload
            const priorityDiff = b.priorityScore - a.priorityScore;
            return priorityDiff !== 0 ? priorityDiff : b.workload - a.workload;
          });

        // Calculate working hours for the day
        const workHours = getWorkHours(date);
        if (!workHours) return;
        
        const availableMinutesPerWorker = differenceInMinutes(workHours.end, workHours.start);
        
        // Calculate optimal workers needed per workstation
        const workstationWorkerNeeds = workstationWorkloads.map(({ workstation, workload }) => {
          // Calculate how many workers are needed based on workload
          const optimalWorkers = Math.ceil(workload / availableMinutesPerWorker);
          // Cap at max active_workers
          const workersNeeded = Math.min(optimalWorkers, workstation.active_workers);
          
          return {
            workstation,
            workersNeeded: Math.max(1, workersNeeded), // Always at least 1
          };
        });

        // Track which employees are assigned on this day
        const assignedEmployees = new Set<string>();
        const employeeWorkstations = new Map<string, string>(); // Track which workstation each employee is at

        // Assign employees to workstations based on priority and need
        workstationWorkerNeeds.forEach(({ workstation, workersNeeded }) => {
          const linkedEmployees = workstationEmployeeLinks.get(workstation.id) || [];
          
          // Prefer employees who are NOT yet assigned (to minimize workstation switches)
          const availableEmployees = linkedEmployees
            .filter((emp) => !assignedEmployees.has(emp.id))
            .sort((a, b) => a.name.localeCompare(b.name)); // Consistent ordering

          // If we need more workers and all linked employees are assigned,
          // check if any are at nearby/related workstations
          const additionalEmployees = linkedEmployees
            .filter((emp) => assignedEmployees.has(emp.id))
            .slice(0, Math.max(0, workersNeeded - availableEmployees.length));

          const employeesToAssign = [
            ...availableEmployees.slice(0, workersNeeded),
            ...additionalEmployees,
          ].slice(0, workersNeeded);

          employeesToAssign.forEach((employee, index) => {
            newAssignments.push({
              date: dateStr,
              workstationId: workstation.id,
              workerIndex: index,
              employeeId: employee.id,
              employeeName: employee.name,
            });
            assignedEmployees.add(employee.id);
            employeeWorkstations.set(employee.id, workstation.id);
          });
        });

        // FILL GAPS: Assign remaining unassigned employees to workstations with capacity
        const unassignedEmployees = new Set<string>();
        workstations.forEach((ws) => {
          const linked = workstationEmployeeLinks.get(ws.id) || [];
          linked.forEach((emp) => {
            if (!assignedEmployees.has(emp.id)) {
              unassignedEmployees.add(emp.id);
            }
          });
        });

        // For each unassigned employee, try to find a workstation with spare capacity
        unassignedEmployees.forEach((employeeId) => {
          const employee = Array.from(workstationEmployeeLinks.values())
            .flat()
            .find((e) => e.id === employeeId);
          
          if (!employee) return;

          // Find workstations this employee is linked to that have capacity
          const eligibleWorkstations = workstations.filter((ws) => {
            const linked = workstationEmployeeLinks.get(ws.id) || [];
            const isLinked = linked.some((e) => e.id === employeeId);
            const currentAssignments = newAssignments.filter(
              (a) => a.date === dateStr && a.workstationId === ws.id
            );
            return isLinked && currentAssignments.length < ws.active_workers;
          });

          if (eligibleWorkstations.length > 0) {
            // Assign to the first eligible workstation (could be improved with more logic)
            const ws = eligibleWorkstations[0];
            const workerIndex = newAssignments.filter(
              (a) => a.date === dateStr && a.workstationId === ws.id
            ).length;

            newAssignments.push({
              date: dateStr,
              workstationId: ws.id,
              workerIndex,
              employeeId: employee.id,
              employeeName: employee.name,
            });
          }
        });
      });

      setDailyAssignments(newAssignments);
      toast.success(`Werknemers slim toegewezen voor ${daysToOptimize} dagen op basis van prioriteit en workload`);
    } catch (error) {
      console.error('Auto-assign error:', error);
      toast.error('Fout bij automatisch toewijzen');
    }
  };

  // Get assigned employee for a specific worker on a specific date
  const getAssignedEmployee = (date: Date, workstationId: string, workerIndex: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dailyAssignments.find(
      (a) => a.date === dateStr && a.workstationId === workstationId && a.workerIndex === workerIndex
    );
  };

  // Get unique employees from daily assignments
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, string>();
    dailyAssignments.forEach(assignment => {
      employeeMap.set(assignment.employeeId, assignment.employeeName);
    });
    return Array.from(employeeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [dailyAssignments]);

  // Toggle employee expansion
  const toggleEmployeeExpansion = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Toggle workstation assignment for employee
  const handleToggleWorkstation = async (employeeId: string, workstationId: string) => {
    const currentLinks = workstationEmployeeLinks.get(workstationId) || [];
    const isCurrentlyAssigned = currentLinks.some(emp => emp.id === employeeId);

    try {
      if (isCurrentlyAssigned) {
        // Remove the link
        const { error } = await supabase
          .from('employee_workstation_links')
          .delete()
          .eq('employee_id', employeeId)
          .eq('workstation_id', workstationId);

        if (error) throw error;

        // Update local state
        setWorkstationEmployeeLinks(prev => {
          const newMap = new Map(prev);
          const filtered = currentLinks.filter(emp => emp.id !== employeeId);
          newMap.set(workstationId, filtered);
          return newMap;
        });

        toast.success('Werkstation verwijderd van werknemer');
      } else {
        // Add the link
        const { error } = await supabase
          .from('employee_workstation_links')
          .insert({
            employee_id: employeeId,
            workstation_id: workstationId,
          });

        if (error) throw error;

        // Update local state
        const employeeName = uniqueEmployees.find(e => e.id === employeeId)?.name || '';
        setWorkstationEmployeeLinks(prev => {
          const newMap = new Map(prev);
          const updated = [...currentLinks, { id: employeeId, name: employeeName }];
          newMap.set(workstationId, updated);
          return newMap;
        });

        toast.success('Werkstation toegewezen aan werknemer');
      }
    } catch (error) {
      console.error('Error toggling workstation:', error);
      toast.error('Fout bij het bijwerken van werkstation toewijzing');
    }
  };

  // Toggle standard task assignment for employee
  const handleToggleStandardTask = async (employeeId: string, standardTaskId: string) => {
    const currentEmployee = Array.from(employeeStandardTaskLinks.values())
      .flat()
      .find(emp => emp.id === employeeId);
    
    const isCurrentlyAssigned = currentEmployee?.standardTasks.includes(standardTaskId) || false;

    try {
      if (isCurrentlyAssigned) {
        // Remove the link
        const { error } = await supabase
          .from('employee_standard_task_links')
          .delete()
          .eq('employee_id', employeeId)
          .eq('standard_task_id', standardTaskId);

        if (error) throw error;

        // Update local state
        setEmployeeStandardTaskLinks(prev => {
          const newMap = new Map(prev);
          const empData = newMap.get(employeeId);
          if (empData && empData[0]) {
            empData[0].standardTasks = empData[0].standardTasks.filter(id => id !== standardTaskId);
            if (empData[0].standardTasks.length === 0) {
              newMap.delete(employeeId);
            }
          }
          return newMap;
        });

        toast.success('Standaard taak verwijderd van werknemer');
      } else {
        // Add the link
        const { error } = await supabase
          .from('employee_standard_task_links')
          .insert({
            employee_id: employeeId,
            standard_task_id: standardTaskId,
          });

        if (error) throw error;

        // Update local state
        const employeeName = uniqueEmployees.find(e => e.id === employeeId)?.name || '';
        setEmployeeStandardTaskLinks(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(employeeId);
          if (existing && existing[0]) {
            existing[0].standardTasks.push(standardTaskId);
          } else {
            newMap.set(employeeId, [{
              id: employeeId,
              name: employeeName,
              standardTasks: [standardTaskId]
            }]);
          }
          return newMap;
        });

        toast.success('Standaard taak toegewezen aan werknemer');
      }
    } catch (error: any) {
      console.error('Error toggling standard task:', error);
      toast.error(`Fout: ${error.message}`);
    }
  };

  // Expose data via ref for external access
  useImperativeHandle(ref, () => ({
    getDailyAssignments: () => dailyAssignments,
    getSchedule: () => schedule,
    getTasks: () => tasks,
    getWorkstations: () => workstations,
  }));

  // Run auto-assign only once on initial load
  useEffect(() => {
    if (workstations.length > 0 && tasks.length > 0 && dailyAssignments.length === 0) {
      // Don't auto-assign, let user click the button
    }
  }, [workstations, tasks]);

  // Advanced employee-centric schedule calculation with optimal task assignment
  const schedule = useMemo(() => {
    // Map: workstationId -> workerIndex -> tasks (for rendering)
    const all = new Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>();
    
    // Initialize workstation structures for rendering (always needed for empty chart)
    workstations.forEach((ws) => {
      const workerCount = ws.active_workers || 1;
      const workerMap = new Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
      for (let i = 0; i < workerCount; i++) {
        workerMap.set(i, []);
      }
      all.set(ws.id, workerMap);
    });

    // If we have saved schedules from the database, use those
    if (savedSchedules.length > 0) {
      const isTaskVisible = (task: any) => {
        if (!searchTerm) return true;
        return task?.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      };
      
      savedSchedules.forEach((schedule: any) => {
        if (!schedule.tasks || !schedule.workstation_id) return;
        
        const workerMap = all.get(schedule.workstation_id);
        if (!workerMap) return;
        
        const workerIndex = schedule.worker_index || 0;
        const workerTasks = workerMap.get(workerIndex) || [];
        
        const task: Task = {
          id: schedule.tasks.id,
          title: schedule.tasks.title,
          description: schedule.tasks.description,
          duration: schedule.tasks.duration,
          status: schedule.tasks.status,
          due_date: schedule.tasks.due_date,
          phase_id: schedule.tasks.phase_id,
          standard_task_id: schedule.tasks.standard_task_id,
          priority: schedule.tasks.priority,
          phases: schedule.tasks.phases,
          workstations: [],
        };
        
        workerTasks.push({
          task,
          start: parseISO(schedule.start_time),
          end: parseISO(schedule.end_time),
          isVisible: isTaskVisible(task),
        });
        
        workerMap.set(workerIndex, workerTasks);
      });
      
      return all;
    }

    // Return empty schedule if not generated yet
    if (!scheduleGenerated) {
      return all;
    }
    
    // Employee-based scheduling state
    const employeeSchedules = new Map<string, Array<{ task: Task; start: Date; end: Date }>>();
    const scheduledTaskEndTimes = new Map<string, Date>();
    const scheduledTaskIds = new Set<string>();
    const unassignedTasks: Task[] = [];
    
    const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get all employees with their standard task capabilities
    const allEmployees = new Map<string, { id: string; name: string; standardTasks: string[]; workstations: string[] }>();
    employeeStandardTaskLinks.forEach((employees, employeeId) => {
      employees.forEach(emp => {
        if (!allEmployees.has(emp.id)) {
          // Get workstations this employee is linked to
          const empWorkstations: string[] = [];
          workstations.forEach(ws => {
            const links = workstationEmployeeLinks.get(ws.id) || [];
            if (links.some(e => e.id === emp.id)) {
              empWorkstations.push(ws.id);
            }
          });
          
          allEmployees.set(emp.id, {
            id: emp.id,
            name: emp.name,
            standardTasks: [...emp.standardTasks],
            workstations: empWorkstations
          });
          employeeSchedules.set(emp.id, []);
        }
      });
    });

    // Helper: Check if task matches search filter
    const isTaskVisible = (task: Task) => {
      if (!searchTerm) return true;
      return task.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    };

    // Helper: Calculate task priority score (multi-factor)
    const getTaskPriorityScore = (task: Task): number => {
      const project = task.phases?.projects;
      if (!project) return -2000;
      if (project.start_date > today) return -1000;
      
      let score = 0;
      
      // Factor 1: Installation urgency (weight: 40%)
      const daysUntilInstallation = differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60);
      score += Math.max(0, 100 - daysUntilInstallation) * 0.4;
      
      // Factor 2: Project status (weight: 25%)
      if (project.status === 'in_progress') score += 50 * 0.25;
      else if (project.status === 'planned') score += 30 * 0.25;
      else if (project.status === 'on_hold') score -= 20 * 0.25;
      
      // Factor 3: Task priority (weight: 20%)
      if (task.priority === 'high') score += 30 * 0.2;
      else if (task.priority === 'medium') score += 15 * 0.2;
      else if (task.priority === 'low') score += 5 * 0.2;
      
      // Factor 4: Due date urgency (weight: 15%)
      const daysUntilDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
      score += Math.max(0, 50 - daysUntilDue) * 0.15;
      
      return score;
    };

    // Helper: Find available time slot for employee
    const findAvailableSlot = (employeeId: string, duration: number, minStartTime: Date): { start: Date; slots: Array<{ start: Date; end: Date }> } | null => {
      const empSchedule = employeeSchedules.get(employeeId) || [];
      
      // Sort existing tasks by start time
      const sortedTasks = [...empSchedule].sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Try to find a gap starting from minStartTime
      let candidateStart = minStartTime;
      
      for (const existingTask of sortedTasks) {
        if (existingTask.start >= candidateStart) {
          // Check if we can fit the task before this existing task
          const availableMinutes = differenceInMinutes(existingTask.start, candidateStart);
          if (availableMinutes >= duration) {
            const slots = getTaskSlots(candidateStart, duration);
            if (slots.length > 0) {
              return { start: candidateStart, slots };
            }
          }
        }
        // Move candidate start to after this task
        if (existingTask.end > candidateStart) {
          candidateStart = existingTask.end;
        }
      }
      
      // Try to schedule after all existing tasks
      const slots = getTaskSlots(candidateStart, duration);
      if (slots.length > 0) {
        return { start: candidateStart, slots };
      }
      
      return null;
    };

    // Helper: Assign task to employee
    const assignTaskToEmployee = (task: Task, employeeId: string, startTime: Date): boolean => {
      const employee = allEmployees.get(employeeId);
      if (!employee) return false;

      const slots = getTaskSlots(startTime, task.duration);
      if (slots.length === 0) return false;

      // Add to employee schedule
      const empSchedule = employeeSchedules.get(employeeId)!;
      empSchedule.push({ task, start: slots[0].start, end: slots[slots.length - 1].end });

      // Add to workstation rendering - ALWAYS use the task's assigned workstation
      let targetWorkstation: string | null = null;
      
      // Priority 1: Use the task's assigned workstation (this is the correct workstation for the task)
      if (task.workstations && task.workstations.length > 0) {
        targetWorkstation = task.workstations[0].id;
      }
      
      // Priority 2: Only if task has no workstation, use employee's linked workstation
      if (!targetWorkstation && employee.workstations.length > 0) {
        targetWorkstation = employee.workstations[0];
      }

      if (targetWorkstation) {
        const workerMap = all.get(targetWorkstation);
        if (workerMap) {
          // Find or assign worker index for this employee
          let workerIndex = -1;
          const dateStr = format(startTime, 'yyyy-MM-dd');
          const assignment = dailyAssignments.find(
            a => a.date === dateStr && a.workstationId === targetWorkstation && a.employeeId === employeeId
          );
          
          if (assignment) {
            workerIndex = assignment.workerIndex;
          } else {
            // Find first available worker slot
            for (let i = 0; i < (workstations.find(w => w.id === targetWorkstation)?.active_workers || 1); i++) {
              workerIndex = i;
              break;
            }
          }

          if (workerIndex >= 0) {
            const taskList = workerMap.get(workerIndex) || [];
            const isVisible = isTaskVisible(task);
            slots.forEach(s => taskList.push({ task, ...s, isVisible }));
            workerMap.set(workerIndex, taskList);
          }
        }
      }

      const lastSlot = slots[slots.length - 1];
      scheduledTaskEndTimes.set(task.id, lastSlot.end);
      scheduledTaskIds.add(task.id);
      
      return true;
    };

    // Sort all tasks by priority
    const sortedTasks = [...tasks]
      .filter(t => {
        const project = t.phases?.projects;
        return project && project.start_date <= today && (t.status === 'TODO' || t.status === 'HOLD');
      })
      .sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    const todoTasks = sortedTasks.filter(t => t.status === 'TODO');
    const holdTasks = sortedTasks.filter(t => t.status === 'HOLD');

    // PHASE 1: Schedule TODO tasks with optimal employee assignment
    for (const task of todoTasks) {
      if (!task.standard_task_id) {
        unassignedTasks.push(task);
        continue;
      }

      // Find eligible employees (those who can do this standard task)
      const eligibleEmployees = Array.from(allEmployees.values()).filter(emp =>
        emp.standardTasks.includes(task.standard_task_id!)
      );

      if (eligibleEmployees.length === 0) {
        unassignedTasks.push(task);
        continue;
      }

      // Score each employee based on current workload only (ignore workstation links)
      const employeeScores = eligibleEmployees.map(emp => {
        const empSchedule = employeeSchedules.get(emp.id) || [];
        const currentWorkload = empSchedule.reduce((sum, s) => 
          sum + differenceInMinutes(s.end, s.start), 0
        );
        
        // Prefer less loaded employees only
        const workloadScore = 10000 - currentWorkload;
        
        return {
          employee: emp,
          score: workloadScore
        };
      }).sort((a, b) => b.score - a.score);

      // Try to assign to best available employee
      let assigned = false;
      for (const { employee } of employeeScores) {
        const slot = findAvailableSlot(employee.id, task.duration, timelineStart);
        if (slot) {
          if (assignTaskToEmployee(task, employee.id, slot.start)) {
            assigned = true;
            break;
          }
        }
      }

      if (!assigned) {
        unassignedTasks.push(task);
      }
    }

    // PHASE 2: Schedule HOLD tasks with dependency resolution
    const remainingHoldTasks = new Set(holdTasks.map(t => t.id));
    let maxIterations = holdTasks.length * 5;
    let iteration = 0;

    while (remainingHoldTasks.size > 0 && iteration < maxIterations) {
      iteration++;
      let progressMade = false;

      for (const task of holdTasks) {
        if (!remainingHoldTasks.has(task.id)) continue;
        if (!task.standard_task_id) {
          remainingHoldTasks.delete(task.id);
          unassignedTasks.push(task);
          continue;
        }

        // Check dependencies
        const dependencyEnd = getRequiredDependencyEndForTask(task, scheduledTaskEndTimes);
        if (dependencyEnd === null) continue; // Can't schedule yet

        // Find eligible employees
        const eligibleEmployees = Array.from(allEmployees.values()).filter(emp =>
          emp.standardTasks.includes(task.standard_task_id!)
        );

        if (eligibleEmployees.length === 0) {
          remainingHoldTasks.delete(task.id);
          unassignedTasks.push(task);
          continue;
        }

        // Score employees
        const employeeScores = eligibleEmployees.map(emp => {
          const empSchedule = employeeSchedules.get(emp.id) || [];
          const currentWorkload = empSchedule.reduce((sum, s) => 
            sum + differenceInMinutes(s.end, s.start), 0
          );
          
          const workloadScore = 10000 - currentWorkload;
          const workstationMatchScore = task.workstations?.some(taskWs => 
            emp.workstations.includes(taskWs.id)
          ) ? 1000 : 0;
          
          return {
            employee: emp,
            score: workloadScore + workstationMatchScore
          };
        }).sort((a, b) => b.score - a.score);

        // Try to assign
        let assigned = false;
        for (const { employee } of employeeScores) {
          const minStart = dependencyEnd > timelineStart ? dependencyEnd : timelineStart;
          const slot = findAvailableSlot(employee.id, task.duration, minStart);
          if (slot) {
            if (assignTaskToEmployee(task, employee.id, slot.start)) {
              assigned = true;
              progressMade = true;
              break;
            }
          }
        }

        if (assigned) {
          remainingHoldTasks.delete(task.id);
        } else {
          unassignedTasks.push(task);
          remainingHoldTasks.delete(task.id);
        }
      }

      if (!progressMade) break;
    }

    // PHASE 3: Gap-filling optimization - try to fit unassigned tasks into gaps
    const workHours = getWorkHours(selectedDate);
    if (workHours && unassignedTasks.length > 0) {
      const sortedUnassigned = [...unassignedTasks].sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        return scoreB - scoreA;
      });

      for (const task of sortedUnassigned) {
        if (!task.standard_task_id) continue;
        if (scheduledTaskIds.has(task.id)) continue;

        const eligibleEmployees = Array.from(allEmployees.values()).filter(emp =>
          emp.standardTasks.includes(task.standard_task_id!)
        );

        for (const employee of eligibleEmployees) {
          const slot = findAvailableSlot(employee.id, task.duration, timelineStart);
          if (slot) {
            if (assignTaskToEmployee(task, employee.id, slot.start)) {
              const idx = unassignedTasks.findIndex(t => t.id === task.id);
              if (idx >= 0) unassignedTasks.splice(idx, 1);
              break;
            }
          }
        }
      }
    }

    // Log scheduling statistics
    console.log('📊 Scheduling Statistics:');
    console.log(`✅ Scheduled: ${scheduledTaskIds.size} tasks`);
    console.log(`❌ Unassigned: ${unassignedTasks.length} tasks`);
    console.log(`👥 Employees used: ${Array.from(employeeSchedules.values()).filter(s => s.length > 0).length}`);
    
    if (unassignedTasks.length > 0) {
      console.warn('⚠️ Unassigned tasks:', unassignedTasks.map(t => ({
        title: t.title,
        standardTask: t.standard_task_id,
        reason: !t.standard_task_id ? 'No standard task' : 'No eligible employee or time slot'
      })));
    }

    return all;
  }, [tasks, workstations, selectedDate, workingHoursMap, holidaySet, limitTaskMap, searchTerm, dailyAssignments, workstationEmployeeLinks, employeeStandardTaskLinks, scheduleGenerated, savedSchedules]);

  // Auto-assign on mount and when dependencies change
  // Auto-assign disabled to avoid auto-filling the chart; use the 'Genereer Planning' button instead
  // useEffect(() => {
  // }, []);

  const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
  const timeline = Array.from({ length: scale.totalUnits }, (_, i) => addMinutes(timelineStart, i * scale.unitInMinutes));

  if (loading)
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <RefreshCw className="animate-spin h-8 w-8" />
        </CardContent>
      </Card>
    );

  // Enhanced color coding based on project status and priority
  const getTaskColor = (task: Task) => {
    const project = task.phases?.projects;
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Default color from project ID
    const pid = project?.id || '';
    const hue = pid.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    
    // Status-based color modifications
    let saturation = 65;
    let lightness = 45;
    let border = 'rgba(0,0,0,0.2)';
    
    if (project) {
      // Future project (not yet started)
      if (project.start_date > today) {
        saturation = 30;
        lightness = 60;
        border = 'rgba(0,0,0,0.1)';
      }
      // High priority or urgent installation
      else if (task.priority === 'high' || 
               differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60) < 7) {
        saturation = 80;
        lightness = 40;
        border = 'rgba(255,0,0,0.3)';
      }
      // Delayed/blocked
      else if (task.status === 'HOLD') {
        saturation = 45;
        lightness = 55;
        border = 'rgba(255,165,0,0.4)';
      }
    }
    
    return {
      bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      text: `hsl(${hue}, 100%, 95%)`,
      border,
    };
  };

  const getColor = (id: string) => {
    const hue = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return { bg: `hsl(${hue},65%,45%)`, text: `hsl(${hue},100%,95%)` };
  };

  return (
    <>
    <ProjectDeadlineWarningDialog
      isOpen={showDeadlineWarning}
      onClose={() => setShowDeadlineWarning(false)}
      warnings={deadlineWarnings}
      onReschedule={handleRescheduleForDeadlines}
      onRescheduleProject={handleRescheduleProject}
      isRescheduling={isRescheduling}
      reschedulingProjectId={reschedulingProjectId}
      capacityIssue={capacityIssue}
    />
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          {/* Title and Day Navigation Row */}
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <CardTitle>Workstation Gantt Chart</CardTitle>
              
              {/* Day Navigation */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button 
                  onClick={handlePreviousDay} 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-2 px-3 py-1 min-w-[180px] justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
                  </span>
                </div>
                
                <Button 
                  onClick={handleNextDay} 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button 
                  onClick={handleToday} 
                  variant="outline" 
                  size="sm"
                  className="ml-2"
                >
                  Vandaag
                </Button>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 items-center flex-wrap">
              <Button onClick={handleAutoAssign} variant="outline" size="sm">
                🎯 Slim Auto-toewijzen
              </Button>
              <Button 
                onClick={handleGeneratePlanning} 
                variant="default"
                size="sm"
                disabled={generatingPlanning}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                {generatingPlanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Genereer Planning
                  </>
                )}
              </Button>
              <Button 
                onClick={() => setShowCriticalPath(!showCriticalPath)} 
                variant={showCriticalPath ? "default" : "outline"} 
                size="sm"
              >
                {showCriticalPath ? '✓' : ''} Kritiek pad
              </Button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))} variant="outline" size="sm">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button onClick={() => setZoom((z) => Math.min(6, z * 1.5))} variant="outline" size="sm">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-destructive"></div>
              <span>🔴 Hoge prioriteit / Urgent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary"></div>
              <span>🟢 Actief project</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-warning"></div>
              <span>🟠 Geblokkeerd (HOLD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted-foreground/30"></div>
              <span>⚪ Toekomstig project</span>
            </div>
            
            {savedSchedules.length > 0 && (
              <div className="flex items-center gap-1.5 ml-4 text-primary">
                <Save className="w-3 h-3" />
                <span>{savedSchedules.length} taken geladen uit database</span>
              </div>
            )}
          </div>
          
          {dailyAssignments.length > 0 && (
            <div className="p-2 bg-accent border border-border rounded text-xs">
              ✅ <strong>{new Set(dailyAssignments.map(a => a.employeeId)).size}</strong> werknemers toegewezen voor{' '}
              <strong>{format(selectedDate, 'd MMMM', { locale: nl })}</strong> met optimale werkverdeling
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="overflow-auto border rounded-lg" style={{ maxHeight: 600 }}>
          {/* header with fixed total width to ensure proper alignment */}
          <div
            className="sticky top-0 z-10 flex border-b bg-muted"
            style={{ 
              height: headerHeight,
              minWidth: workstationLabelWidth + (scale.totalUnits * scale.unitWidth)
            }}
          >
            {/* Sticky label cell for header */}
            <div 
              className="sticky left-0 z-20 bg-muted border-r flex items-center justify-center font-medium"
              style={{ width: workstationLabelWidth, minWidth: workstationLabelWidth }}
            >
              {format(selectedDate, 'EEEE d MMMM', { locale: nl })}
            </div>
            {/* Timeline columns */}
            <div className="flex">
              {timeline.map((t, i) => (
                <div 
                  key={i} 
                  style={{ width: scale.unitWidth, minWidth: scale.unitWidth }} 
                  className="flex flex-col justify-center items-center border-r text-xs"
                >
                  {scale.format(t)}
                </div>
              ))}
            </div>
          </div>

          {/* rows */}
          {workstations.map((ws) => {
            const workerMap = schedule.get(ws.id);
            if (!workerMap) return null;
            
            const workerCount = ws.active_workers || 1;
            const totalHeight = rowHeight * workerCount;
            const timelineWidth = scale.totalUnits * scale.unitWidth;
            
            return (
              <div 
                key={ws.id} 
                className="relative border-b flex" 
                style={{ 
                  height: totalHeight,
                  minWidth: workstationLabelWidth + timelineWidth
                }}
              >
                {/* Sticky workstation label */}
                <div
                  className="sticky left-0 z-10 flex flex-col border-r bg-muted"
                  style={{ width: workstationLabelWidth, minWidth: workstationLabelWidth }}
                >
                  <div className="px-3 py-2 border-b flex items-center justify-between">
                    <span className="font-medium">{ws.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleUpdateWorkers(ws.id, -1)}
                        disabled={workerCount <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-1">{workerCount}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleUpdateWorkers(ws.id, 1)}
                        disabled={workerCount >= 10}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Show worker lane labels with employee names */}
                  {Array.from({ length: workerCount }).map((_, workerIndex) => {
                    const assignment = getAssignedEmployee(selectedDate, ws.id, workerIndex);
                    
                    return (
                      <div
                        key={workerIndex}
                        className="px-3 py-1 text-xs flex items-center"
                        style={{ 
                          height: rowHeight,
                          borderTop: workerIndex > 0 ? '1px dashed hsl(var(--border) / 0.3)' : undefined
                        }}
                      >
                        <span className="text-muted-foreground">
                          Werker {workerIndex + 1}: 
                        </span>
                        <span className="ml-1 font-medium truncate">
                          {assignment ? assignment.employeeName : 'Niet toegewezen'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Timeline area with fixed width */}
                <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth }}>
                  {/* Render each worker lane */}
                  {Array.from({ length: workerCount }).map((_, workerIndex) => {
                    const tasks = workerMap.get(workerIndex) || [];
                    const laneTop = workerIndex * rowHeight;
                    
                    return (
                      <div
                        key={workerIndex}
                        className="absolute left-0 right-0"
                        style={{
                          top: laneTop,
                          height: rowHeight,
                          borderTop: workerIndex > 0 ? '1px dashed hsl(var(--border) / 0.3)' : undefined
                        }}
                      >
                        {/* Grid lines aligned with timeline columns */}
                        {timeline.map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute top-0 bottom-0 border-r border-border/40" 
                            style={{ left: i * scale.unitWidth, width: 0 }} 
                          />
                        ))}
                        <TooltipProvider>
                          {tasks.map(({ task, start, end, isVisible }) => {
                            if (!isVisible) return null;

                            const project = task.phases?.projects;
                            const { bg, text, border } = getTaskColor(task);
                            const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                            const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
                            
                            // Get assigned employee for this date
                            const assignment = getAssignedEmployee(start, ws.id, workerIndex);
                            
                            // Critical path styling (thicker border)
                            const isCritical = showCriticalPath && task.priority === 'high';
                            
                            return (
                              <Tooltip key={`${task.id}-${start.toISOString()}-${workerIndex}`}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute rounded-md px-2 py-1 text-xs font-medium overflow-hidden"
                                    style={{
                                      left,
                                      width: Math.max(width, 2), // Minimum width for visibility
                                      top: 8,
                                      height: rowHeight - 16,
                                      background: bg,
                                      color: text,
                                      border: isCritical ? `3px solid ${border}` : `1px solid ${border}`,
                                      boxShadow: isCritical ? '0 0 8px rgba(255,0,0,0.3)' : 'none',
                                    }}
                                  >
                                    <div className="truncate font-semibold">
                                      {project?.name || 'Project'} – {task.title}
                                    </div>
                                    <div className="text-[9px] opacity-75 truncate">
                                      {task.priority === 'high' && '🔴 '}
                                      {task.priority === 'medium' && '🟡 '}
                                      {task.priority === 'low' && '🟢 '}
                                      {task.status === 'HOLD' && '🟠 HOLD '}
                                    </div>
                                    {assignment && (
                                      <div className="text-[10px] opacity-80 truncate mt-0.5">
                                        👤 {assignment.employeeName}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <div className="font-bold text-sm mb-1">{project?.name || 'Project'}</div>
                                    <div><b>Taak:</b> {task.title}</div>
                                    <div><b>Start:</b> {format(start, 'dd MMM HH:mm')}</div>
                                    <div><b>Einde:</b> {format(end, 'dd MMM HH:mm')}</div>
                                    <div><b>Duur:</b> {task.duration} min</div>
                                    <div><b>Status:</b> {task.status} {task.status === 'HOLD' && '🟠'}</div>
                                    <div><b>Prioriteit:</b> {task.priority} {task.priority === 'high' && '🔴'}</div>
                                    {assignment && (
                                      <div><b>Werknemer:</b> {assignment.employeeName}</div>
                                    )}
                                    {project && (
                                      <>
                                        <div className="border-t pt-1 mt-1">
                                          <div><b>Klant:</b> {project.client}</div>
                                          <div><b>Project start:</b> {format(new Date(project.start_date), 'dd MMM yyyy')}</div>
                                          <div><b>Installatie:</b> {format(new Date(project.installation_date), 'dd MMM yyyy')}</div>
                                          <div><b>Status:</b> {project.status}</div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Employee Workstation Management */}
        {uniqueEmployees.length > 0 && (
          <div className="mt-6 border-t pt-6 space-y-6">
            {/* Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'TODO' || t.status === 'HOLD').length}</div>
                  <div className="text-xs text-muted-foreground">Totaal taken in planning</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-primary">{uniqueEmployees.length}</div>
                  <div className="text-xs text-muted-foreground">Toegewezen werknemers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-primary">
                    {new Set(dailyAssignments.map(a => a.date)).size}
                  </div>
                  <div className="text-xs text-muted-foreground">Dagen gepland</div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Management */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Toegewezen Werknemers ({uniqueEmployees.length})
              </h3>
              <div className="space-y-2">
                {uniqueEmployees.map(employee => {
                  const isExpanded = expandedEmployees.has(employee.id);
                  const employeeData = Array.from(employeeStandardTaskLinks.values())
                    .flat()
                    .find(emp => emp.id === employee.id);
                  const assignedTasksCount = employeeData?.standardTasks.length || 0;

                  return (
                    <div key={employee.id} className="border rounded-lg overflow-hidden">
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                        onClick={() => toggleEmployeeExpansion(employee.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium">{employee.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({assignedTasksCount} standaard taken)
                          </span>
                        </div>
                      </Button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-muted/20">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {standardTasks.map(task => {
                              const isAssigned = employeeData?.standardTasks.includes(task.id) || false;

                              return (
                                <label
                                  key={task.id}
                                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={() => handleToggleStandardTask(employee.id, task.id)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">{task.task_number} - {task.task_name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
});

WorkstationGanttChart.displayName = 'WorkstationGanttChart';

export default WorkstationGanttChart;
