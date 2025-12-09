import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  getDay,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus, ChevronDown, ChevronRight, User, Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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

const WorkstationGanttChart = forwardRef<WorkstationGanttChartRef, WorkstationGanttChartProps>(({ selectedDate }, ref) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [limitPhases, setLimitPhases] = useState<LimitPhase[]>([]);
  const [standardTasks, setStandardTasks] = useState<Array<{ id: string; task_name: string; task_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyAssignments, setDailyAssignments] = useState<DailyEmployeeAssignment[]>([]);
  const [employeeStandardTaskLinks, setEmployeeStandardTaskLinks] = useState<Map<string, Array<{ id: string; name: string; standardTasks: string[] }>>>(new Map());
  const [workstationEmployeeLinks, setWorkstationEmployeeLinks] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [generatingPlanning, setGeneratingPlanning] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 250;

  const scale = useMemo(() => {
    if (zoom >= 2) return { unitInMinutes: 15, unitWidth: 8 * zoom, totalUnits: (24 * 60 * 3) / 15, format: (d: Date) => format(d, 'HH:mm') };
    if (zoom >= 1) return { unitInMinutes: 60, unitWidth: 40 * zoom, totalUnits: 24 * 3, format: (d: Date) => format(d, 'HH:mm') };
    return { unitInMinutes: 1440, unitWidth: 120 * zoom, totalUnits: 10, format: (d: Date) => format(d, 'dd MMM') };
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
      
      const { data } = await supabase
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
        .order('due_date');
      const t = (data || []).map((d: any) => ({
        ...d,
        workstations: d.task_workstation_links?.map((x: any) => x.workstations).filter(Boolean) || [],
      }));
      setTasks(t);
      const { data: lp } = await supabase.from('standard_task_limit_phases').select('*');
      setLimitPhases(lp || []);
      setLoading(false);
    })();
  }, [selectedDate]);

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
  // OPTIMIZED PLANNING GENERATOR - Multi-pass algorithm with full constraint validation
  // ========================================================================================
  const handleGeneratePlanning = async () => {
    try {
      setGeneratingPlanning(true);
      console.log('🚀 Starting optimized planning generation...');
      
      // Fetch all projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, start_date, installation_date, status, client');
      
      if (projectsError) throw projectsError;
      
      const projectMap = new Map(projects?.map(p => [p.id, p]) || []);
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      const daysToSchedule = 60;
      
      // ===== DATA STRUCTURES =====
      // Employee capabilities: id -> { name, standardTasks[], workstations[] }
      const employeeCapabilities = new Map<string, { 
        id: string; 
        name: string; 
        standardTasks: string[]; 
        workstations: string[] 
      }>();
      
      // Build employee capabilities from both links
      employeeStandardTaskLinks.forEach((employees) => {
        employees.forEach(emp => {
          if (!employeeCapabilities.has(emp.id)) {
            const linkedWorkstations: string[] = [];
            workstations.forEach(ws => {
              const links = workstationEmployeeLinks.get(ws.id) || [];
              if (links.some(e => e.id === emp.id)) {
                linkedWorkstations.push(ws.id);
              }
            });
            
            employeeCapabilities.set(emp.id, {
              id: emp.id,
              name: emp.name,
              standardTasks: [...emp.standardTasks],
              workstations: linkedWorkstations
            });
          }
        });
      });
      
      // Workstation capacity limits (max parallel tasks = active_workers)
      const workstationCapacity = new Map<string, number>();
      workstations.forEach(ws => {
        workstationCapacity.set(ws.id, ws.active_workers || 1);
      });
      
      // Scheduling state structures
      type TimeSlot = { start: Date; end: Date; taskId: string; workstationId: string };
      type DaySchedule = Map<string, TimeSlot[]>; // employeeId -> slots
      const masterSchedule = new Map<string, DaySchedule>(); // date -> DaySchedule
      
      // Workstation usage per time slot (for capacity validation)
      type WorkstationSlot = { start: Date; end: Date; employeeId: string; taskId: string };
      const workstationSchedule = new Map<string, Map<string, WorkstationSlot[]>>(); // date -> workstationId -> slots
      
      const scheduledTasks = new Set<string>();
      const taskEndTimes = new Map<string, Date>();
      const taskAssignments = new Map<string, { employeeId: string; workstationId: string; date: string }>();
      const newAssignments: DailyEmployeeAssignment[] = [];
      
      // ===== HELPER FUNCTIONS =====
      
      // Get priority score for a task (higher = more urgent)
      const getTaskPriorityScore = (task: Task): number => {
        const project = projectMap.get(task.phases?.projects?.id || '');
        if (!project) return -2000;
        if (project.start_date > today) return -1000; // Project not started
        
        let score = 0;
        
        // Installation urgency (40% weight)
        const daysUntilInstallation = differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60);
        score += Math.max(0, 100 - daysUntilInstallation) * 0.4;
        
        // Project status (25% weight)
        if (project.status === 'in_progress') score += 50 * 0.25;
        else if (project.status === 'planned') score += 30 * 0.25;
        else if (project.status === 'on_hold') score -= 20 * 0.25;
        
        // Task priority (20% weight)
        if (task.priority === 'high') score += 40 * 0.2;
        else if (task.priority === 'medium') score += 20 * 0.2;
        else if (task.priority === 'low') score += 5 * 0.2;
        
        // Due date urgency (15% weight)
        const daysUntilDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
        score += Math.max(0, 50 - daysUntilDue) * 0.15;
        
        return score;
      };
      
      // Check if workstation has capacity at a given time slot
      const hasWorkstationCapacity = (workstationId: string, dateStr: string, start: Date, end: Date): boolean => {
        const capacity = workstationCapacity.get(workstationId) || 1;
        const dayWsSchedule = workstationSchedule.get(dateStr)?.get(workstationId) || [];
        
        // Count concurrent tasks at any point in the time range
        let maxConcurrent = 0;
        const allTimes = new Set<number>();
        dayWsSchedule.forEach(slot => {
          allTimes.add(slot.start.getTime());
          allTimes.add(slot.end.getTime());
        });
        allTimes.add(start.getTime());
        allTimes.add(end.getTime());
        
        const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
        for (const time of sortedTimes) {
          const timePoint = new Date(time);
          if (timePoint < start || timePoint >= end) continue;
          
          let concurrent = 1; // The new task
          for (const slot of dayWsSchedule) {
            if (timePoint >= slot.start && timePoint < slot.end) {
              concurrent++;
            }
          }
          maxConcurrent = Math.max(maxConcurrent, concurrent);
        }
        
        return maxConcurrent <= capacity;
      };
      
      // Get employee's current workload on a date (in minutes)
      const getEmployeeWorkload = (employeeId: string, dateStr: string): number => {
        const daySchedule = masterSchedule.get(dateStr);
        if (!daySchedule) return 0;
        
        const empSlots = daySchedule.get(employeeId) || [];
        return empSlots.reduce((sum, slot) => sum + differenceInMinutes(slot.end, slot.start), 0);
      };
      
      // Find first available time slot for an employee on a date
      const findAvailableSlotOnDate = (
        employeeId: string, 
        dateStr: string, 
        duration: number, 
        minStart: Date,
        workstationId: string
      ): { start: Date; end: Date }[] | null => {
        const date = new Date(dateStr);
        const workHoursForDate = getWorkHours(date);
        if (!workHoursForDate) return null;
        
        const daySchedule = masterSchedule.get(dateStr);
        const empSlots = daySchedule?.get(employeeId) || [];
        const sortedSlots = [...empSlots].sort((a, b) => a.start.getTime() - b.start.getTime());
        
        let candidateStart = minStart < workHoursForDate.start ? workHoursForDate.start : minStart;
        if (candidateStart < workHoursForDate.start) candidateStart = workHoursForDate.start;
        
        // Try each gap between existing slots
        for (let i = 0; i <= sortedSlots.length; i++) {
          const gapEnd = i < sortedSlots.length ? sortedSlots[i].start : workHoursForDate.end;
          
          if (candidateStart >= gapEnd) {
            if (i < sortedSlots.length) candidateStart = sortedSlots[i].end;
            continue;
          }
          
          const availableMinutes = differenceInMinutes(gapEnd, candidateStart);
          if (availableMinutes >= duration) {
            // Check workstation capacity for this slot
            const potentialEnd = addMinutes(candidateStart, duration);
            if (hasWorkstationCapacity(workstationId, dateStr, candidateStart, potentialEnd)) {
              const slots = getTaskSlots(candidateStart, duration);
              if (slots.length > 0) {
                return slots;
              }
            }
          }
          
          if (i < sortedSlots.length) {
            candidateStart = sortedSlots[i].end;
          }
        }
        
        return null;
      };
      
      // Schedule a task to an employee
      const scheduleTask = (
        task: Task, 
        employeeId: string, 
        workstationId: string, 
        dateStr: string, 
        slots: { start: Date; end: Date }[]
      ): boolean => {
        // Initialize data structures if needed
        if (!masterSchedule.has(dateStr)) {
          masterSchedule.set(dateStr, new Map());
        }
        const daySchedule = masterSchedule.get(dateStr)!;
        if (!daySchedule.has(employeeId)) {
          daySchedule.set(employeeId, []);
        }
        
        if (!workstationSchedule.has(dateStr)) {
          workstationSchedule.set(dateStr, new Map());
        }
        const dayWsSchedule = workstationSchedule.get(dateStr)!;
        if (!dayWsSchedule.has(workstationId)) {
          dayWsSchedule.set(workstationId, []);
        }
        
        // Add slots to employee schedule
        const empSlots = daySchedule.get(employeeId)!;
        for (const slot of slots) {
          empSlots.push({ 
            start: slot.start, 
            end: slot.end, 
            taskId: task.id, 
            workstationId 
          });
        }
        
        // Add to workstation schedule
        const wsSlots = dayWsSchedule.get(workstationId)!;
        for (const slot of slots) {
          wsSlots.push({ 
            start: slot.start, 
            end: slot.end, 
            employeeId, 
            taskId: task.id 
          });
        }
        
        // Track task completion
        const lastSlot = slots[slots.length - 1];
        taskEndTimes.set(task.id, lastSlot.end);
        scheduledTasks.add(task.id);
        taskAssignments.set(task.id, { employeeId, workstationId, date: dateStr });
        
        return true;
      };
      
      // ===== PREPARE TASKS =====
      const validTasks = tasks.filter(t => {
        const project = projectMap.get(t.phases?.projects?.id || '');
        if (!project) return false;
        if (project.start_date > today) return false;
        if (t.status !== 'TODO' && t.status !== 'HOLD') return false;
        if (!t.standard_task_id) return false;
        return true;
      });
      
      const sortedTasks = [...validTasks].sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      
      const todoTasks = sortedTasks.filter(t => t.status === 'TODO');
      const holdTasks = sortedTasks.filter(t => t.status === 'HOLD');
      const unassignedTasks: Task[] = [];
      
      console.log(`📋 Tasks to schedule: ${todoTasks.length} TODO, ${holdTasks.length} HOLD`);
      
      // ===== PHASE 1: Schedule TODO tasks with load balancing =====
      console.log('📅 PHASE 1: Scheduling TODO tasks...');
      
      for (const task of todoTasks) {
        // Find eligible employees
        const eligibleEmployees = Array.from(employeeCapabilities.values()).filter(emp => 
          emp.standardTasks.includes(task.standard_task_id!)
        );
        
        if (eligibleEmployees.length === 0) {
          unassignedTasks.push(task);
          continue;
        }
        
        // Determine which workstations this task can use
        const taskWorkstationIds = task.workstations?.map(w => w.id) || [];
        
        let taskScheduled = false;
        
        // Try each day until task is scheduled
        for (let dayOffset = 0; dayOffset < daysToSchedule && !taskScheduled; dayOffset++) {
          const currentDate = addDays(timelineStart, dayOffset);
          if (!isWorkingDay(currentDate)) continue;
          
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const workHoursForDay = getWorkHours(currentDate);
          if (!workHoursForDay) continue;
          
          const totalDayMinutes = differenceInMinutes(workHoursForDay.end, workHoursForDay.start);
          
          // Score employees for this day (prefer load balancing)
          const employeeScores = eligibleEmployees.map(emp => {
            const currentWorkload = getEmployeeWorkload(emp.id, dateStr);
            const utilizationRate = currentWorkload / totalDayMinutes;
            
            // Prefer employees with lower utilization
            let score = 1000 - (utilizationRate * 1000);
            
            // Bonus for employees already at a compatible workstation
            const daySchedule = masterSchedule.get(dateStr);
            const empSlots = daySchedule?.get(emp.id) || [];
            const currentWorkstations = new Set(empSlots.map(s => s.workstationId));
            
            for (const wsId of taskWorkstationIds) {
              if (currentWorkstations.has(wsId) && emp.workstations.includes(wsId)) {
                score += 200; // Minimize switching
                break;
              }
            }
            
            // Bonus for employees linked to task workstations
            for (const wsId of taskWorkstationIds) {
              if (emp.workstations.includes(wsId)) {
                score += 100;
                break;
              }
            }
            
            return { employee: emp, score };
          }).sort((a, b) => b.score - a.score);
          
          // Try each employee in order of preference
          for (const { employee } of employeeScores) {
            // Determine workstation (prefer one employee is already at)
            let targetWorkstation: string | null = null;
            const daySchedule = masterSchedule.get(dateStr);
            const empSlots = daySchedule?.get(employee.id) || [];
            const currentWsSet = new Set(empSlots.map(s => s.workstationId));
            
            // First, try to use a workstation employee is already at today
            for (const wsId of taskWorkstationIds) {
              if (currentWsSet.has(wsId) && employee.workstations.includes(wsId)) {
                targetWorkstation = wsId;
                break;
              }
            }
            
            // Otherwise, use first compatible workstation
            if (!targetWorkstation) {
              for (const wsId of taskWorkstationIds) {
                if (employee.workstations.includes(wsId)) {
                  targetWorkstation = wsId;
                  break;
                }
              }
            }
            
            if (!targetWorkstation) continue;
            
            // Find available slot
            const slots = findAvailableSlotOnDate(
              employee.id, 
              dateStr, 
              task.duration, 
              workHoursForDay.start,
              targetWorkstation
            );
            
            if (slots && slots.length > 0) {
              scheduleTask(task, employee.id, targetWorkstation, dateStr, slots);
              taskScheduled = true;
              break;
            }
          }
        }
        
        if (!taskScheduled) {
          unassignedTasks.push(task);
        }
      }
      
      console.log(`✅ PHASE 1 Complete: ${scheduledTasks.size} tasks scheduled`);
      
      // ===== PHASE 2: Schedule HOLD tasks (dependency-aware) =====
      console.log('📅 PHASE 2: Scheduling HOLD tasks with dependencies...');
      
      const remainingHold = new Set(holdTasks.map(t => t.id));
      let iterations = 0;
      const maxIterations = holdTasks.length * 10;
      
      while (remainingHold.size > 0 && iterations < maxIterations) {
        iterations++;
        let progressMade = false;
        
        for (const task of holdTasks) {
          if (!remainingHold.has(task.id)) continue;
          if (scheduledTasks.has(task.id)) {
            remainingHold.delete(task.id);
            continue;
          }
          
          // Check dependencies
          const dependencyEnd = getRequiredDependencyEndForTask(task, taskEndTimes);
          if (dependencyEnd === null) continue; // Dependencies not yet scheduled
          
          // Find eligible employees
          const eligibleEmployees = Array.from(employeeCapabilities.values()).filter(emp => 
            emp.standardTasks.includes(task.standard_task_id!)
          );
          
          if (eligibleEmployees.length === 0) {
            remainingHold.delete(task.id);
            unassignedTasks.push(task);
            continue;
          }
          
          const taskWorkstationIds = task.workstations?.map(w => w.id) || [];
          let taskScheduled = false;
          
          // Find earliest date we can schedule (after dependency end)
          const minStartDate = dependencyEnd > timelineStart ? dependencyEnd : timelineStart;
          const startDayOffset = Math.max(0, Math.floor(differenceInMinutes(minStartDate, timelineStart) / (24 * 60)));
          
          for (let dayOffset = startDayOffset; dayOffset < daysToSchedule && !taskScheduled; dayOffset++) {
            const currentDate = addDays(timelineStart, dayOffset);
            if (!isWorkingDay(currentDate)) continue;
            
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const workHoursForDay = getWorkHours(currentDate);
            if (!workHoursForDay) continue;
            
            const minStart = dependencyEnd > workHoursForDay.start ? dependencyEnd : workHoursForDay.start;
            
            // Try each eligible employee
            for (const employee of eligibleEmployees) {
              let targetWorkstation: string | null = null;
              
              for (const wsId of taskWorkstationIds) {
                if (employee.workstations.includes(wsId)) {
                  targetWorkstation = wsId;
                  break;
                }
              }
              
              if (!targetWorkstation) continue;
              
              const slots = findAvailableSlotOnDate(
                employee.id, 
                dateStr, 
                task.duration, 
                minStart,
                targetWorkstation
              );
              
              if (slots && slots.length > 0) {
                scheduleTask(task, employee.id, targetWorkstation, dateStr, slots);
                taskScheduled = true;
                progressMade = true;
                remainingHold.delete(task.id);
                break;
              }
            }
          }
          
          if (!taskScheduled && iterations >= holdTasks.length * 5) {
            remainingHold.delete(task.id);
            unassignedTasks.push(task);
          }
        }
        
        if (!progressMade && iterations > holdTasks.length) break;
      }
      
      console.log(`✅ PHASE 2 Complete: ${scheduledTasks.size} total tasks scheduled`);
      
      // ===== PHASE 3: Gap-filling optimization =====
      console.log('📅 PHASE 3: Filling gaps in schedule...');
      
      // Try to reschedule unassigned tasks into any available gaps
      const stillUnassigned = [...unassignedTasks];
      unassignedTasks.length = 0;
      
      for (const task of stillUnassigned) {
        if (scheduledTasks.has(task.id)) continue;
        
        const eligibleEmployees = Array.from(employeeCapabilities.values()).filter(emp => 
          emp.standardTasks.includes(task.standard_task_id!)
        );
        
        if (eligibleEmployees.length === 0) {
          unassignedTasks.push(task);
          continue;
        }
        
        const taskWorkstationIds = task.workstations?.map(w => w.id) || [];
        let taskScheduled = false;
        
        for (let dayOffset = 0; dayOffset < daysToSchedule && !taskScheduled; dayOffset++) {
          const currentDate = addDays(timelineStart, dayOffset);
          if (!isWorkingDay(currentDate)) continue;
          
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const workHoursForDay = getWorkHours(currentDate);
          if (!workHoursForDay) continue;
          
          for (const employee of eligibleEmployees) {
            let targetWorkstation: string | null = null;
            
            for (const wsId of taskWorkstationIds) {
              if (employee.workstations.includes(wsId)) {
                targetWorkstation = wsId;
                break;
              }
            }
            
            if (!targetWorkstation) continue;
            
            const slots = findAvailableSlotOnDate(
              employee.id, 
              dateStr, 
              task.duration, 
              workHoursForDay.start,
              targetWorkstation
            );
            
            if (slots && slots.length > 0) {
              scheduleTask(task, employee.id, targetWorkstation, dateStr, slots);
              taskScheduled = true;
              break;
            }
          }
        }
        
        if (!taskScheduled) {
          unassignedTasks.push(task);
        }
      }
      
      console.log(`✅ PHASE 3 Complete: ${scheduledTasks.size} total tasks scheduled`);
      
      // ===== PHASE 4: Validation =====
      console.log('🔍 PHASE 4: Validating schedule...');
      
      let validationErrors = 0;
      
      // Validate no employee overlaps
      masterSchedule.forEach((daySchedule, dateStr) => {
        daySchedule.forEach((slots, employeeId) => {
          const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
          for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].end > sorted[i + 1].start) {
              console.error(`❌ Employee overlap: ${employeeId} on ${dateStr}`);
              validationErrors++;
            }
          }
        });
      });
      
      // Validate workstation capacity
      workstationSchedule.forEach((dayWsSchedule, dateStr) => {
        dayWsSchedule.forEach((slots, workstationId) => {
          const capacity = workstationCapacity.get(workstationId) || 1;
          
          // Check each time point
          const allTimes = new Set<number>();
          slots.forEach(slot => {
            allTimes.add(slot.start.getTime());
            allTimes.add(slot.end.getTime());
          });
          
          const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
          for (const time of sortedTimes) {
            const timePoint = new Date(time);
            let concurrent = 0;
            for (const slot of slots) {
              if (timePoint >= slot.start && timePoint < slot.end) {
                concurrent++;
              }
            }
            if (concurrent > capacity) {
              console.error(`❌ Workstation over-capacity: ${workstationId} on ${dateStr} (${concurrent}/${capacity})`);
              validationErrors++;
            }
          }
        });
      });
      
      console.log(validationErrors === 0 ? '✅ Validation passed!' : `⚠️ ${validationErrors} validation errors`);
      
      // ===== PHASE 5: Build daily assignments for UI =====
      console.log('🎨 PHASE 5: Building UI assignments...');
      
      const employeeWorkstationDays = new Map<string, Set<string>>(); // "date|workstationId" -> Set<employeeId>
      
      taskAssignments.forEach(({ employeeId, workstationId, date }) => {
        const key = `${date}|${workstationId}`;
        if (!employeeWorkstationDays.has(key)) {
          employeeWorkstationDays.set(key, new Set());
        }
        employeeWorkstationDays.get(key)!.add(employeeId);
      });
      
      employeeWorkstationDays.forEach((employees, key) => {
        const [date, workstationId] = key.split('|');
        const employeeList = Array.from(employees);
        
        employeeList.forEach((employeeId, index) => {
          const emp = employeeCapabilities.get(employeeId);
          if (emp) {
            newAssignments.push({
              date,
              workstationId,
              workerIndex: index,
              employeeId,
              employeeName: emp.name,
            });
          }
        });
      });
      
      // ===== FINAL STATS =====
      console.log('📊 ===== SCHEDULING STATISTICS =====');
      console.log(`✅ Scheduled: ${scheduledTasks.size} tasks`);
      console.log(`❌ Unassigned: ${unassignedTasks.length} tasks`);
      console.log(`👥 Employees assigned: ${new Set(Array.from(taskAssignments.values()).map(a => a.employeeId)).size}`);
      console.log(`📅 Days with tasks: ${masterSchedule.size}`);
      
      // Calculate utilization
      let totalCapacityMinutes = 0;
      let totalUsedMinutes = 0;
      
      masterSchedule.forEach((daySchedule, dateStr) => {
        const workHoursForDay = getWorkHours(new Date(dateStr));
        if (!workHoursForDay) return;
        
        const dayMinutes = differenceInMinutes(workHoursForDay.end, workHoursForDay.start);
        daySchedule.forEach((slots) => {
          totalCapacityMinutes += dayMinutes;
          totalUsedMinutes += slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
        });
      });
      
      const utilizationRate = totalCapacityMinutes > 0 ? (totalUsedMinutes / totalCapacityMinutes * 100).toFixed(1) : 0;
      console.log(`📈 Average utilization: ${utilizationRate}%`);
      
      if (unassignedTasks.length > 0) {
        console.warn('⚠️ Unassigned tasks:', unassignedTasks.map(t => ({
          title: t.title,
          standardTask: t.standard_task_id,
          workstations: t.workstations?.map(w => w.name).join(', '),
          reason: 'No eligible employee or available slot'
        })));
      }
      
      setDailyAssignments(newAssignments);
      toast.success(`Planning geoptimaliseerd: ${scheduledTasks.size} taken, ${utilizationRate}% benutting`);
      setScheduleGenerated(true);
      
    } catch (error) {
      console.error('Generate planning error:', error);
      toast.error('Fout bij het genereren van planning');
    } finally {
      setGeneratingPlanning(false);
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

      // Add to workstation rendering (choose first workstation employee is linked to that task uses)
      let targetWorkstation: string | null = null;
      for (const taskWs of task.workstations || []) {
        if (employee.workstations.includes(taskWs.id)) {
          targetWorkstation = taskWs.id;
          break;
        }
      }
      
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

      // Score each employee based on current workload and capability
      const employeeScores = eligibleEmployees.map(emp => {
        const empSchedule = employeeSchedules.get(emp.id) || [];
        const currentWorkload = empSchedule.reduce((sum, s) => 
          sum + differenceInMinutes(s.end, s.start), 0
        );
        
        // Prefer less loaded employees
        const workloadScore = 10000 - currentWorkload;
        
        // Prefer employees working at task's workstations
        const workstationMatchScore = task.workstations?.some(taskWs => 
          emp.workstations.includes(taskWs.id)
        ) ? 1000 : 0;
        
        return {
          employee: emp,
          score: workloadScore + workstationMatchScore
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
  }, [tasks, workstations, selectedDate, workingHoursMap, holidaySet, limitTaskMap, searchTerm, dailyAssignments, workstationEmployeeLinks, employeeStandardTaskLinks, scheduleGenerated]);

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
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <CardTitle>Workstation Gantt Chart (Slim Gepland)</CardTitle>
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
        <div className="flex gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: 'hsl(220, 80%, 40%)' }}></div>
            <span>🔴 Hoge prioriteit / Urgent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: 'hsl(220, 65%, 45%)' }}></div>
            <span>🟢 Actief project</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: 'hsl(220, 45%, 55%)' }}></div>
            <span>🟠 Geblokkeerd (HOLD)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: 'hsl(220, 30%, 60%)' }}></div>
            <span>⚪ Toekomstig project</span>
          </div>
        </div>
        {dailyAssignments.length > 0 && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-xs">
            ✅ <strong>{new Set(dailyAssignments.map(a => a.employeeId)).size}</strong> werknemers toegewezen over{' '}
            <strong>{new Set(dailyAssignments.map(a => a.date)).size}</strong> dagen met optimale werkverdeling
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="overflow-auto border rounded-lg" style={{ maxHeight: 600 }}>
          {/* header */}
          <div
            className="sticky top-0 z-10 flex border-b bg-muted"
            style={{ marginLeft: workstationLabelWidth, height: headerHeight }}
          >
            {timeline.map((t, i) => (
              <div key={i} style={{ width: scale.unitWidth }} className="flex flex-col justify-center items-center border-r text-xs">
                {scale.format(t)}
              </div>
            ))}
          </div>

          {/* rows */}
          {workstations.map((ws) => {
            const workerMap = schedule.get(ws.id);
            if (!workerMap) return null;
            
            const workerCount = ws.active_workers || 1;
            const totalHeight = rowHeight * workerCount;
            
            return (
              <div key={ws.id} className="relative border-b" style={{ height: totalHeight }}>
                <div
                  className="absolute left-0 top-0 bottom-0 flex flex-col border-r bg-muted"
                  style={{ width: workstationLabelWidth }}
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
                    const laneTop = workerIndex * rowHeight;
                    
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
                
                {/* Render each worker lane */}
                {Array.from({ length: workerCount }).map((_, workerIndex) => {
                  const tasks = workerMap.get(workerIndex) || [];
                  const laneTop = workerIndex * rowHeight;
                  
                  return (
                    <div
                      key={workerIndex}
                      className="absolute"
                      style={{
                        left: workstationLabelWidth,
                        right: 0,
                        top: laneTop,
                        height: rowHeight,
                        borderTop: workerIndex > 0 ? '1px dashed hsl(var(--border) / 0.3)' : undefined
                      }}
                    >
                      {timeline.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-r border-border/40" style={{ left: i * scale.unitWidth }} />
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
                                    width,
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
                  <div className="text-2xl font-bold text-green-600">{uniqueEmployees.length}</div>
                  <div className="text-xs text-muted-foreground">Toegewezen werknemers</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">
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
  );
});

WorkstationGanttChart.displayName = 'WorkstationGanttChart';

export default WorkstationGanttChart;
