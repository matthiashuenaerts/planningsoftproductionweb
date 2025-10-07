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
  min,
  max,
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
  duration: number;
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
      return {
        label: 'minutes',
        unitInMinutes: 15,
        unitWidth: 8 * zoom,
        totalUnits: (24 * 60 * 3) / 15,
        formatLabel: (d: Date) => format(d, 'HH:mm'),
      };
    } else if (zoom >= 1) {
      return {
        label: 'hours',
        unitInMinutes: 60,
        unitWidth: 40 * zoom,
        totalUnits: (24 * 3),
        formatLabel: (d: Date) => format(d, 'HH:mm'),
      };
    } else {
      return {
        label: 'days',
        unitInMinutes: 24 * 60,
        unitWidth: 120 * zoom,
        totalUnits: 10,
        formatLabel: (d: Date) => format(d, 'dd MMM'),
      };
    }
  };
  const scale = getScaleConfig();

  // ---------- helpers ----------
  const isHoliday = (date: Date): boolean =>
    holidays.some((h) => h.date === format(date, 'yyyy-MM-dd') && h.team === 'production');

  const isWorkingDay = (date: Date): boolean => !isWeekend(date) && !isHoliday(date);

  const getWorkingHoursForDate = (date: Date): { start: Date; end: Date; breakMinutes: number } | null => {
    if (!isWorkingDay(date)) return null;
    const dayOfWeek = getDay(date);
    const wh = workingHours.find((w) => w.team === 'production' && w.day_of_week === dayOfWeek && w.is_active);
    if (!wh) return null;
    const [sh, sm] = wh.start_time.split(':').map(Number);
    const [eh, em] = wh.end_time.split(':').map(Number);
    const start = setMinutes(setHours(startOfDay(date), sh), sm);
    const end = setMinutes(setHours(startOfDay(date), eh), em);
    return { start, end, breakMinutes: wh.break_minutes };
  };

  const getNextWorkingDay = (date: Date): Date => {
    let d = addDays(date, 1);
    while (!getWorkingHoursForDate(d)) {
      d = addDays(d, 1);
    }
    return d;
  };

  // ---------- nieuwe functie: taken splitsen per werkdag ----------
  const getWorkingSlotsForTask = (from: Date, durationMinutes: number): { start: Date; end: Date }[] => {
    const slots: { start: Date; end: Date }[] = [];
    let remaining = durationMinutes;
    let currentStart = new Date(from);

    // Zorg dat we altijd in werkuren starten
    let wh = getWorkingHoursForDate(currentStart);
    while (!wh || currentStart >= wh.end) {
      currentStart = getNextWorkingDay(currentStart);
      wh = getWorkingHoursForDate(currentStart);
    }
    if (currentStart < wh.start) currentStart = wh.start;

    while (remaining > 0 && wh) {
      const availableToday = differenceInMinutes(wh.end, currentStart);
      if (availableToday <= 0) {
        // volgende werkdag
        currentStart = getNextWorkingDay(currentStart);
        wh = getWorkingHoursForDate(currentStart);
        if (!wh) break;
        currentStart = wh.start;
        continue;
      }

      const used = Math.min(availableToday, remaining);
      const end = addMinutes(currentStart, used);
      slots.push({ start: currentStart, end });
      remaining -= used;

      if (remaining > 0) {
        // volgende werkdag verder
        currentStart = getNextWorkingDay(currentStart);
        wh = getWorkingHoursForDate(currentStart);
        if (wh) currentStart = wh.start;
      }
    }
    return slots;
  };

  // ---------- timeline ----------
  const defaultWorkStartHour = 8;
  const timelineStart = (() => {
    const wh = getWorkingHoursForDate(selectedDate);
    if (wh) return wh.start;
    return setMinutes(setHours(startOfDay(selectedDate), defaultWorkStartHour), 0);
  })();

  const timeline = Array.from({ length: scale.totalUnits }, (_, i) =>
    addMinutes(timelineStart, i * scale.unitInMinutes)
  );

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
            workstations:
              t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
          })) || [];

        setTasks(transformed);

        const { data: limitPhasesData } = await supabase.from('standard_task_limit_phases').select('*');
        setLimitPhases(limitPhasesData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedDate]);

  // ---------- limit phases ----------
  const areLimitPhasesCompleted = (task: Task, completed: Set<string>): boolean => {
    if (!task.standard_task_id) return true;
    const limits = limitPhases.filter((lp) => lp.standard_task_id === task.standard_task_id);
    if (limits.length === 0) return true;
    const projectId = task.phases?.projects?.id;
    if (!projectId) return true;
    const projectTasks = tasks.filter((t) => t.phases?.projects?.id === projectId);
    return limits.every(
      (lp) => !projectTasks.find((t) => t.standard_task_id === lp.limit_standard_task_id) || completed.has(lp.limit_standard_task_id)
    );
  };

  // ---------- schedule berekenen ----------
  const getTasksForWorkstation = (id: string) =>
    tasks.filter((t) => t.workstations?.some((ws) => ws.id === id))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    const result: { task: Task; start: Date; end: Date }[] = [];
    const done = new Set<string>();
    if (!wsTasks.length) return result;

    let cursor = getWorkingHoursForDate(selectedDate)?.start || timelineStart;

    const todos = wsTasks.filter((t) => t.status === 'TODO');
    const holds = wsTasks.filter((t) => t.status === 'HOLD');

    for (const task of todos) {
      const slots = getWorkingSlotsForTask(cursor, task.duration);
      slots.forEach((slot) => result.push({ task, start: slot.start, end: slot.end }));
      done.add(task.id);
      cursor = result[result.length - 1].end;
    }

    let holdRemaining = [...holds];
    let safety = 0;
    while (holdRemaining.length && safety < 100) {
      safety++;
      const schedulable = holdRemaining.filter((t) => areLimitPhasesCompleted(t, done));
      if (!schedulable.length) break;
      for (const task of schedulable) {
        const slots = getWorkingSlotsForTask(cursor, task.duration);
        slots.forEach((slot) => result.push({ task, start: slot.start, end: slot.end }));
        done.add(task.id);
        cursor = result[result.length - 1].end;
      }
      holdRemaining = holdRemaining.filter((t) => !done.has(t.id));
    }

    return result;
  };

  // ---------- render ----------
  const getProjectColor = (id: string) => {
    const hue = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return { bg: `hsl(${hue},65%,45%)`, text: `hsl(${hue},100%,95%)` };
  };

  if (loading)
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Workstation Gantt Chart — met splitsing per werkdag</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setZoom((z) => Math.max(z / 1.5, 0.25))} variant="outline" size="sm">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button onClick={() => setZoom((z) => Math.min(z * 1.5, 6))} variant="outline" size="sm">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div ref={scrollContainerRef} className="overflow-auto border rounded-lg" style={{ maxHeight: 600 }}>
          {/* header */}
          <div
            className="sticky top-0 z-10 flex border-b bg-muted"
            style={{ marginLeft: workstationLabelWidth, height: headerHeight }}
          >
            {timeline.map((t, i) => (
              <div
                key={i}
                style={{ width: scale.unitWidth }}
                className="flex flex-col justify-center items-center border-r text-xs"
              >
                {scale.label === 'days' ? (
                  <>
                    <div>{format(t, 'EEE')}</div>
                    <div>{format(t, 'dd MMM')}</div>
                  </>
                ) : (
                  <div>{scale.formatLabel(t)}</div>
                )}
              </div>
            ))}
          </div>

          {/* rows */}
          {workstations.map((ws) => {
            const scheduled = computeTaskSchedule(ws.id);
            return (
              <div key={ws.id} className="relative border-b" style={{ height: rowHeight }}>
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center border-r bg-muted px-3 font-medium"
                  style={{ width: workstationLabelWidth }}
                >
                  {ws.name}
                </div>

                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: workstationLabelWidth, right: 0 }}
                >
                  {timeline.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-r border-border/40"
                      style={{ left: i * scale.unitWidth }}
                    />
                  ))}

                  <TooltipProvider>
                    {scheduled.map(({ task, start, end }) => {
                      const project = task.phases?.projects?.name || 'Project';
                      const projectId = task.phases?.projects?.id || '';
                      const { bg, text } = getProjectColor(projectId);

                      const offsetMin = differenceInMinutes(start, timelineStart);
                      const durationMin = differenceInMinutes(end, start);
                      const left = (offsetMin / scale.unitInMinutes) * scale.unitWidth;
                      const width = (durationMin / scale.unitInMinutes) * scale.unitWidth;

                      return (
                        <Tooltip key={`${task.id}-${start.toISOString()}`}>
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
                                border:
                                  task.status === 'HOLD'
                                    ? '2px dashed rgba(255,255,255,0.9)'
                                    : '1px solid rgba(0,0,0,0.2)',
                              }}
                            >
                              {project} – {task.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div><strong>Start:</strong> {format(start, 'dd MMM HH:mm')}</div>
                              <div><strong>End:</strong> {format(end, 'dd MMM HH:mm')}</div>
                              <div><strong>Status:</strong> {task.status}</div>
                              <div><strong>Duur:</strong> {task.duration} min</div>
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
      </CardContent>
    </Card>
  );
};

export default WorkstationGanttChart;
