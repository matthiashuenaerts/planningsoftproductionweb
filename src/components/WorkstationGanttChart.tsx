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
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyAssignments, setDailyAssignments] = useState<DailyEmployeeAssignment[]>([]);
  const [workstationEmployeeLinks, setWorkstationEmployeeLinks] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [generatingPlanning, setGeneratingPlanning] = useState(false);
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

  // Generate comprehensive planning with task-to-employee assignments
  const handleGeneratePlanning = async () => {
    try {
      setGeneratingPlanning(true);
      
      // Fetch all projects to check start dates
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, start_date, installation_date, status, client');
      
      if (projectsError) throw projectsError;
      
      const projectMap = new Map(projects?.map(p => [p.id, p]) || []);
      const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Get all employees linked to workstations
      const allEmployees = new Map<string, { id: string; name: string; workstations: string[] }>();
      workstationEmployeeLinks.forEach((employees, workstationId) => {
        employees.forEach(emp => {
          if (!allEmployees.has(emp.id)) {
            allEmployees.set(emp.id, { id: emp.id, name: emp.name, workstations: [workstationId] });
          } else {
            allEmployees.get(emp.id)!.workstations.push(workstationId);
          }
        });
      });
      
      // Generate planning for next 60 days
      const daysToSchedule = 60;
      const newAssignments: DailyEmployeeAssignment[] = [];
      
      // Track employee schedules: employeeId -> date -> { start: Date, end: Date, workstationId: string }[]
      const employeeSchedules = new Map<string, Map<string, Array<{ start: Date; end: Date; workstationId: string; taskId: string }>>>();
      
      // Initialize employee schedules
      allEmployees.forEach((emp) => {
        employeeSchedules.set(emp.id, new Map());
      });
      
      // Task scheduling state
      const scheduledTasks = new Set<string>();
      const taskEndTimes = new Map<string, Date>();
      
      // Track workstation worker assignments per day
      const workstationDailyWorkers = new Map<string, Map<string, Set<string>>>(); // workstationId -> date -> Set<employeeId>
      
      // Helper: Get task priority score
      const getTaskPriorityScore = (task: Task): number => {
        const project = projectMap.get(task.phases?.projects?.id || '');
        if (!project) return -2000;
        
        // Critical: Don't schedule if project hasn't started
        if (project.start_date > today) return -1000;
        
        let score = 0;
        const daysUntilInstallation = differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60);
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
      
      // Sort tasks by priority, filtering out tasks from projects that haven't started
      const sortedTasks = [...tasks]
        .filter(t => {
          const project = projectMap.get(t.phases?.projects?.id || '');
          return project && project.start_date <= today && (t.status === 'TODO' || t.status === 'HOLD');
        })
        .sort((a, b) => {
          const scoreA = getTaskPriorityScore(a);
          const scoreB = getTaskPriorityScore(b);
          if (scoreA !== scoreB) return scoreB - scoreA;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
      
      // Schedule tasks day by day
      for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
        const currentDate = addDays(timelineStart, dayOffset);
        
        if (!isWorkingDay(currentDate)) continue;
        
        const workHours = getWorkHours(currentDate);
        if (!workHours) continue;
        
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // For each task, try to assign to best available employee
        for (const task of sortedTasks) {
          if (scheduledTasks.has(task.id)) continue;
          
          // Check dependencies for HOLD tasks
          if (task.status === 'HOLD') {
            const dependencyEnd = getRequiredDependencyEndForTask(task, taskEndTimes);
            if (dependencyEnd === null || dependencyEnd > currentDate) {
              continue; // Can't schedule yet
            }
          }
          
          // Find eligible employees for this task (those assigned to task's workstations)
          const eligibleEmployees = Array.from(allEmployees.values()).filter(emp =>
            task.workstations?.some(taskWs => emp.workstations.includes(taskWs.id))
          );
          
          if (eligibleEmployees.length === 0) continue;
          
          // Sort employees by:
          // 1. Current workload on this day (prefer less loaded)
          // 2. Number of workstation switches needed
          const employeeScores = eligibleEmployees.map(emp => {
            const empSchedule = employeeSchedules.get(emp.id)?.get(dateStr) || [];
            const currentWorkload = empSchedule.reduce((sum, slot) => 
              sum + differenceInMinutes(slot.end, slot.start), 0
            );
            
            // Check if employee is already at one of the task's workstations today
            const alreadyAtWorkstation = empSchedule.some(slot =>
              task.workstations?.some(taskWs => taskWs.id === slot.workstationId)
            );
            
            const workstationSwitchPenalty = alreadyAtWorkstation ? 0 : 100;
            
            return {
              employee: emp,
              score: -currentWorkload - workstationSwitchPenalty
            };
          }).sort((a, b) => b.score - a.score);
          
          // Try to assign to best employee
          let taskScheduled = false;
          for (const { employee } of employeeScores) {
            // Find available time slot for this employee
            const empSchedule = employeeSchedules.get(employee.id)?.get(dateStr) || [];
            
            // Check if employee has any availability left
            const workHours = getWorkHours(currentDate);
            if (!workHours) continue;
            
            const totalAvailableMinutes = differenceInMinutes(workHours.end, workHours.start);
            const usedMinutes = empSchedule.reduce((sum, slot) => 
              sum + differenceInMinutes(slot.end, slot.start), 0
            );
            
            if (usedMinutes >= totalAvailableMinutes) continue; // Employee is fully booked
            
            // Start from beginning of work day or after last task
            let candidateStart = workHours.start;
            
            // Sort existing slots by start time
            const sortedSlots = [...empSchedule].sort((a, b) => a.start.getTime() - b.start.getTime());
            
            // Find a gap that fits the task
            for (let i = 0; i <= sortedSlots.length; i++) {
              const slotEnd = i < sortedSlots.length ? sortedSlots[i].start : workHours.end;
              const availableMinutes = differenceInMinutes(slotEnd, candidateStart);
              
              if (availableMinutes >= task.duration) {
                // Found a slot!
                const taskSlots = getTaskSlots(candidateStart, task.duration);
                
                if (taskSlots.length > 0) {
                  // Choose workstation (prefer one employee is already at today)
                  let chosenWorkstation = task.workstations![0].id;
                  const currentWorkstations = new Set(empSchedule.map(slot => slot.workstationId));
                  for (const ws of task.workstations || []) {
                    if (currentWorkstations.has(ws.id)) {
                      chosenWorkstation = ws.id;
                      break;
                    }
                  }
                  
                  // Track employee assignment to workstation for this day
                  if (!workstationDailyWorkers.has(chosenWorkstation)) {
                    workstationDailyWorkers.set(chosenWorkstation, new Map());
                  }
                  const wsDateMap = workstationDailyWorkers.get(chosenWorkstation)!;
                  if (!wsDateMap.has(dateStr)) {
                    wsDateMap.set(dateStr, new Set());
                  }
                  const employeesAtWs = wsDateMap.get(dateStr)!;
                  
                  // Only add assignment if this is the first time we see this employee at this workstation today
                  if (!employeesAtWs.has(employee.id)) {
                    employeesAtWs.add(employee.id);
                    const workerIndex = Array.from(employeesAtWs).indexOf(employee.id);
                    
                    newAssignments.push({
                      date: dateStr,
                      workstationId: chosenWorkstation,
                      workerIndex,
                      employeeId: employee.id,
                      employeeName: employee.name,
                    });
                  }
                  
                  // Add to employee schedule
                  taskSlots.forEach(slot => {
                    if (!employeeSchedules.get(employee.id)!.has(format(slot.start, 'yyyy-MM-dd'))) {
                      employeeSchedules.get(employee.id)!.set(format(slot.start, 'yyyy-MM-dd'), []);
                    }
                    employeeSchedules.get(employee.id)!.get(format(slot.start, 'yyyy-MM-dd'))!.push({
                      start: slot.start,
                      end: slot.end,
                      workstationId: chosenWorkstation,
                      taskId: task.id
                    });
                  });
                  
                  const lastSlot = taskSlots[taskSlots.length - 1];
                  taskEndTimes.set(task.id, lastSlot.end);
                  scheduledTasks.add(task.id);
                  taskScheduled = true;
                  break;
                }
              }
              
              if (i < sortedSlots.length) {
                candidateStart = sortedSlots[i].end;
              }
            }
            
            if (taskScheduled) break;
          }
        }
      }
      
      // Update daily assignments to show on gantt chart
      setDailyAssignments(newAssignments);
      
      toast.success(`Planning gegenereerd: ${scheduledTasks.size} taken toegewezen voor ${daysToSchedule} dagen. Bekijk de Gantt chart voor details.`);
      
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

  // memoize full schedule for all workstations with multi-worker support and dependency resolution
  const schedule = useMemo(() => {
    // Map: workstationId -> workerIndex -> tasks
    const all = new Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>();
    // Map: workstationId -> workerIndex -> cursor time
    const workstationCursors = new Map<string, Date[]>();
    // Map: workstationId -> workerIndex -> employeeId (who is assigned to this worker slot)
    const workerAssignments = new Map<string, Map<number, string>>();
    // Track scheduled task end times for dependencies
    const scheduledTaskEndTimes = new Map<string, Date>();
    // Track unassigned tasks
    const unassignedTasks: Task[] = [];
    
    const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
    const today = format(new Date(), 'yyyy-MM-dd');

    // Helper: Get task priority score
    const getTaskPriorityScore = (task: Task): number => {
      const project = task.phases?.projects;
      if (!project) return 0;
      if (project.start_date > today) return -1000;
      
      let score = 0;
      const daysUntilInstallation = differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60);
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

    // Helper: Check if task matches search filter
    const isTaskVisible = (task: Task) => {
      if (!searchTerm) return true;
      return task.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    };

    // Helper: Get worker assignment for a specific date, workstation, and worker index
    const getWorkerAssignment = (date: Date, workstationId: string, workerIndex: number) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return dailyAssignments.find(
        a => a.date === dateStr && a.workstationId === workstationId && a.workerIndex === workerIndex
      );
    };

    // Helper: Check if employee is assigned to workstation
    const isEmployeeAssignedToWorkstation = (employeeId: string, workstationId: string) => {
      const links = workstationEmployeeLinks.get(workstationId) || [];
      return links.some(emp => emp.id === employeeId);
    };

    // Helper: Find best worker for task in workstation
    const findBestWorkerForTask = (
      workstationId: string, 
      task: Task, 
      minStartTime: Date
    ): { workerIndex: number; startTime: Date } | null => {
      const cursors = workstationCursors.get(workstationId);
      const assignments = workerAssignments.get(workstationId);
      if (!cursors || !assignments) return null;

      let bestWorkerIndex = -1;
      let bestStartTime: Date | null = null;

      for (let i = 0; i < cursors.length; i++) {
        const workerStartTime = cursors[i] > minStartTime ? cursors[i] : minStartTime;
        const assignment = getWorkerAssignment(workerStartTime, workstationId, i);
        
        // Check if this worker is assigned to this workstation
        if (assignment && isEmployeeAssignedToWorkstation(assignment.employeeId, workstationId)) {
          if (!bestStartTime || workerStartTime < bestStartTime) {
            bestStartTime = workerStartTime;
            bestWorkerIndex = i;
          }
        }
      }

      if (bestWorkerIndex === -1) {
        // Fallback: find earliest available worker even without assignment
        for (let i = 0; i < cursors.length; i++) {
          const workerStartTime = cursors[i] > minStartTime ? cursors[i] : minStartTime;
          if (!bestStartTime || workerStartTime < bestStartTime) {
            bestStartTime = workerStartTime;
            bestWorkerIndex = i;
          }
        }
      }

      return bestWorkerIndex >= 0 && bestStartTime ? { workerIndex: bestWorkerIndex, startTime: bestStartTime } : null;
    };

    // Initialize workstation structures
    workstations.forEach((ws) => {
      const workerCount = ws.active_workers || 1;
      const cursors = Array(workerCount).fill(timelineStart);
      workstationCursors.set(ws.id, cursors);
      
      const workerMap = new Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
      const assignmentMap = new Map<number, string>();
      
      for (let i = 0; i < workerCount; i++) {
        workerMap.set(i, []);
        const assignment = getWorkerAssignment(selectedDate, ws.id, i);
        if (assignment) {
          assignmentMap.set(i, assignment.employeeId);
        }
      }
      
      all.set(ws.id, workerMap);
      workerAssignments.set(ws.id, assignmentMap);
    });

    // Sort all tasks by priority
    const allTasks = [...tasks]
      .filter(t => (t.status === 'TODO' || t.status === 'HOLD') && t.workstations && t.workstations.length > 0)
      .sort((a, b) => {
        const scoreA = getTaskPriorityScore(a);
        const scoreB = getTaskPriorityScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    const todoTasks = allTasks.filter(t => t.status === 'TODO');
    const holdTasks = allTasks.filter(t => t.status === 'HOLD');

    // PHASE 1: Schedule TODO tasks
    for (const task of todoTasks) {
      const isVisible = isTaskVisible(task);
      let taskScheduled = false;
      let latestEndTime: Date | null = null;

      for (const ws of task.workstations || []) {
        const bestWorker = findBestWorkerForTask(ws.id, task, timelineStart);
        
        if (bestWorker) {
          const cursors = workstationCursors.get(ws.id)!;
          const workerMap = all.get(ws.id)!;
          const slots = getTaskSlots(bestWorker.startTime, task.duration);

          if (slots.length > 0) {
            const taskList = workerMap.get(bestWorker.workerIndex) || [];
            slots.forEach(s => taskList.push({ task, ...s, isVisible }));
            workerMap.set(bestWorker.workerIndex, taskList);

            const lastSlot = slots[slots.length - 1];
            cursors[bestWorker.workerIndex] = lastSlot.end;
            workstationCursors.set(ws.id, cursors);

            if (!latestEndTime || lastSlot.end > latestEndTime) {
              latestEndTime = lastSlot.end;
            }
            taskScheduled = true;
          }
        }
      }

      if (latestEndTime) {
        scheduledTaskEndTimes.set(task.id, latestEndTime);
      } else if (!taskScheduled) {
        unassignedTasks.push(task);
      }
    }

    // PHASE 2: Schedule HOLD tasks with dependencies
    const remainingHoldTasks = new Set(holdTasks.map(t => t.id));
    let maxIterations = holdTasks.length * 5;
    let iteration = 0;

    while (remainingHoldTasks.size > 0 && iteration < maxIterations) {
      iteration++;
      let scheduledInThisPass = false;

      for (const task of holdTasks) {
        if (!remainingHoldTasks.has(task.id)) continue;

        const isVisible = isTaskVisible(task);
        const dependencyEnd = getRequiredDependencyEndForTask(task, scheduledTaskEndTimes);
        
        if (dependencyEnd === null) continue;

        let earliestCursor = timelineStart;
        for (const ws of task.workstations || []) {
          const cursors = workstationCursors.get(ws.id) || [timelineStart];
          const minCursor = new Date(Math.min(...cursors.map(c => c.getTime())));
          if (minCursor < earliestCursor) earliestCursor = minCursor;
        }

        const earliestStart = dependencyEnd > earliestCursor ? dependencyEnd : earliestCursor;
        let taskScheduled = false;
        let latestEndTime: Date | null = null;

        for (const ws of task.workstations || []) {
          const bestWorker = findBestWorkerForTask(ws.id, task, earliestStart);
          
          if (bestWorker) {
            const cursors = workstationCursors.get(ws.id)!;
            const workerMap = all.get(ws.id)!;
            const slots = getTaskSlots(bestWorker.startTime, task.duration);

            if (slots.length > 0) {
              const taskList = workerMap.get(bestWorker.workerIndex) || [];
              slots.forEach(s => taskList.push({ task, ...s, isVisible }));
              workerMap.set(bestWorker.workerIndex, taskList);

              const lastSlot = slots[slots.length - 1];
              cursors[bestWorker.workerIndex] = lastSlot.end;
              workstationCursors.set(ws.id, cursors);

              if (!latestEndTime || lastSlot.end > latestEndTime) {
                latestEndTime = lastSlot.end;
              }
              taskScheduled = true;
            }
          }
        }

        if (latestEndTime) {
          scheduledTaskEndTimes.set(task.id, latestEndTime);
        } else if (!taskScheduled) {
          unassignedTasks.push(task);
        }

        remainingHoldTasks.delete(task.id);
        scheduledInThisPass = true;
      }

      if (!scheduledInThisPass) break;
    }

    // PHASE 3: Fill gaps in worker schedules with high-priority tasks
    const workHours = getWorkHours(selectedDate);
    if (workHours) {
      const endOfDay = workHours.end;

      workstations.forEach(ws => {
        const cursors = workstationCursors.get(ws.id);
        const workerMap = all.get(ws.id);
        const assignments = workerAssignments.get(ws.id);
        
        if (!cursors || !workerMap || !assignments) return;

        for (let workerIndex = 0; workerIndex < cursors.length; workerIndex++) {
          const workerCursor = cursors[workerIndex];
          const employeeId = assignments.get(workerIndex);
          
          if (!employeeId) continue;

          // Calculate gap time until end of day
          const gapMinutes = differenceInMinutes(endOfDay, workerCursor);
          
          if (gapMinutes > 30) { // Only fill if gap is significant (> 30 min)
            // Find unassigned tasks from workstations this employee is assigned to
            const employeeWorkstations = workstations.filter(w => 
              isEmployeeAssignedToWorkstation(employeeId, w.id)
            );

            const eligibleTasks = unassignedTasks
              .filter(task => 
                task.workstations?.some(taskWs => 
                  employeeWorkstations.some(empWs => empWs.id === taskWs.id)
                ) && task.duration <= gapMinutes
              )
              .sort((a, b) => getTaskPriorityScore(b) - getTaskPriorityScore(a));

            // Fill gaps with as many tasks as possible
            let currentCursor = workerCursor;
            for (const task of eligibleTasks) {
              const remainingTime = differenceInMinutes(endOfDay, currentCursor);
              if (task.duration <= remainingTime) {
                const isVisible = isTaskVisible(task);
                const slots = getTaskSlots(currentCursor, task.duration);

                if (slots.length > 0) {
                  const taskList = workerMap.get(workerIndex) || [];
                  slots.forEach(s => taskList.push({ task, ...s, isVisible }));
                  workerMap.set(workerIndex, taskList);

                  const lastSlot = slots[slots.length - 1];
                  currentCursor = lastSlot.end;
                  cursors[workerIndex] = currentCursor;

                  // Remove from unassigned
                  const taskIdx = unassignedTasks.indexOf(task);
                  if (taskIdx >= 0) unassignedTasks.splice(taskIdx, 1);

                  scheduledTaskEndTimes.set(task.id, lastSlot.end);
                }
              }
            }
            
            workstationCursors.set(ws.id, cursors);
          }
        }
      });
    }

    // Log unassigned tasks for debugging
    if (unassignedTasks.length > 0) {
      console.warn(`${unassignedTasks.length} tasks could not be assigned:`, unassignedTasks.map(t => t.title));
    }

    return all;
  }, [tasks, workstations, selectedDate, workingHoursMap, holidaySet, limitTaskMap, searchTerm, dailyAssignments, workstationEmployeeLinks]);

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
                  const assignedWorkstations = workstations.filter(ws => 
                    workstationEmployeeLinks.get(ws.id)?.some(emp => emp.id === employee.id)
                  );

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
                            ({assignedWorkstations.length} werkstations)
                          </span>
                        </div>
                      </Button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-muted/20">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {workstations.map(workstation => {
                              const isAssigned = workstationEmployeeLinks
                                .get(workstation.id)
                                ?.some(emp => emp.id === employee.id) || false;

                              return (
                                <label
                                  key={workstation.id}
                                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={() => handleToggleWorkstation(employee.id, workstation.id)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">{workstation.name}</span>
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
