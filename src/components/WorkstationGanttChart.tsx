import React, { useState, useEffect, useRef } from 'react';
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
  selectedDate: Date; // referentiedatum
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

  // ---------- schaalconfiguratie (consistent in minuten) ----------
  const getScaleConfig = () => {
    if (zoom >= 2) {
      const unitInMinutes = 15;
      const unitWidth = 8 * zoom;
      const visibleRangeMinutes = 24 * 60 * 3; // 3 dagen
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return {
        label: 'minutes',
        unitInMinutes,
        unitWidth,
        totalUnits,
        formatLabel: (date: Date) => format(date, 'HH:mm'),
      };
    } else if (zoom >= 1) {
      const unitInMinutes = 60;
      const unitWidth = 40 * zoom;
      const visibleRangeMinutes = 24 * 60 * 3; // 3 dagen
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return {
        label: 'hours',
        unitInMinutes,
        unitWidth,
        totalUnits,
        formatLabel: (date: Date) => format(date, 'HH:mm'),
      };
    } else {
      const unitInMinutes = 24 * 60;
      const unitWidth = 120 * zoom;
      const visibleRangeDays = 10;
      const totalUnits = visibleRangeDays;
      return {
        label: 'days',
        unitInMinutes,
        unitWidth,
        totalUnits,
        formatLabel: (date: Date) => format(date, 'dd MMM'),
      };
    }
  };

  const scale = getScaleConfig();

  // ---------- kleurgenerator ----------
  const getProjectColor = (projectId: string): { bg: string; text: string } => {
    if (!projectId) return { bg: '#888', text: '#fff' };
    const hash = projectId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    const bg = `hsl(${hue}, 65%, 45%)`;
    const text = `hsl(${hue}, 100%, 95%)`;
    return { bg, text };
  };

  // ---------- helper functions for working hours ----------
  const isHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === dateStr && h.team === 'production');
  };

  const isWorkingDay = (date: Date): boolean => {
    if (isWeekend(date)) return false;
    if (isHoliday(date)) return false;
    return true;
  };

  const getWorkingHoursForDate = (date: Date): { start: Date; end: Date; breakMinutes: number } | null => {
    if (!isWorkingDay(date)) return null;

    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
    const wh = workingHours.find(w => w.team === 'production' && w.day_of_week === dayOfWeek && w.is_active);

    if (!wh) return null;

    const [startHour, startMin] = wh.start_time.split(':').map(Number);
    const [endHour, endMin] = wh.end_time.split(':').map(Number);

    const start = setMinutes(setHours(startOfDay(date), startHour), startMin);
    const end = setMinutes(setHours(startOfDay(date), endHour), endMin);

    return { start, end, breakMinutes: wh.break_minutes };
  };

  // ---------- schedule inside strict working hours ----------
  const getNextWorkingSlot = (from: Date, durationMinutes: number): { start: Date; end: Date } => {
    // We willen altijd terugvallen op daadwerkelijke werkdag-starttijden.
    let currentDate = startOfDay(from);
    let workHours = getWorkingHoursForDate(currentDate);

    // Zoek de eerstvolgende dag met werkuren
    while (!workHours) {
      currentDate = addDays(currentDate, 1);
      workHours = getWorkingHoursForDate(currentDate);
    }

    // bepaal startpunt binnen die werkdag
    let startTime = new Date(from);
    if (startTime < workHours.start) startTime = new Date(workHours.start);
    if (startTime >= workHours.end) {
      // begin volgende werkdag
      currentDate = addDays(currentDate, 1);
      workHours = getWorkingHoursForDate(currentDate);
      while (!workHours) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
      }
      startTime = new Date(workHours.start);
    }

    let remainingMinutes = Math.max(0, Math.round(durationMinutes));
    let endTime = new Date(startTime);

    while (remainingMinutes > 0) {
      if (!workHours) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        continue;
      }

      // Als huidige tijd voorbij het einde van deze werkdag is -> volgende werkdag
      if (endTime >= workHours.end) {
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        if (workHours) endTime = new Date(workHours.start);
        continue;
      }

      const available = differenceInMinutes(workHours.end, endTime);
      if (remainingMinutes <= available) {
        endTime = addMinutes(endTime, remainingMinutes);
        remainingMinutes = 0;
      } else {
        // vul de rest van de dag en ga door naar volgende werkdag
        remainingMinutes -= available;
        currentDate = addDays(currentDate, 1);
        workHours = getWorkingHoursForDate(currentDate);
        if (workHours) endTime = new Date(workHours.start);
      }
    }

    return { start: startTime, end: endTime };
  };

  // ---------- data fetch ----------
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
            id,
            title,
            description,
            duration,
            status,
            due_date,
            phase_id,
            standard_task_id,
            phases (
              name,
              projects (
                id,
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
          .in('status', ['TODO', 'HOLD'])
          .order('due_date');

        if (error) {
          console.error('[Gantt] Error fetching tasks:', error);
          throw error;
        }

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
            workstations:
              t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
          })) || [];

        setTasks(transformed);

        const { data: limitPhasesData, error: limitError } = await supabase
          .from('standard_task_limit_phases')
          .select('*');

        if (!limitError) setLimitPhases(limitPhasesData || []);
      } catch (err) {
        console.error('[Gantt] Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // ---------- timeline: start op werkdag-start (bv. 08:00) ----------
  // Fallback hour = 08:00 wanneer geen werkuren gevonden voor selectedDate
  const defaultWorkStartHour = 8;
  const timelineStart = (() => {
    const wh = getWorkingHoursForDate(selectedDate);
    if (wh) {
      // gebruik precies de starttijd van de werkdag
      return new Date(wh.start);
    }
    // fallback: selectedDate op 08:00
    return setMinutes(setHours(startOfDay(selectedDate), defaultWorkStartHour), 0);
  })();

  const timeline = (() => {
    const arr: Date[] = [];
    for (let i = 0; i < scale.totalUnits; i++) {
      arr.push(addMinutes(timelineStart, i * scale.unitInMinutes));
    }
    return arr;
  })();
  const timelineEnd = addMinutes(timelineStart, scale.totalUnits * scale.unitInMinutes);

  // ---------- tasks per workstation ----------
  const getTasksForWorkstation = (workstationId: string) =>
    tasks
      .filter((t) => t.workstations?.some((ws) => ws.id === workstationId))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // ---------- limit phases check ----------
  const areLimitPhasesCompleted = (task: Task, completedTasks: Set<string>): boolean => {
    if (!task.standard_task_id) return true;

    const limits = limitPhases.filter(lp => lp.standard_task_id === task.standard_task_id);
    if (limits.length === 0) return true;

    const projectId = task.phases?.projects?.id;
    if (!projectId) return true;

    const projectTasks = tasks.filter(t => t.phases?.projects?.id === projectId);

    for (const limit of limits) {
      const limitTask = projectTasks.find(t => t.standard_task_id === limit.limit_standard_task_id);
      if (limitTask && !completedTasks.has(limitTask.id)) {
        return false;
      }
    }

    return true;
  };

  // ---------- schedule berekenen ----------
  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    const scheduled: Array<{ task: Task; start: Date; end: Date }> = [];
    const completedTaskIds = new Set<string>();

    if (wsTasks.length === 0) return scheduled;

    // Start op timelineStart maar op de volgende werkdag/start indien nodig
    let currentTime = getNextWorkingSlot(timelineStart, 0).start;

    const todoTasks = wsTasks.filter(t => t.status === 'TODO');
    const holdTasks = wsTasks.filter(t => t.status === 'HOLD');

    // TODO tasks eerst
    for (const task of todoTasks) {
      const durationMinutes = Math.max(1, Math.round(task.duration ?? 0));
      const { start, end } = getNextWorkingSlot(currentTime, durationMinutes);
      scheduled.push({ task, start, end });
      completedTaskIds.add(task.id);
      currentTime = end;
    }

    // HOLD tasks: pas plannen zodra limiting tasks gedaan zijn
    let holdTasksRemaining = [...holdTasks];
    let maxIterations = holdTasks.length * 10;
    let iterations = 0;

    while (holdTasksRemaining.length > 0 && iterations < maxIterations) {
      iterations++;
      const schedulable: Task[] = [];

      for (const t of holdTasksRemaining) {
        if (areLimitPhasesCompleted(t, completedTaskIds)) schedulable.push(t);
      }

      if (schedulable.length === 0) {
        // geen tasks mogen nu gepland worden -> breek
        break;
      }

      for (const task of schedulable) {
        const durationMinutes = Math.max(1, Math.round(task.duration ?? 0));
        const { start, end } = getNextWorkingSlot(currentTime, durationMinutes);
        scheduled.push({ task, start, end });
        completedTaskIds.add(task.id);
        currentTime = end;
        holdTasksRemaining = holdTasksRemaining.filter(h => h.id !== task.id);
      }
    }

    return scheduled;
  };

  // ---------- controls ----------
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.25));
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (workstations.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Workstations</AlertTitle>
        <AlertDescription>No workstations found. Please configure them first.</AlertDescription>
      </Alert>
    );
  }

  // ---------- render ----------
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workstation Gantt Chart (werkuren: strikt, 24u-notatie)</CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          De timeline start op de werkdag-start (bijv. 08:00). Alle tijden worden weergegeven in 24-uursformaat.
        </div>

        <div ref={scrollContainerRef} className="overflow-auto border rounded-lg bg-background" style={{ maxHeight: '600px' }}>
          {/* header */}
          <div
            className="sticky top-0 z-20 bg-muted border-b"
            style={{
              marginLeft: `${workstationLabelWidth}px`,
              height: `${headerHeight}px`,
            }}
          >
            <div className="flex" style={{ height: '100%' }}>
              {timeline.map((t, idx) => (
                <div
                  key={idx}
                  className="border-r flex flex-col items-center justify-center text-xs font-medium"
                  style={{
                    width: `${scale.unitWidth}px`,
                    minWidth: `${scale.unitWidth}px`,
                  }}
                >
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

          {/* body */}
          <div className="relative">
            {workstations.map((ws) => {
              const scheduled = computeTaskSchedule(ws.id);
              const height = rowHeight;

              return (
                <div key={ws.id} className="relative border-b" style={{ height: `${height}px` }}>
                  {/* workstation label */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-4 font-medium z-10"
                    style={{ width: `${workstationLabelWidth}px` }}
                  >
                    <div className="truncate">{ws.name}</div>
                  </div>

                  {/* timeline grid + tasks */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: `${workstationLabelWidth}px`, right: 0 }}
                  >
                    {timeline.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-border/50"
                        style={{ left: `${i * scale.unitWidth}px` }}
                      />
                    ))}

                    <TooltipProvider>
                      {scheduled.map(({ task, start, end }) => {
                        // bereken positie t.o.v. timelineStart (in minuten)
                        const minutesFromStart = differenceInMinutes(start, timelineStart);
                        const taskMinutes = Math.max(1, differenceInMinutes(end, start)); // minstens 1 min
                        // pixelpositie en breedte
                        const rawLeft = (minutesFromStart / scale.unitInMinutes) * scale.unitWidth;
                        const rawWidth = (taskMinutes / scale.unitInMinutes) * scale.unitWidth;
                        const left = Math.round(rawLeft);
                        const width = Math.max(20, Math.round(rawWidth)); // min breedte 20px for visibility

                        // Render even if gedeeltelijk buiten zicht
                        const projectId = task.phases?.projects?.id || '';
                        const projectName = task.phases?.projects?.name || 'Unknown Project';
                        const phaseName = task.phases?.name || '';
                        const { bg, text } = getProjectColor(projectId);

                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded-md px-3 py-2 text-xs font-medium cursor-pointer hover:brightness-110 hover:shadow-lg transition-all overflow-hidden shadow-md"
                                style={{
                                  left: `${left}px`,
                                  width: `${width}px`,
                                  top: `8px`,
                                  height: `${rowHeight - 16}px`,
                                  backgroundColor: bg,
                                  color: text,
                                  border:
                                    task.status === 'HOLD'
                                      ? '2px dashed rgba(255,255,255,0.8)'
                                      : '1px solid rgba(0,0,0,0.12)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                  zIndex: 5,
                                }}
                              >
                                <div className="truncate font-bold text-sm">{projectName}</div>
                                <div className="truncate text-[11px] opacity-90 mt-0.5">{task.title}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs z-50 bg-popover">
                              <div className="space-y-1">
                                <div className="font-semibold text-base">{projectName}</div>
                                <div className="text-sm text-muted-foreground">{phaseName}</div>
                                <div className="text-sm font-medium">{task.title}</div>
                                {task.description && (
                                  <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                                )}
                                <div className="text-xs space-y-0.5 pt-2 border-t">
                                  <div><strong>Start:</strong> {format(start, 'dd MMM yyyy HH:mm')}</div>
                                  <div><strong>End:</strong> {format(end, 'dd MMM yyyy HH:mm')}</div>
                                  <div><strong>Duration:</strong> {task.duration} minutes</div>
                                  <div><strong>Status:</strong> {task.status}</div>
                                  <div><strong>Workstations:</strong> {task.workstations?.map(w => w.name).join(', ')}</div>
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
