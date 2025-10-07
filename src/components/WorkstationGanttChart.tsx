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
  isAfter,
  isBefore,
  min,
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

  const getScaleConfig = () => {
    if (zoom >= 2) {
      return { unitInMinutes: 15, unitWidth: 8 * zoom, totalUnits: (24 * 60 * 3) / 15, format: 'HH:mm' };
    } else if (zoom >= 1) {
      return { unitInMinutes: 60, unitWidth: 40 * zoom, totalUnits: (24 * 60 * 3) / 60, format: 'HH:mm' };
    } else {
      return { unitInMinutes: 24 * 60, unitWidth: 120 * zoom, totalUnits: 10, format: 'dd MMM' };
    }
  };

  const scale = getScaleConfig();

  // ---------- helpers ----------
  const isHoliday = (date: Date): boolean => {
    const d = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === d && h.team === 'production');
  };

  const isWorkingDay = (date: Date): boolean => !isWeekend(date) && !isHoliday(date);

  const getWorkingHoursForDate = (date: Date) => {
    if (!isWorkingDay(date)) return null;
    const wh = workingHours.find(w => w.team === 'production' && w.day_of_week === getDay(date) && w.is_active);
    if (!wh) return null;

    const [sh, sm] = wh.start_time.split(':').map(Number);
    const [eh, em] = wh.end_time.split(':').map(Number);
    const start = setMinutes(setHours(startOfDay(date), sh), sm);
    const end = setMinutes(setHours(startOfDay(date), eh), em);
    return { start, end };
  };

  // ---------- verbeterde scheduler ----------
  const scheduleTaskStrict = (from: Date, duration: number): { start: Date; end: Date }[] => {
    const result: { start: Date; end: Date }[] = [];
    let remaining = duration;
    let cursor = from;

    while (remaining > 0) {
      let wh = getWorkingHoursForDate(cursor);
      while (!wh) {
        cursor = addDays(startOfDay(cursor), 1);
        wh = getWorkingHoursForDate(cursor);
      }

      const { start, end } = wh;
      if (isBefore(cursor, start)) cursor = start;
      if (isAfter(cursor, end)) {
        cursor = addDays(startOfDay(cursor), 1);
        continue;
      }

      const available = differenceInMinutes(end, cursor);
      const chunk = Math.min(available, remaining);
      const slotEnd = addMinutes(cursor, chunk);
      result.push({ start: cursor, end: slotEnd });
      remaining -= chunk;
      cursor = addMinutes(slotEnd, 1); // kleine sprong naar volgende minuut
    }

    return result;
  };

  // ---------- fetch ----------
  useEffect(() => {
    const fetchData = async () => {
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
        .select(`id,title,description,duration,status,due_date,phase_id,standard_task_id,
        phases(name,projects(id,name)),
        task_workstation_links(workstations(id,name))`)
        .in('status', ['TODO', 'HOLD'])
        .order('due_date');

      const transformed =
        (data || []).map((t: any) => ({
          ...t,
          workstations: t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
        })) || [];
      setTasks(transformed);

      const { data: limitPhasesData } = await supabase.from('standard_task_limit_phases').select('*');
      setLimitPhases(limitPhasesData || []);
      setLoading(false);
    };
    fetchData();
  }, [selectedDate]);

  // ---------- timeline start ----------
  const defaultStart = (() => {
    const wh = getWorkingHoursForDate(selectedDate);
    if (wh) return wh.start;
    return setHours(startOfDay(selectedDate), 8);
  })();

  const timeline = Array.from({ length: scale.totalUnits }, (_, i) =>
    addMinutes(defaultStart, i * scale.unitInMinutes)
  );

  const getTasksForWorkstation = (id: string) =>
    tasks.filter(t => t.workstations?.some(w => w.id === id));

  const computeSchedule = (id: string) => {
    const wsTasks = getTasksForWorkstation(id).sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    const planned: { task: Task; start: Date; end: Date }[] = [];
    let cursor = defaultStart;

    for (const t of wsTasks) {
      const slots = scheduleTaskStrict(cursor, t.duration);
      slots.forEach(s => planned.push({ task: t, start: s.start, end: s.end }));
      cursor = addMinutes(slots[slots.length - 1].end, 1);
    }

    return planned;
  };

  // ---------- UI ----------
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.25));
  const handleRefresh = () => setLoading(true);

  if (loading)
    return (
      <Card>
        <CardContent className="p-10 text-center">Loading Gantt Chart...</CardContent>
      </Card>
    );

  if (!workstations.length)
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Workstations</AlertTitle>
        <AlertDescription>Configureer eerst werkstations.</AlertDescription>
      </Alert>
    );

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between">
        <CardTitle>Workstation Gantt Chart – strikte werkuren</CardTitle>
        <div className="space-x-2">
          <Button size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="overflow-auto max-h-[600px] border rounded-lg">
        <div
          className="sticky top-0 bg-muted border-b"
          style={{ marginLeft: workstationLabelWidth, height: headerHeight }}
        >
          <div className="flex h-full">
            {timeline.map((t, i) => (
              <div
                key={i}
                className="border-r text-xs text-center flex items-center justify-center"
                style={{ width: scale.unitWidth }}
              >
                {format(t, scale.format)}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          {workstations.map(ws => {
            const scheduled = computeSchedule(ws.id);
            return (
              <div key={ws.id} className="relative border-b" style={{ height: rowHeight }}>
                <div
                  className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-3 font-medium"
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
                      className="absolute top-0 bottom-0 border-r border-border/30"
                      style={{ left: i * scale.unitWidth }}
                    />
                  ))}

                  <TooltipProvider>
                    {scheduled.map(({ task, start, end }, idx) => {
                      const minutesFromStart = differenceInMinutes(start, defaultStart);
                      const widthMinutes = differenceInMinutes(end, start);
                      const left = (minutesFromStart / scale.unitInMinutes) * scale.unitWidth;
                      const width = (widthMinutes / scale.unitInMinutes) * scale.unitWidth;
                      const color = task.status === 'HOLD' ? '#a0aec0' : '#3b82f6';
                      return (
                        <Tooltip key={task.id + idx}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute rounded text-xs px-2 py-1 overflow-hidden"
                              style={{
                                left,
                                width,
                                top: 8,
                                height: rowHeight - 16,
                                background: color,
                                color: 'white',
                              }}
                            >
                              {task.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <div><strong>{task.title}</strong></div>
                              <div>Start: {format(start, 'dd MMM HH:mm')}</div>
                              <div>End: {format(end, 'dd MMM HH:mm')}</div>
                              <div>Duration: {task.duration} min</div>
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
