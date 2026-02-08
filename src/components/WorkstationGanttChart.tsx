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
import { automaticSchedulingService, ProjectCompletionInfo } from '@/services/automaticSchedulingService';
import { projectCompletionService } from '@/services/projectCompletionService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus, ChevronDown, ChevronRight, ChevronLeft, User, Calendar, Save, Wand2, AlertTriangle, CheckCircle, Clock, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

// Re-export ProjectCompletionInfo for backwards compatibility
export type { ProjectCompletionInfo } from '@/services/automaticSchedulingService';

interface WorkstationGanttChartProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  onPlanningGenerated?: (completions: ProjectCompletionInfo[], lastStepName: string | null, isGenerating: boolean) => void;
}

interface DailyEmployeeAssignment {
  date: string;
  workstationId: string;
  workerIndex: number;
  employeeId: string;
  employeeName: string;
}

/** Per-workstation lane info: one lane per unique employee */
interface WorkstationLaneInfo {
  laneIndex: number;
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
  const navigate = useNavigate();
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [limitPhases, setLimitPhases] = useState<LimitPhase[]>([]);
  const [standardTasks, setStandardTasks] = useState<Array<{ id: string; task_name: string; task_number: string; multi_user_task?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [projectCount, setProjectCount] = useState(5);
  const [completionInfo, setCompletionInfo] = useState<ProjectCompletionInfo[]>([]);
  const [lastStepName, setLastStepName] = useState<string | null>(null);
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

  // Day-based scale
  const scale = useMemo(() => {
    const unitWidth = 60 * zoom;
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
      
      const { data: standardTasksData, error: standardTasksError } = await supabase
        .from('standard_tasks')
        .select('id, task_name, task_number, multi_user_task')
        .order('task_number');
      
      if (standardTasksError) {
        console.error('Error fetching standard tasks:', standardTasksError);
      } else {
        setStandardTasks(standardTasksData || []);
      }
      
      const linksMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const workstation of ws || []) {
        const employees = await workstationService.getEmployeesForWorkstation(workstation.id);
        linksMap.set(workstation.id, employees);
      }
      setWorkstationEmployeeLinks(linksMap);
      
      const { data: employeeTaskLinks, error: linksError } = await supabase
        .from('employee_standard_task_links')
        .select('employee_id, standard_task_id, employees(id, name)');
      
      if (linksError) {
        console.error('Error fetching employee task links:', linksError);
      }
      
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
      
      // Fetch tasks with pagination
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
          .in('status', ['TODO', 'HOLD', 'IN_PROGRESS'])
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
      
      console.log(`Loaded ${allTasks.length} TODO/HOLD/IN_PROGRESS tasks from database`);
      
      const t = allTasks.map((d: any) => ({
        ...d,
        workstations: d.task_workstation_links?.map((x: any) => x.workstations).filter(Boolean) || [],
      }));
      setTasks(t);
      const { data: lp } = await supabase.from('standard_task_limit_phases').select('*');
      setLimitPhases(lp || []);
      setLoading(false);
    })();
  }, []);

  // Load saved schedules from database for the selected date
  const loadSavedSchedules = useCallback(async () => {
    try {
      const schedules = await ganttScheduleService.getSchedulesWithDetailsForDate(selectedDate);
      setSavedSchedules(schedules);
      
      if (schedules.length > 0) {
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
    if (realtimeChannelRef.current) {
      ganttScheduleService.unsubscribeFromSchedules(realtimeChannelRef.current);
    }
    
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
    if (onDateChange) onDateChange(newDate);
  }, [selectedDate, onDateChange]);

  const handleNextDay = useCallback(() => {
    const newDate = addDays(selectedDate, 1);
    if (onDateChange) onDateChange(newDate);
  }, [selectedDate, onDateChange]);

  const handleToday = useCallback(() => {
    const today = startOfDay(new Date());
    if (onDateChange) onDateChange(today);
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

  const getWorkHours = (date: Date) => {
    const wh = workingHoursMap.get(getDay(date));
    if (!wh) return null;
    const [sh, sm] = wh.start_time.split(':').map(Number);
    const [eh, em] = wh.end_time.split(':').map(Number);
    const s = setMinutes(setHours(startOfDay(date), sh), sm);
    const e = setMinutes(setHours(startOfDay(date), eh), em);
    
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

  // ──────────────── CORE: Build schedule with employee-based lanes ────────────────
  const { schedule, wsLaneInfo } = useMemo(() => {
    const all = new Map<string, Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>>();
    const laneInfoMap = new Map<string, WorkstationLaneInfo[]>();
    
    const isTaskVisible = (task: Task) => {
      if (!searchTerm) return true;
      return task.phases?.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    };
    
    // Step 1: Group saved schedules by workstation -> employee
    const wsEmployeeSchedules = new Map<string, Map<string, { schedule: any; employeeName: string }[]>>();
    
    savedSchedules.forEach((sched: any) => {
      const wsId = sched.workstation_id;
      const empId = sched.employee_id || 'unassigned';
      const empName = sched.employees?.name || 'Niet toegewezen';
      
      if (!wsEmployeeSchedules.has(wsId)) {
        wsEmployeeSchedules.set(wsId, new Map());
      }
      const empMap = wsEmployeeSchedules.get(wsId)!;
      if (!empMap.has(empId)) {
        empMap.set(empId, []);
      }
      empMap.get(empId)!.push({ schedule: sched, employeeName: empName });
    });
    
    // Step 2: For each workstation, assign lane indices per unique employee
    workstations.forEach((ws) => {
      const empMap = wsEmployeeSchedules.get(ws.id);
      const lanes: WorkstationLaneInfo[] = [];
      const workerMap = new Map<number, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
      
      if (empMap && empMap.size > 0) {
        let laneIdx = 0;
        empMap.forEach((entries, empId) => {
          lanes.push({
            laneIndex: laneIdx,
            employeeId: empId,
            employeeName: entries[0].employeeName,
          });
          
          // Place all this employee's tasks in their lane
          const taskList: { task: Task; start: Date; end: Date; isVisible: boolean }[] = [];
          
          entries.forEach(({ schedule: sched }) => {
            let task = tasks.find(t => t.id === sched.task_id);
            
            if (!task && sched.tasks) {
              task = {
                id: sched.task_id,
                title: sched.tasks.title || 'Unknown Task',
                description: sched.tasks.description,
                duration: sched.tasks.duration || 60,
                status: sched.tasks.status || 'TODO',
                due_date: sched.tasks.due_date || '',
                phase_id: sched.tasks.phase_id || '',
                standard_task_id: sched.tasks.standard_task_id,
                priority: sched.tasks.priority || 'medium',
                phases: sched.tasks.phases,
                workstations: []
              };
            }
            
            if (!task) return;
            
            const start = new Date(sched.start_time);
            const end = new Date(sched.end_time);
            taskList.push({ task, start, end, isVisible: isTaskVisible(task) });
          });
          
          workerMap.set(laneIdx, taskList);
          laneIdx++;
        });
      } else {
        // No schedules for this workstation - show one empty lane
        workerMap.set(0, []);
      }
      
      laneInfoMap.set(ws.id, lanes);
      all.set(ws.id, workerMap);
    });
    
    console.log(`Schedule built: ${savedSchedules.length} entries across ${workstations.length} workstations`);
    
    return { schedule: all, wsLaneInfo: laneInfoMap };
  }, [workstations, tasks, savedSchedules, searchTerm]);

  // Build daily assignments from lane info (for ref/export compatibility)
  const computedDailyAssignments = useMemo(() => {
    const assignments: DailyEmployeeAssignment[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    wsLaneInfo.forEach((lanes, wsId) => {
      lanes.forEach(lane => {
        assignments.push({
          date: dateStr,
          workstationId: wsId,
          workerIndex: lane.laneIndex,
          employeeId: lane.employeeId,
          employeeName: lane.employeeName,
        });
      });
    });
    
    return assignments;
  }, [wsLaneInfo, selectedDate]);

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    getDailyAssignments: () => computedDailyAssignments,
    getSchedule: () => schedule,
    getTasks: () => tasks,
    getWorkstations: () => workstations,
  }));

  // Get unique employees from assignments
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, string>();
    computedDailyAssignments.forEach(a => {
      if (a.employeeId !== 'unassigned') {
        employeeMap.set(a.employeeId, a.employeeName);
      }
    });
    return Array.from(employeeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [computedDailyAssignments]);

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

  const handleToggleStandardTask = async (employeeId: string, taskId: string) => {
    toast.info('Deze functie is beschikbaar in de Instellingen pagina');
  };

  // Handle optimize schedule button click
  const handleOptimizeSchedule = async () => {
    setOptimizing(true);
    
    try {
      toast.info(`Planning optimaliseren voor ${projectCount} meest urgente projecten...`);
      
      if (onPlanningGenerated) {
        onPlanningGenerated([], null, true);
      }
      
      const { schedules, completions, lastProductionStepName } = await automaticSchedulingService.generateSchedule(
        projectCount,
        selectedDate
      );
      
      if (schedules.length === 0) {
        toast.warning('Geen taken gevonden om te plannen. Controleer of projecten taken hebben met TODO/HOLD status.');
        if (onPlanningGenerated) {
          onPlanningGenerated([], null, false);
        }
        return;
      }
      
      // Save schedules to database
      await automaticSchedulingService.saveSchedulesToDatabase(schedules);
      
      // Update local state
      setCompletionInfo(completions);
      setLastStepName(lastProductionStepName);
      
      // Save completion data to database for cross-session visibility
      try {
        await projectCompletionService.saveCompletionData(completions, lastProductionStepName);
      } catch (e) {
        console.error('Error saving completion data:', e);
      }
      
      // Notify parent component
      if (onPlanningGenerated) {
        onPlanningGenerated(completions, lastProductionStepName, false);
      }
      
      // Reload saved schedules to refresh the view
      await loadSavedSchedules();
      
      setScheduleGenerated(true);
      
      // Show summary
      const onTrack = completions.filter(c => c.status === 'on_track').length;
      const atRisk = completions.filter(c => c.status === 'at_risk').length;
      const overdue = completions.filter(c => c.status === 'overdue').length;
      
      toast.success(
        `Planning gegenereerd: ${schedules.length} taken gepland voor ${completions.length} projecten. ` +
        `✅ ${onTrack} op schema, ⚠️ ${atRisk} risico, 🔴 ${overdue} te laat`
      );
      
    } catch (error) {
      console.error('Error optimizing schedule:', error);
      toast.error('Fout bij het optimaliseren van de planning');
      if (onPlanningGenerated) {
        onPlanningGenerated([], null, false);
      }
    } finally {
      setOptimizing(false);
    }
  };

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

  // Enhanced color coding
  const getTaskColor = (task: Task) => {
    const project = task.phases?.projects;
    const today = format(new Date(), 'yyyy-MM-dd');
    const pid = project?.id || '';
    const hue = pid.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    
    let saturation = 65;
    let lightness = 45;
    let border = 'rgba(0,0,0,0.2)';
    
    if (project) {
      if (project.start_date > today) {
        saturation = 30;
        lightness = 60;
        border = 'rgba(0,0,0,0.1)';
      } else if (task.priority === 'high' || 
                 differenceInMinutes(new Date(project.installation_date), new Date()) / (24 * 60) < 7) {
        saturation = 80;
        lightness = 40;
        border = 'rgba(255,0,0,0.3)';
      } else if (task.status === 'HOLD') {
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

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          {/* Title and Day Navigation Row */}
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <CardTitle>Workstation Gantt Chart</CardTitle>
              
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button onClick={handlePreviousDay} variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-2 px-3 py-1 min-w-[180px] justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
                  </span>
                </div>
                
                <Button onClick={handleNextDay} variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button onClick={handleToday} variant="outline" size="sm" className="ml-2">
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
          
          {/* Project Counter and Optimize Button */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex flex-col gap-2 flex-1 max-w-md">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Aantal projecten te plannen:</label>
                <span className="text-lg font-bold text-primary">{projectCount}</span>
              </div>
              <Slider
                value={[projectCount]}
                onValueChange={(value) => setProjectCount(value[0])}
                min={1}
                max={200}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 project</span>
                <span>200 projecten</span>
              </div>
            </div>
            
            <Button
              onClick={handleOptimizeSchedule}
              disabled={optimizing}
              className="h-12 px-6"
              variant="default"
            >
              {optimizing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Optimaliseren...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Optimaliseer Planning
                </>
              )}
            </Button>

            <Button
              onClick={() => navigate('/settings?tab=recurring-tasks')}
              variant="outline"
              className="h-12 px-4"
            >
              <Settings className="w-4 h-4 mr-2" />
              Terugkerende Taken
            </Button>
          </div>
          
          {/* Completion Timeline Summary */}
          {completionInfo.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-background rounded-lg border">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deadline Status:</span>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">{completionInfo.filter(c => c.status === 'on_track').length} op schema</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-sm">{completionInfo.filter(c => c.status === 'at_risk').length} risico</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm">{completionInfo.filter(c => c.status === 'overdue').length} te laat</span>
                </div>
              </div>
            </div>
          )}
          
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
          
          {computedDailyAssignments.length > 0 && (
            <div className="p-2 bg-accent border border-border rounded text-xs">
              ✅ <strong>{new Set(computedDailyAssignments.map(a => a.employeeId)).size}</strong> werknemers toegewezen voor{' '}
              <strong>{format(selectedDate, 'd MMMM', { locale: nl })}</strong> met optimale werkverdeling
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="overflow-auto border rounded-lg" style={{ maxHeight: 600 }}>
          {/* header */}
          <div
            className="sticky top-0 z-10 flex border-b bg-muted"
            style={{ 
              height: headerHeight,
              minWidth: workstationLabelWidth + (scale.totalUnits * scale.unitWidth)
            }}
          >
            <div 
              className="sticky left-0 z-20 bg-muted border-r flex items-center justify-center font-medium"
              style={{ width: workstationLabelWidth, minWidth: workstationLabelWidth }}
            >
              {format(selectedDate, 'EEEE d MMMM', { locale: nl })}
            </div>
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

          {/* rows - one per workstation, with employee-based lanes */}
          {workstations.map((ws) => {
            const workerMap = schedule.get(ws.id);
            if (!workerMap) return null;
            
            const lanes = wsLaneInfo.get(ws.id) || [];
            const laneCount = Math.max(lanes.length, 1);
            const totalHeight = rowHeight * laneCount;
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
                    <span className="text-xs text-muted-foreground">{laneCount}</span>
                  </div>
                  
                  {/* Show employee lane labels */}
                  {laneCount > 0 && (
                    lanes.length > 0 ? (
                      lanes.map((lane) => (
                        <div
                          key={lane.laneIndex}
                          className="px-3 py-1 text-xs flex items-center"
                          style={{ 
                            height: rowHeight,
                            borderTop: lane.laneIndex > 0 ? '1px dashed hsl(var(--border) / 0.3)' : undefined
                          }}
                        >
                          <span className="text-muted-foreground">
                            Werker {lane.laneIndex + 1}: 
                          </span>
                          <span className="ml-1 font-medium truncate">
                            {lane.employeeName}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        className="px-3 py-1 text-xs flex items-center"
                        style={{ height: rowHeight }}
                      >
                        <span className="text-muted-foreground">Geen taken gepland</span>
                      </div>
                    )
                  )}
                </div>
                
                {/* Timeline area */}
                <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth }}>
                  {Array.from({ length: laneCount }).map((_, laneIndex) => {
                    const taskEntries = workerMap.get(laneIndex) || [];
                    const laneTop = laneIndex * rowHeight;
                    const lane = lanes[laneIndex];
                    
                    return (
                      <div
                        key={laneIndex}
                        className="absolute left-0 right-0"
                        style={{
                          top: laneTop,
                          height: rowHeight,
                          borderTop: laneIndex > 0 ? '1px dashed hsl(var(--border) / 0.3)' : undefined
                        }}
                      >
                        {/* Grid lines */}
                        {timeline.map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute top-0 bottom-0 border-r border-border/40" 
                            style={{ left: i * scale.unitWidth, width: 0 }} 
                          />
                        ))}
                        <TooltipProvider>
                          {taskEntries.map(({ task, start, end, isVisible }) => {
                            if (!isVisible) return null;

                            const project = task.phases?.projects;
                            const { bg, text, border } = getTaskColor(task);
                            const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                            const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
                            
                            return (
                              <Tooltip key={`${task.id}-${start.toISOString()}-${laneIndex}`}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute rounded-md px-2 py-1 text-xs font-medium overflow-hidden"
                                    style={{
                                      left,
                                      width: Math.max(width, 2),
                                      top: 8,
                                      height: rowHeight - 16,
                                      background: bg,
                                      color: text,
                                      border: `1px solid ${border}`,
                                      boxShadow: 'none',
                                    }}
                                  >
                                    <div className="truncate font-semibold">
                                      {project?.name || 'Project'} – {task.title} ({task.duration} min)
                                    </div>
                                    <div className="text-[9px] opacity-75 truncate">
                                      {task.status === 'HOLD' && '🟠 HOLD '}
                                    </div>
                                    {lane && (
                                      <div className="text-[10px] opacity-80 truncate mt-0.5">
                                        👤 {lane.employeeName}
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
                                    <div><b>Prioriteit:</b> {task.priority}</div>
                                    {lane && (
                                      <div><b>Werknemer:</b> {lane.employeeName}</div>
                                    )}
                                    {project && (
                                      <div className="border-t pt-1 mt-1">
                                        <div><b>Klant:</b> {project.client}</div>
                                        <div><b>Project start:</b> {format(new Date(project.start_date), 'dd MMM yyyy')}</div>
                                        <div><b>Installatie:</b> {format(new Date(project.installation_date), 'dd MMM yyyy')}</div>
                                        <div><b>Status:</b> {project.status}</div>
                                      </div>
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

        {/* Employee Management Section */}
        {uniqueEmployees.length > 0 && (
          <div className="mt-6 border-t pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'TODO' || t.status === 'HOLD' || t.status === 'IN_PROGRESS').length}</div>
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
                    {savedSchedules.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Taken gepland vandaag</div>
                </CardContent>
              </Card>
            </div>

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
