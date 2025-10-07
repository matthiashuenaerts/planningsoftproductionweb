import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  parseISO,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  isSameDay,
  getDay,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { standardTasksService } from '@/services/standardTasksService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RefreshCw, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Task {
  id: string;
  title: string;
  description?: string;
  duration: number; // minuten
  status: string;
  due_date: string;
  phase_id: string;
  standard_task_id?: string;
  phases?: {
    name: string;
    projects: {
      id: string;
      name: string;
    };
  };
  workstations?: Array<{
    id: string;
    name: string;
  }>;
}

interface LimitPhase {
  id: string;
  standard_task_id: string;
  limit_standard_task_id: string;
}

interface WorkstationGanttChartProps {
  selectedDate: Date;
}

const WorkstationGanttChart: React.FC<WorkstationGanttChartProps> = ({ selectedDate }) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [limitPhases, setLimitPhases] = useState<LimitPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  // ---------- schaalconfiguratie ----------
  const getScaleConfig = () => {
    if (zoom >= 2) {
      const unitInMinutes = 15;
      const unitWidth = 8 * zoom;
      const visibleRangeMinutes = 24 * 60 * 3;
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return { label: 'minutes', unitInMinutes, unitWidth, totalUnits, formatLabel: (date: Date) => format(date, 'HH:mm') };
    } else if (zoom >= 1) {
      const unitInMinutes = 60;
      const unitWidth = 40 * zoom;
      const visibleRangeMinutes = 24 * 60 * 3;
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return { label: 'hours', unitInMinutes, unitWidth, totalUnits, formatLabel: (date: Date) => format(date, 'HH:mm') };
    } else {
      const unitInMinutes = 24 * 60;
      const unitWidth = 120 * zoom;
      const visibleRangeDays = 10;
      const totalUnits = visibleRangeDays;
      return { label: 'days', unitInMinutes, unitWidth, totalUnits, formatLabel: (date: Date) => format(date, 'dd MMM') };
    }
  };

  const scale = getScaleConfig();

  // ---------- kleuren ----------
  const getProjectColor = (projectId: string): { bg: string; text: string } => {
    if (!projectId) return { bg: '#888', text: '#fff' };
    const hash = projectId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    const bg = `hsl(${hue}, 65%, 45%)`;
    const text = `hsl(${hue}, 100%, 95%)`;
    return { bg, text };
  };

  // ---------- helper: werkuren ----------
  const isHoliday = (date: Date): boolean => holidays.some(h => h.date === format(date, 'yyyy-MM-dd') && h.team === 'production');
  const isWorkingDay = (date: Date): boolean => !isWeekend(date) && !isHoliday(date);

  const getWorkingHoursForDate = (date: Date): { start: Date; end: Date; breakMinutes: number } | null => {
    if (!isWorkingDay(date)) return null;
    const dayOfWeek = getDay(date);
    const wh = workingHours.find(w => w.team === 'production' && w.day_of_week === dayOfWeek && w.is_active);
    if (!wh) return null;
    const [startHour, startMin] = wh.start_time.split(':').map(Number);
    const [endHour, endMin] = wh.end_time.split(':').map(Number);
    const start = setMinutes(setHours(date, startHour), startMin);
    const end = setMinutes(setHours(date, endHour), endMin);
    return { start, end, breakMinutes: wh.break_minutes };
  };

  // ---------- STRIKT binnen werkuren ----------
  const getNextWorkingSlot = (from: Date, durationMinutes: number): { start: Date; end: Date } => {
    let currentDate = startOfDay(from);
    let workHours = getWorkingHoursForDate(currentDate);

    // Vind eerstvolgende werkdag
    while (!workHours) {
      currentDate = addDays(currentDate, 1);
      workHours = getWorkingHoursForDate(currentDate);
    }

    // Beginpunt = max(vanuit, start van werkdag)
    let startTime = new Date(from);
    if (startTime < workHours.start) startTime = workHours.start;
    if (startTime >= workHours.end) {
      // volgende werkdag
      currentDate = addDays(currentDate, 1);
      workHours = getWorkingHoursForDate(currentDate);
      while (!workHours) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
      }
      startTime = workHours.start;
    }

    let remaining = durationMinutes;
    let endTime = startTime;

    while (remaining > 0) {
      if (!workHours) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        continue;
      }

      // Als voorbij einde werkdag → naar volgende
      if (endTime >= workHours.end) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        if (workHours) endTime = workHours.start;
        continue;
      }

      const available = differenceInMinutes(workHours.end, endTime);
      if (remaining <= available) {
        endTime = addMinutes(endTime, remaining);
        remaining = 0;
      } else {
        remaining -= available;
        // volgende werkdag
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        if (workHours) endTime = workHours.start;
      }
    }

    return { start: startTime, end: endTime };
  };

  // ---------- data ophalen ----------
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [workstationData, workingHoursData, holidaysData] = await Promise.all([
          workstationService.getAll(),
          workingHoursService.getWorkingHours(),
          holidayService.getHolidays(),
        ]);

        setWorkstations(workstationData || []);
        setWorkingHours(workingHoursData || []);
        setHolidays(holidaysData || []);

        const { data: tasksData, error } = await supabase
          .from('tasks')
          .select(`
            id, title, description, duration, status, due_date, phase_id, standard_task_id,
            phases ( name, projects ( id, name ) ),
            task_workstation_links ( workstations ( id, name ) )
          `)
          .in('status', ['TODO', 'HOLD'])
          .order('due_date');

        if (error) throw error;

        const transformed =
          (tasksData || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            duration: t.duration,
            status: t.status,
            due_date: t.due_date,
            phase_id: t.phase_id,
            standard_task_id: t.standard_task_id,
            phases: t.phases,
            workstations: t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
          })) || [];

        setTasks(transformed);

        const { data: limitPhasesData } = await supabase.from('standard_task_limit_phases').select('*');
        setLimitPhases(limitPhasesData || []);
      } catch (err) {
        console.error('[Gantt] Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // ---------- timeline ----------
  const timelineStart = startOfDay(selectedDate);
  const timeline = Array.from({ length: scale.totalUnits }, (_, i) =>
    addMinutes(timelineStart, i * scale.unitInMinutes)
  );

  // ---------- taken per workstation ----------
  const getTasksForWorkstation = (workstationId: string) =>
    tasks
      .filter(t => t.workstations?.some(ws => ws.id === workstationId))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const areLimitPhasesCompleted = (task: Task, completedTasks: Set<string>): boolean => {
    if (!task.standard_task_id) return true;
    const limits = limitPhases.filter(lp => lp.standard_task_id === task.standard_task_id);
    if (limits.length === 0) return true;
    const projectId = task.phases?.projects?.id;
    if (!projectId) return true;
    const projectTasks = tasks.filter(t => t.phases?.projects?.id === projectId);
    for (const limit of limits) {
      const limitTask = projectTasks.find(t => t.standard_task_id === limit.limit_standard_task_id);
      if (limitTask && !completedTasks.has(limitTask.id)) return false;
    }
    return true;
  };

  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    const scheduled: Array<{ task: Task; start: Date; end: Date }> = [];
    const completedTaskIds = new Set<string>();

    let currentTime = getNextWorkingSlot(timelineStart, 0).start;

    const todoTasks = wsTasks.filter(t => t.status === 'TODO');
    const holdTasks = wsTasks.filter(t => t.status === 'HOLD');

    for (const task of todoTasks) {
      const { start, end } = getNextWorkingSlot(currentTime, Math.max(1, task.duration));
      scheduled.push({ task, start, end });
      completedTaskIds.add(task.id);
      currentTime = end;
    }

    let remaining = [...holdTasks];
    let safety = 0;
    while (remaining.length > 0 && safety < 50) {
      safety++;
      const ready = remaining.filter(t => areLimitPhasesCompleted(t, completedTaskIds));
      if (ready.length === 0) break;
      for (const task of ready) {
        const { start, end } = getNextWorkingSlot(currentTime, Math.max(1, task.duration));
        scheduled.push({ task, start, end });
        completedTaskIds.add(task.id);
        currentTime = end;
        remaining = remaining.filter(t => t.id !== task.id);
      }
    }
    return scheduled;
  };

  // ---------- controls ----------
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.25));
  const handleRefresh = () => setLoading(true);

  if (loading)
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );

  if (workstations.length === 0)
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Workstations</AlertTitle>
        <AlertDescription>No workstations found. Please configure them first.</AlertDescription>
      </Alert>
    );

  // ---------- render ----------
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workstation Gantt Chart (werkdagen strikt gerespecteerd)</CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Taken worden enkel ingepland binnen de werkuren. Geen taken buiten werkdagen of tijdens feestdagen.
        </div>

        <div ref={scrollContainerRef} className="overflow-auto border rounded-lg bg-background" style={{ maxHeight: '600px' }}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-muted border-b" style={{ marginLeft: `${workstationLabelWidth}px`, height: `${headerHeight}px` }}>
            <div className="flex" style={{ height: '100%' }}>
              {timeline.map((t, idx) => (
                <div key={idx} className="border-r flex flex-col items-center justify-center text-xs font-medium"
                  style={{ width: `${scale.unitWidth}px`, minWidth: `${scale.unitWidth}px` }}>
                  {scale.label === 'days' ? (
                    <>
                      <div>{format(t, 'EEE')}</div>
                      <div className="text-lg font-semibold">{format(t, 'd')}</div>
                      <div className="text-muted-foreground">{format(t, 'MMM')}</div>
                    </>
                  ) : (
                    <div className="text-xs">{scale.formatLabel(t)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {workstations.map(ws => {
              const scheduled = computeTaskSchedule(ws.id);
              return (
                <div key={ws.id} className="relative border-b" style={{ height: `${rowHeight}px` }}>
                  <div className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-4 font-medium z-10"
                    style={{ width: `${workstationLabelWidth}px` }}>
                    <div className="truncate">{ws.name}</div>
                  </div>

                  <div className="absolute top-0 bottom-0" style={{ left: `${workstationLabelWidth}px`, right: 0 }}>
                    {timeline.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-border/50"
                        style={{ left: `${i * scale.unitWidth}px` }} />
                    ))}

                    <TooltipProvider>
                      {scheduled.map(({ task, start, end }) => {
                        const minutesFromStart = differenceInMinutes(start, timelineStart);
                        const taskMinutes = Math.max(1, differenceInMinutes(end, start));
                        const left = (minutesFromStart / scale.unitInMinutes) * scale.unitWidth;
                        const width = Math.max(20, (taskMinutes / scale.unitInMinutes) * scale.unitWidth);
                        const { bg, text } = getProjectColor(task.phases?.projects?.id || '');
                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div className="absolute rounded-md px-3 py-2 text-xs font-medium cursor-pointer hover:brightness-110 hover:shadow-lg transition-all overflow-hidden shadow-md"
                                style={{
                                  left: `${left}px`,
                                  width: `${width}px`,
                                  top: `8px`,
                                  height: `${rowHeight - 16}px`,
                                  backgroundColor: bg,
                                  color: text,
                                  border: task.status === 'HOLD' ? '2px dashed rgba(255,255,255,0.8)' : '1px solid rgba(0,0,0,0.12)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                }}>
                                <div className="truncate font-bold text-sm">{task.phases?.projects?.name || 'Project'}</div>
                                <div className="truncate text-[11px] opacity-90 mt-0.5">{task.title}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs z-50 bg-popover">
                              <div className="space-y-1">
                                <div className="font-semibold text-base">{task.phases?.projects?.name}</div>
                                <div className="text-sm text-muted-foreground">{task.phases?.name}</div>
                                <div className="text-sm font-medium">{task.title}</div>
                                {task.description && (
                                  <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                                )}
                                <div className="text-xs space-y-0.5 pt-2 border-t">
                                  <div><strong>Start:</strong> {format(start, 'PPPp')}</div>
                                  <div><strong>End:</strong> {format(end, 'PPPp')}</div>
                                  <div><strong>Duration:</strong> {task.duration} min</div>
                                  <div><strong>Status:</strong> {task.status}</div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkstationGanttChart;
