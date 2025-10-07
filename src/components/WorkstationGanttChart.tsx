import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  isBefore,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  const scale = useMemo(() => {
    if (zoom >= 2)
      return { unitInMinutes: 15, unitWidth: 8 * zoom, totalUnits: (24 * 60 * 3) / 15, format: (d: Date) => format(d, 'HH:mm') };
    if (zoom >= 1)
      return { unitInMinutes: 60, unitWidth: 40 * zoom, totalUnits: 24 * 3, format: (d: Date) => format(d, 'HH:mm') };
    return { unitInMinutes: 1440, unitWidth: 120 * zoom, totalUnits: 10, format: (d: Date) => format(d, 'dd MMM') };
  }, [zoom]);

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

      const { data: taskData } = await supabase
        .from('tasks')
        .select(`
          id, title, description, duration, status, due_date, phase_id, standard_task_id,
          phases ( name, projects ( id, name ) ),
          task_workstation_links ( workstations ( id, name ) )
        `)
        .in('status', ['TODO', 'HOLD'])
        .order('due_date');

      const mapped = (taskData || []).map((t: any) => ({
        ...t,
        workstations: t.task_workstation_links?.map((x: any) => x.workstations).filter(Boolean) || [],
      }));
      setTasks(mapped);

      const { data: lp } = await supabase.from('standard_task_limit_phases').select('*');
      setLimitPhases(lp || []);
      setLoading(false);
    })();
  }, [selectedDate]);

  const workingHoursMap = useMemo(() => {
    const m = new Map<number, WorkingHours>();
    workingHours
      .filter((w) => w.team === 'production' && w.is_active)
      .forEach((w) => m.set(w.day_of_week, w));
    return m;
  }, [workingHours]);

  const holidaySet = useMemo(
    () => new Set(holidays.filter((h) => h.team === 'production').map((h) => h.date)),
    [holidays]
  );

  const isWorkingDay = (date: Date) => {
    const day = getDay(date);
    if (!workingHoursMap.has(day)) return false;
    if (holidaySet.has(format(date, 'yyyy-MM-dd'))) return false;
    return !isWeekend(date);
  };

  // ✅ beveiligd tegen oneindige loop
  const getNextWorkday = (date: Date) => {
    let d = addDays(date, 1);
    let counter = 0;
    while (!isWorkingDay(d)) {
      d = addDays(d, 1);
      counter++;
      if (counter > 30) {
        console.warn("⚠️ No valid workday found within 30 days after", date);
        break;
      }
    }
    return d;
  };

  const getWorkHours = (date: Date) => {
    const wh = workingHoursMap.get(getDay(date));
    if (!wh) return null;

    const [sh, sm] = (wh.start_time || "08:00").split(":").map(Number);
    const [eh, em] = (wh.end_time || "17:00").split(":").map(Number);

    const s = setMinutes(setHours(startOfDay(date), sh), sm);
    const e = setMinutes(setHours(startOfDay(date), eh), em);
    return { start: s, end: e };
  };

  // ✅ veiliger splitsing van taken over dagen
  const getTaskSlots = (from: Date, duration: number) => {
    const res: { start: Date; end: Date }[] = [];
    let remaining = duration;
    let cur = from;
    let guard = 0;

    while (remaining > 0 && guard < 1000) {
      guard++;
      let wh = getWorkHours(cur);
      if (!wh) {
        cur = getNextWorkday(cur);
        continue;
      }
      if (cur < wh.start) cur = wh.start;
      if (cur >= wh.end) {
        cur = getNextWorkday(cur);
        continue;
      }

      const available = differenceInMinutes(wh.end, cur);
      const used = Math.min(remaining, available);
      res.push({ start: cur, end: addMinutes(cur, used) });
      remaining -= used;
      cur = addMinutes(cur, used);

      if (cur >= wh.end && remaining > 0) {
        cur = getNextWorkday(cur);
      }
    }

    if (guard >= 1000) console.warn("⚠️ Task splitting loop exceeded 1000 iterations for task duration:", duration);
    return res;
  };

  // ✅ crash-safe scheduling logica
  const schedule = useMemo(() => {
    try {
      const all = new Map<string, { task: Task; start: Date; end: Date }[]>();
      const projectTaskEndTimes = new Map<string, Date>();

      const getLimitEnd = (limitIds: string[]) => {
        const ends = limitIds
          .map((id) => projectTaskEndTimes.get(id))
          .filter((d): d is Date => !!d)
          .sort((a, b) => a.getTime() - b.getTime());
        return ends.length ? ends[ends.length - 1] : null;
      };

      for (const ws of workstations) {
        const wsTasks = tasks
          .filter((t) => t.workstations?.some((x) => x.id === ws.id))
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        let cursor = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);
        const list: { task: Task; start: Date; end: Date }[] = [];

        for (const task of wsTasks) {
          let startTime = cursor;

          // HANDLE LIMIT PHASE LOGIC
          if (task.status === 'HOLD' && task.standard_task_id) {
            const limits = limitPhases
              .filter((lp) => lp.standard_task_id === task.standard_task_id)
              .map((lp) => lp.limit_standard_task_id);
            const limitEnd = getLimitEnd(limits);
            if (limitEnd && isBefore(startTime, limitEnd)) startTime = limitEnd;
          }

          const slots = getTaskSlots(startTime, task.duration);
          if (slots.length === 0) continue;

          slots.forEach((s) => list.push({ task, ...s }));
          const taskEnd = list[list.length - 1].end;
          cursor = taskEnd;

          if (task.standard_task_id) projectTaskEndTimes.set(task.standard_task_id, taskEnd);
        }

        all.set(ws.id, list);
      }

      return all;
    } catch (err) {
      console.error("❌ Error computing schedule:", err);
      return new Map();
    }
  }, [tasks, workstations, selectedDate, limitPhases, workingHoursMap, holidaySet]);

  if (loading)
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <RefreshCw className="animate-spin h-8 w-8" />
        </CardContent>
      </Card>
    );

  const getColor = (id: string) => {
    const hue = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return { bg: `hsl(${hue},65%,45%)`, text: `hsl(${hue},100%,95%)` };
  };

  const timeline = Array.from({ length: scale.totalUnits }, (_, i) => addMinutes(timelineStart, i * scale.unitInMinutes));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Workstation Gantt Chart — Limit Phases toegepast</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))} variant="outline" size="sm">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button onClick={() => setZoom((z) => Math.min(6, z * 1.5))} variant="outline" size="sm">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="overflow-auto border rounded-lg" style={{ maxHeight: 600 }}>
          <div className="sticky top-0 z-10 flex border-b bg-muted" style={{ marginLeft: workstationLabelWidth, height: headerHeight }}>
            {timeline.map((t, i) => (
              <div key={i} style={{ width: scale.unitWidth }} className="flex flex-col justify-center items-center border-r text-xs">
                {scale.format(t)}
              </div>
            ))}
          </div>

          {workstations.map((ws) => {
            const wsTasks = schedule.get(ws.id) || [];
            return (
              <div key={ws.id} className="relative border-b" style={{ height: rowHeight }}>
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center border-r bg-muted px-3 font-medium"
                  style={{ width: workstationLabelWidth }}
                >
                  {ws.name}
                </div>
                <div className="absolute top-0 bottom-0" style={{ left: workstationLabelWidth, right: 0 }}>
                  {timeline.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-border/40" style={{ left: i * scale.unitWidth }} />
                  ))}
                  <TooltipProvider>
                    {wsTasks.map(({ task, start, end }) => {
                      const pid = task.phases?.projects?.id || '';
                      const { bg, text } = getColor(pid);
                      const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                      const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
                      const opacity = task.status === 'HOLD' ? 0.6 : 1;
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
                                opacity,
                                border: '1px solid rgba(0,0,0,0.2)',
                              }}
                            >
                              {task.phases?.projects?.name || 'Project'} – {task.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <div><b>Start:</b> {format(start, 'dd MMM HH:mm')}</div>
                              <div><b>Einde:</b> {format(end, 'dd MMM HH:mm')}</div>
                              <div><b>Status:</b> {task.status}</div>
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
