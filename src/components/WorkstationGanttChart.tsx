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
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, RefreshCw, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  const scale = useMemo(() => {
    if (zoom >= 2) return { unitInMinutes: 15, unitWidth: 8 * zoom, totalUnits: (24 * 60 * 3) / 15, format: (d: Date) => format(d, 'HH:mm') };
    if (zoom >= 1) return { unitInMinutes: 60, unitWidth: 40 * zoom, totalUnits: 24 * 3, format: (d: Date) => format(d, 'HH:mm') };
    return { unitInMinutes: 1440, unitWidth: 120 * zoom, totalUnits: 10, format: (d: Date) => format(d, 'dd MMM') };
  }, [zoom]);

  // fetch all once - use dynamic imports to avoid hard failing when path aliases are not available
  useEffect(() => {
    (async () => {
      setLoading(true);
      let ws: Workstation[] = [];
      let wh: WorkingHours[] = [];
      let hd: Holiday[] = [];
      let t: Task[] = [];
      let lp: LimitPhase[] = [];

      // Try to load workstation service
      try {
        const svc = await import('@/services/workstationService').catch(() => null);
        if (svc && svc.workstationService && typeof svc.workstationService.getAll === 'function') {
          ws = (await svc.workstationService.getAll()) || [];
        }
      } catch (e) {
        // swallow - environment may not provide this module
        // eslint-disable-next-line no-console
        console.warn('workstationService not available in this environment', e);
      }

      // working hours
      try {
        const svc = await import('@/services/workingHoursService').catch(() => null);
        if (svc && svc.workingHoursService && typeof svc.workingHoursService.getWorkingHours === 'function') {
          wh = (await svc.workingHoursService.getWorkingHours()) || [];
        }
      } catch (e) {
        console.warn('workingHoursService not available', e);
      }

      // holidays
      try {
        const svc = await import('@/services/holidayService').catch(() => null);
        if (svc && svc.holidayService && typeof svc.holidayService.getHolidays === 'function') {
          hd = (await svc.holidayService.getHolidays()) || [];
        }
      } catch (e) {
        console.warn('holidayService not available', e);
      }

      setWorkstations(ws || []);
      setWorkingHours(wh || []);
      setHolidays(hd || []);

      // Tasks + limit phases via supabase (if available)
      try {
        const sup = await import('@/integrations/supabase/client').catch(() => null);
        if (sup && sup.supabase) {
          const selectQuery = 'id, title, description, duration, status, due_date, phase_id, standard_task_id, phases ( name, projects ( id, name ) ), task_workstation_links ( workstations ( id, name ) )';
          const { data } = await sup.supabase.from('tasks').select(selectQuery).in('status', ['TODO', 'HOLD']).order('due_date');

          t = (data || []).map((d: any) => ({
            ...d,
            workstations: d.task_workstation_links?.map((x: any) => x.workstations).filter(Boolean) || [],
          }));

          const { data: lpData } = await sup.supabase.from('standard_task_limit_phases').select('*');
          lp = lpData || [];
        }
      } catch (e) {
        console.warn('supabase client not available or query failed', e);
      }

      setTasks(t);
      setLimitPhases(lp);
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
    return { start: s, end: e };
  };

  // split task across days — optimized loop
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
      const available = differenceInMinutes(endToday, cur);
      const used = Math.min(remaining, available);
      res.push({ start: cur, end: addMinutes(cur, used) });
      remaining -= used;
      if (remaining > 0) {
        cur = getNextWorkday(cur);
        wh = getWorkHours(cur);
        cur = wh!.start;
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

  // memoize full schedule for all workstations with dependency resolution
  const schedule = useMemo(() => {
    const all = new Map<string, { task: Task; start: Date; end: Date; isVisible: boolean }[]>();
    const workstationCursors = new Map<string, Date>();
    const scheduledTaskEndTimes = new Map<string, Date>(); // Track when each task ends
    const timelineStart = getWorkHours(selectedDate)?.start || setHours(startOfDay(selectedDate), 8);

    // Initialize cursors for all workstations
    workstations.forEach((ws) => {
      workstationCursors.set(ws.id, timelineStart);
      all.set(ws.id, []);
    });

    // Separate TODO and HOLD tasks (use ALL tasks for positioning)
    const todoTasks = tasks
      .filter((t) => t.status === 'TODO' && t.workstations && t.workstations.length > 0)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const holdTasks = tasks
      .filter((t) => t.status === 'HOLD' && t.workstations && t.workstations.length > 0)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

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
        const cursor = workstationCursors.get(ws.id) || timelineStart;
        const slots = getTaskSlots(cursor, task.duration);

        if (slots.length > 0) {
          const taskList = all.get(ws.id) || [];
          slots.forEach((s) => taskList.push({ task, ...s, isVisible }));
          all.set(ws.id, taskList);

          // Update cursor to end of this task
          const lastSlot = slots[slots.length - 1];
          workstationCursors.set(ws.id, lastSlot.end);

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
    let maxIterations = holdTasks.length * 5; // give it a few more passes to resolve dependencies
    let iteration = 0;

    while (remainingHoldTasks.size > 0 && iteration < maxIterations) {
      iteration++;
      let scheduledInThisPass = false;

      for (const task of holdTasks) {
        if (!remainingHoldTasks.has(task.id)) continue;

        const projectId = task.phases?.projects?.id || '';
        const isVisible = isTaskVisible(task);

        // Determine the earliest cursor among assigned workstations
        let earliestCursor: Date | null = null;
        for (const ws of task.workstations || []) {
          const cursor = workstationCursors.get(ws.id) || timelineStart;
          if (!earliestCursor || cursor < earliestCursor) earliestCursor = cursor;
        }
        if (!earliestCursor) earliestCursor = timelineStart;

        // Check dependency requirement: get the maximum end time of limit tasks in the same project
        const dependencyEnd = getRequiredDependencyEndForTask(task, scheduledTaskEndTimes);
        if (dependencyEnd === null) {
          // Some limit task exists but hasn't been scheduled yet — skip this task for now
          continue;
        }

        // The actual start must be after both the earliest cursor and dependency end
        const earliestStart = dependencyEnd > earliestCursor ? dependencyEnd : earliestCursor;

        // Schedule on all assigned workstations starting from earliestStart (each workstation uses its own cursor >= earliestStart)
        let latestEndTime: Date | null = null;

        // We will compute slots per workstation, but ensure each workstation's cursor is bumped to at least earliestStart first
        for (const ws of task.workstations || []) {
          const originalCursor = workstationCursors.get(ws.id) || timelineStart;
          const startCursor = originalCursor > earliestStart ? originalCursor : earliestStart;

          const slots = getTaskSlots(startCursor, task.duration);

          if (slots.length > 0) {
            const taskList = all.get(ws.id) || [];
            slots.forEach((s) => taskList.push({ task, ...s, isVisible }));
            all.set(ws.id, taskList);

            // Update cursor to end of this task
            const lastSlot = slots[slots.length - 1];
            workstationCursors.set(ws.id, lastSlot.end);

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

  const getColor = (id: string) => {
    const hue = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return { bg: `hsl(${hue},65%,45%)`, text: `hsl(${hue},100%,95%)` };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <CardTitle>Workstation Gantt Chart (snel & opgesplitst)</CardTitle>
          <div className="flex gap-2 items-center">
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
            const tasks = schedule.get(ws.id) || [];
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
                    {tasks.map(({ task, start, end, isVisible }) => {
                      if (!isVisible) return null;

                      const pid = task.phases?.projects?.id || '';
                      const { bg, text } = getColor(pid);
                      const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                      const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
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
                              <div><b>Duur:</b> {task.duration} min</div>
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

  // Compute workstation bottlenecks (top 3 by total delay)
  const workstationBottlenecks = useMemo(() => {
    const delayMap = new Map<string, number>();

    for (const [wsId, scheduled] of schedule.entries()) {
      let totalDelay = 0;
      scheduled.forEach(({ task, end }) => {
        const due = task.due_date ? new Date(task.due_date) : null;
        if (due && end > due) {
          totalDelay += differenceInMinutes(end, due);
        }
      });
      if (totalDelay > 0) delayMap.set(wsId, totalDelay);
    }

    const sorted = Array.from(delayMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return sorted.map(([id, minutes], idx) => ({ id, minutes, rank: idx + 1 }));
  }, [schedule]);

  const formatDelay = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

 const getBottleneckStyle = (id: string) => {
  if (bottleneck.rank === 1) {
    return { background: 'rgba(255,200,200,0.15)', borderLeft: '4px solid hsl(0,75%,45%)' };
  }
  if (bottleneck.rank === 2) {
    return { background: 'rgba(255,220,180,0.14)', borderLeft: '4px solid hsl(25,75%,45%)' };
  }
  if (bottleneck.rank === 3) {
    return { background: 'rgba(255,245,200,0.14)', borderLeft: '4px solid hsl(45,75%,45%)' };
  }
  return {}; // fallback style
}; // ✅ Close the helper function properly

return (
  <Card>
    …


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <CardTitle>Workstation Gantt Chart (snel & opgesplitst)</CardTitle>
          <div className="flex gap-2 items-center">
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
        {/* Bottleneck summary panel */}
        <div className="mt-3">
          <div className="flex gap-3 items-center">
            {workstationBottlenecks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bottlenecks detected</div>
            ) : (
              workstationBottlenecks.map((b) => {
                const ws = workstations.find((w) => w.id === b.id);
                return (
                  <div key={b.id} className="px-3 py-1 rounded-md border" style={{ minWidth: 180 }}>
                    <div className="text-sm font-medium">
                      {b.rank === 1 ? '🥇' : b.rank === 2 ? '🥈' : '🥉'} {ws?.name || b.id}
                    </div>
                    <div className="text-xs text-muted-foreground">Total delay: {formatDelay(b.minutes)}</div>
                  </div>
                );
              })
            )}
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
            const tasks = schedule.get(ws.id) || [];
            return (
              <div key={ws.id} className="relative border-b" style={{ height: rowHeight }}>
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center border-r bg-muted px-3 font-medium"
                  style={{ width: workstationLabelWidth, ...(getBottleneckStyle(ws.id) as React.CSSProperties) }}
                >
                  {ws.name}
                </div>
                <div className="absolute top-0 bottom-0" style={{ left: workstationLabelWidth, right: 0 }}>
                  {timeline.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-border/40" style={{ left: i * scale.unitWidth }} />
                  ))}
                  <TooltipProvider>
                    {tasks.map(({ task, start, end, isVisible }) => {
                      if (!isVisible) return null;

                      const pid = task.phases?.projects?.id || '';
                      const { bg, text } = getColor(pid);
                      const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                      const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
                      // highlight if this task passes its due date
                      const due = task.due_date ? new Date(task.due_date) : null;
                      const isLate = due ? end > due : false;
                      const lateBadge = isLate ? (
                        <div className="absolute -top-2 -right-2 text-xs font-bold rounded-full px-1 py-0" style={{ background: 'rgba(255,0,0,0.9)', color: '#fff' }}>
                          !
                        </div>
                      ) : null;

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
                                border: '1px solid rgba(0,0,0,0.2)',
                              }}
                            >
                              {lateBadge}
                              {task.phases?.projects?.name || 'Project'} – {task.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <div><b>Start:</b> {format(start, 'dd MMM HH:mm')}</div>
                              <div><b>Einde:</b> {format(end, 'dd MMM HH:mm')}</div>
                              <div><b>Duur:</b> {task.duration} min</div>
                              <div><b>Status:</b> {task.status}</div>
                              {isLate && due && <div><b>Delay:</b> {formatDelay(differenceInMinutes(end, due))}</div>}
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
