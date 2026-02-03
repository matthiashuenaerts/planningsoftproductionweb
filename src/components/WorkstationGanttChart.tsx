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
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { ganttScheduleService } from '@/services/ganttScheduleService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus, ChevronDown, ChevronRight, ChevronLeft, User, Calendar, Save } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

export interface ProjectCompletionInfo {
  projectId: string;
  projectName: string;
  client: string;
  installationDate: Date;
  lastProductionStepEnd: Date | null;
  status: 'on_track' | 'at_risk' | 'overdue' | 'pending';
  daysRemaining: number;
}

interface WorkstationGanttChartProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  onPlanningGenerated?: (completions: ProjectCompletionInfo[], lastStepName: string | null, isGenerating: boolean) => void;
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

const WorkstationGanttChart = forwardRef<WorkstationGanttChartRef, WorkstationGanttChartProps>(({ selectedDate, onDateChange, onPlanningGenerated }, ref) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [limitPhases, setLimitPhases] = useState<LimitPhase[]>([]);
  const [standardTasks, setStandardTasks] = useState<Array<{ id: string; task_name: string; task_number: string; multi_user_task?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dailyAssignments, setDailyAssignments] = useState<DailyEmployeeAssignment[]>([]);
  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [employeeStandardTaskLinks, setEmployeeStandardTaskLinks] = useState<Map<string, Array<{ id: string; name: string; standardTasks: string[] }>>>(new Map());
  const [workstationEmployeeLinks, setWorkstationEmployeeLinks] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
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
      
      // Fetch standard tasks with multi_user_task flag
      const { data: standardTasksData, error: standardTasksError } = await supabase
        .from('standard_tasks')
        .select('id, task_name, task_number, multi_user_task')
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
  }, []); // Tasks don't depend on selectedDate - only schedules do

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

  // Schedule computation from saved schedules
  const schedule = useMemo(() => {
    const all = new Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>();
    
    // Initialize all workstations with empty worker maps
    workstations.forEach((ws) => {
      const workerMap = new Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
      for (let i = 0; i < (ws.active_workers || 1); i++) {
        workerMap.set(i, []);
      }
      all.set(ws.id, workerMap);
    });
    
    // Helper for search filtering
    const isTaskVisible = (task: Task) => {
      if (!searchTerm) return true;
      return task.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    };
    
    // Populate from saved schedules
    savedSchedules.forEach((schedule: any) => {
      const task = tasks.find(t => t.id === schedule.task_id);
      if (!task) return;
      
      const workerMap = all.get(schedule.workstation_id);
      if (!workerMap) return;
      
      const start = new Date(schedule.start_time);
      const end = new Date(schedule.end_time);
      const workerIndex = schedule.worker_index || 0;
      
      const taskList = workerMap.get(workerIndex) || [];
      taskList.push({ task, start, end, isVisible: isTaskVisible(task) });
      workerMap.set(workerIndex, taskList);
    });
    
    return all;
  }, [workstations, tasks, savedSchedules, searchTerm]);

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

  // Handle toggling standard task for employee (placeholder - this requires backend update)
  const handleToggleStandardTask = async (employeeId: string, taskId: string) => {
    toast.info('Deze functie is beschikbaar in de Instellingen pagina');
  };

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
                                      border: `1px solid ${border}`,
                                      boxShadow: 'none',
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
                                    className="rounded border-border"
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
