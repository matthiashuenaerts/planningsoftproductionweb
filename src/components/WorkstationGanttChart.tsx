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
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyAssignments, setDailyAssignments] = useState<DailyEmployeeAssignment[]>([]);
  const [workstationEmployeeLinks, setWorkstationEmployeeLinks] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showCriticalPath, setShowCriticalPath] = useState(false);
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
      
      // Fetch workstation-employee links
      const linksMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const workstation of ws || []) {
        const employees = await workstationService.getEmployeesForWorkstation(workstation.id);
        linksMap.set(workstation.id, employees);
      }
      setWorkstationEmployeeLinks(linksMap);
      
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

  // Smart auto-assign employees with project prioritization
  // Algorithm optimizes for fastest completion by:
  // 1. Only scheduling projects where start_date <= today
  // 2. Prioritizing by installation urgency
  // 3. Assigning workers to same workstation throughout period
  // 4. Ensuring all tasks have workers assigned
  const handleAutoAssign = () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      
      // Calculate total workload per workstation across all active projects
      const workstationWorkloads = new Map<string, {
        totalMinutes: number;
        priorityScore: number;
        taskCount: number;
        workstation: Workstation;
      }>();

      // Analyze schedule to calculate workload
      workstations.forEach((ws) => {
        const workerMap = schedule.get(ws.id);
        if (!workerMap) return;

        let totalMinutes = 0;
        let totalPriorityScore = 0;
        let taskCount = 0;

        workerMap.forEach((tasks) => {
          tasks.forEach(({ task, start, end }) => {
            const project = task.phases?.projects;
            if (!project) return;

            // Only count tasks from projects that have started
            if (project.start_date > today) return;

            const minutes = differenceInMinutes(end, start);
            
            // Calculate priority score
            let score = 0;
            const daysUntilInstallation = differenceInMinutes(
              new Date(project.installation_date), 
              new Date()
            ) / (24 * 60);
            score += Math.max(0, 100 - daysUntilInstallation);
            
            if (project.status === 'in_progress') score += 50;
            else if (project.status === 'planned') score += 30;
            
            if (task.priority === 'high') score += 30;
            else if (task.priority === 'medium') score += 15;
            
            if (score > 0) {
              totalMinutes += minutes;
              totalPriorityScore += score * minutes;
              taskCount++;
            }
          });
        });

        if (taskCount > 0) {
          workstationWorkloads.set(ws.id, {
            totalMinutes,
            priorityScore: totalPriorityScore / totalMinutes,
            taskCount,
            workstation: ws,
          });
        }
      });

      // Sort workstations by priority and workload
      const sortedWorkstations = Array.from(workstationWorkloads.values())
        .sort((a, b) => {
          const priorityDiff = b.priorityScore - a.priorityScore;
          return priorityDiff !== 0 ? priorityDiff : b.totalMinutes - a.totalMinutes;
        });

      // Track which employees are globally assigned
      const globalAssignedEmployees = new Set<string>();
      const workstationEmployeeAssignments = new Map<string, Array<{ id: string; name: string }>>();

      // Assign employees to workstations for entire planning period
      sortedWorkstations.forEach(({ workstation, totalMinutes }) => {
        const linkedEmployees = workstationEmployeeLinks.get(workstation.id) || [];
        const availableEmployees = linkedEmployees.filter((emp) => !globalAssignedEmployees.has(emp.id));

        // Calculate optimal worker count based on workload
        const avgWorkdayMinutes = 8 * 60; // 8 hour workday
        const planningDays = 30;
        const totalAvailableMinutes = avgWorkdayMinutes * planningDays;
        const optimalWorkers = Math.ceil(totalMinutes / totalAvailableMinutes);
        const workersNeeded = Math.min(
          optimalWorkers,
          workstation.active_workers,
          availableEmployees.length
        );

        const assignedToWorkstation: Array<{ id: string; name: string }> = [];
        
        for (let i = 0; i < workersNeeded; i++) {
          if (availableEmployees[i]) {
            assignedToWorkstation.push(availableEmployees[i]);
            globalAssignedEmployees.add(availableEmployees[i].id);
          }
        }

        workstationEmployeeAssignments.set(workstation.id, assignedToWorkstation);
      });

      // Generate daily assignments for next 30 days, keeping workers in same workstation
      const newAssignments: DailyEmployeeAssignment[] = [];
      const daysToOptimize = 30;
      
      for (let dayOffset = 0; dayOffset < daysToOptimize; dayOffset++) {
        const date = addDays(timelineStart, dayOffset);
        if (!isWorkingDay(date)) continue;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Assign the same workers to their workstations every day
        workstationEmployeeAssignments.forEach((employees, workstationId) => {
          employees.forEach((employee, workerIndex) => {
            newAssignments.push({
              date: dateStr,
              workstationId,
              workerIndex,
              employeeId: employee.id,
              employeeName: employee.name,
            });
          });
        });
      }

      setDailyAssignments(newAssignments);
      
      const totalAssigned = globalAssignedEmployees.size;
      toast.success(`${totalAssigned} werknemers toegewezen aan werkstations voor optimale planning`);
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

  // Expose data via ref for external access
  useImperativeHandle(ref, () => ({
    getDailyAssignments: () => dailyAssignments,
    getSchedule: () => schedule,
    getTasks: () => tasks,
    getWorkstations: () => workstations,
  }));

  // memoize full schedule for all workstations with multi-worker support and dependency resolution
  const schedule = useMemo(() => {
    // Map: workstationId -> workerIndex -> tasks
    const all = new Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>();
    // Map: workstationId -> array of cursors (one per worker)
    const workstationCursors = new Map<string, Date[]>();
    const scheduledTaskEndTimes = new Map<string, Date>(); // Track when each task ends
    const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);

    // Initialize cursors for all workstations (one cursor per active worker)
    workstations.forEach((ws) => {
      const workerCount = ws.active_workers || 1;
      const cursors = Array(workerCount).fill(timelineStart);
      workstationCursors.set(ws.id, cursors);
      
      const workerMap = new Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
      for (let i = 0; i < workerCount; i++) {
        workerMap.set(i, []);
      }
      all.set(ws.id, workerMap);
    });

    // Separate TODO and HOLD tasks with smart prioritization
    const getTaskPriorityScore = (task: Task): number => {
      const project = task.phases?.projects;
      if (!project) return 0;

      const today = format(new Date(), 'yyyy-MM-dd');
      let score = 0;
      
      // Skip future projects
      if (project.start_date > today) return -1000;
      
      // Installation urgency
      const daysUntilInstallation = differenceInMinutes(
        new Date(project.installation_date), 
        new Date()
      ) / (24 * 60);
      score += Math.max(0, 100 - daysUntilInstallation);
      
      // Project status
      if (project.status === 'in_progress') score += 50;
      else if (project.status === 'planned') score += 30;
      else if (project.status === 'on_hold') score -= 20;
      
      // Task priority
      if (task.priority === 'high') score += 30;
      else if (task.priority === 'medium') score += 15;
      else if (task.priority === 'low') score += 5;
      
      // Task due date urgency
      const daysUntilDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
      score += Math.max(0, 50 - daysUntilDue);
      
      return score;
    };

    const todoTasks = tasks
      .filter((t) => t.status === 'TODO' && t.workstations && t.workstations.length > 0)
      .sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime(); // Then by due date
      });

    const holdTasks = tasks
      .filter((t) => t.status === 'HOLD' && t.workstations && t.workstations.length > 0)
      .sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    // Check if task matches search filter
    const isTaskVisible = (task: Task) => {
      if (!searchTerm) return true;
      return task.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    };

    // PHASE 1: Schedule all TODO tasks first (by urgency)
    for (const task of todoTasks) {
      const isVisible = isTaskVisible(task);

      // Schedule on all assigned workstations
      let latestEndTime: Date | null = null;

      for (const ws of task.workstations || []) {
        const cursors = workstationCursors.get(ws.id) || [timelineStart];
        const workerMap = all.get(ws.id)!;
        
        // Find the worker with the earliest cursor
        let earliestWorkerIndex = 0;
        let earliestTime = cursors[0];
        for (let i = 1; i < cursors.length; i++) {
          if (cursors[i] < earliestTime) {
            earliestTime = cursors[i];
            earliestWorkerIndex = i;
          }
        }
        
        const slots = getTaskSlots(cursors[earliestWorkerIndex], task.duration);

        if (slots.length > 0) {
          const taskList = workerMap.get(earliestWorkerIndex) || [];
          slots.forEach((s) => taskList.push({ task, ...s, isVisible }));
          workerMap.set(earliestWorkerIndex, taskList);

          // Update cursor to end of this task for this worker
          const lastSlot = slots[slots.length - 1];
          cursors[earliestWorkerIndex] = lastSlot.end;
          workstationCursors.set(ws.id, cursors);

          // Track the latest end time across all workstations
          if (!latestEndTime || lastSlot.end > latestEndTime) {
            latestEndTime = lastSlot.end;
          }
        }
      }

      // Store the end time for dependency checking
      if (latestEndTime) {
        scheduledTaskEndTimes.set(task.id, latestEndTime);
      }
    }

    // PHASE 2: Schedule HOLD tasks with limit phase checking
    const remainingHoldTasks = new Set(holdTasks.map((t) => t.id));
    let maxIterations = holdTasks.length * 5;
    let iteration = 0;

    while (remainingHoldTasks.size > 0 && iteration < maxIterations) {
      iteration++;
      let scheduledInThisPass = false;

      for (const task of holdTasks) {
        if (!remainingHoldTasks.has(task.id)) continue;

        const isVisible = isTaskVisible(task);

        // Determine the earliest cursor among all workers in assigned workstations
        let earliestCursor: Date | null = null;
        for (const ws of task.workstations || []) {
          const cursors = workstationCursors.get(ws.id) || [timelineStart];
          const minCursor = Math.min(...cursors.map(c => c.getTime()));
          const minDate = new Date(minCursor);
          if (!earliestCursor || minDate < earliestCursor) earliestCursor = minDate;
        }
        if (!earliestCursor) earliestCursor = timelineStart;

        // Check dependency requirement
        const dependencyEnd = getRequiredDependencyEndForTask(task, scheduledTaskEndTimes);
        if (dependencyEnd === null) {
          continue;
        }

        // The actual start must be after both the earliest cursor and dependency end
        const earliestStart = dependencyEnd > earliestCursor ? dependencyEnd : earliestCursor;

        // Schedule on all assigned workstations
        let latestEndTime: Date | null = null;

        for (const ws of task.workstations || []) {
          const cursors = workstationCursors.get(ws.id) || [timelineStart];
          const workerMap = all.get(ws.id)!;
          
          // Find the worker with the earliest cursor >= earliestStart
          let bestWorkerIndex = 0;
          let bestTime = cursors[0] > earliestStart ? cursors[0] : earliestStart;
          for (let i = 1; i < cursors.length; i++) {
            const workerTime = cursors[i] > earliestStart ? cursors[i] : earliestStart;
            if (workerTime < bestTime) {
              bestTime = workerTime;
              bestWorkerIndex = i;
            }
          }
          
          const startCursor = cursors[bestWorkerIndex] > earliestStart ? cursors[bestWorkerIndex] : earliestStart;
          const slots = getTaskSlots(startCursor, task.duration);

          if (slots.length > 0) {
            const taskList = workerMap.get(bestWorkerIndex) || [];
            slots.forEach((s) => taskList.push({ task, ...s, isVisible }));
            workerMap.set(bestWorkerIndex, taskList);

            // Update cursor to end of this task for this worker
            const lastSlot = slots[slots.length - 1];
            cursors[bestWorkerIndex] = lastSlot.end;
            workstationCursors.set(ws.id, cursors);

            // Track the latest end time
            if (!latestEndTime || lastSlot.end > latestEndTime) {
              latestEndTime = lastSlot.end;
            }
          }
        }

        // Store the end time for dependency checking
        if (latestEndTime) {
          scheduledTaskEndTimes.set(task.id, latestEndTime);
        }

        remainingHoldTasks.delete(task.id);
        scheduledInThisPass = true;
      }

      // If nothing was scheduled in this pass, break to prevent infinite loop
      if (!scheduledInThisPass) break;
    }

    return all;
  }, [tasks, workstations, selectedDate, workingHoursMap, holidaySet, limitTaskMap, searchTerm]);

  // Auto-assign on mount and when dependencies change
  useEffect(() => {
    if (workstations.length > 0 && workstationEmployeeLinks.size > 0 && schedule.size > 0) {
      handleAutoAssign();
    }
  }, [workstations, workstationEmployeeLinks, schedule]);

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
                  className="absolute left-0 top-0 bottom-0 flex flex-col justify-between border-r bg-muted px-3 py-2"
                  style={{ width: workstationLabelWidth }}
                >
                  <div className="flex items-center justify-between">
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
                  <div className="text-xs text-muted-foreground mt-2">
                    {workerCount} werker{workerCount !== 1 ? 's' : ''} (auto per dag)
                  </div>
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
      </CardContent>
    </Card>
  );
});

WorkstationGanttChart.displayName = 'WorkstationGanttChart';

export default WorkstationGanttChart;
