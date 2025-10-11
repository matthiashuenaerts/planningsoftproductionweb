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
import { ZoomIn, ZoomOut, RefreshCw, Search, Plus, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

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
      const { data } = await supabase
        .from('tasks')
        .select(`
          id, title, description, duration, status, due_date, phase_id, standard_task_id,
          phases ( name, projects ( id, name ) ),
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
                  {workerCount > 1 && (
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {Array.from({ length: workerCount }).map((_, i) => (
                        <div key={i}>Worker {i + 1}</div>
                      ))}
                    </div>
                  )}
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

                          const pid = task.phases?.projects?.id || '';
                          const { bg, text } = getColor(pid);
                          const left = (differenceInMinutes(start, timelineStart) / scale.unitInMinutes) * scale.unitWidth;
                          const width = (differenceInMinutes(end, start) / scale.unitInMinutes) * scale.unitWidth;
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
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkstationGanttChart;
