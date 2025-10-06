import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  parseISO,
  isWeekend,
  addDays,
  setHours,
  setMinutes,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
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
  phases?: {
    name: string;
    projects: {
      id: string;
      name: string;
    };
  };
  workstations?: Array<{ id: string; name: string }>;
}

interface WorkstationGanttChartProps {
  selectedDate: Date;
}

// ------------------------------
// 📆 Werkrooster configuratie
// ------------------------------
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const BREAKS = [
  { start: { h: 10, m: 0 }, end: { h: 10, m: 15 } },
  { start: { h: 12, m: 30 }, end: { h: 13, m: 0 } },
];

function getNextWorkingTime(current: Date): Date {
  let date = new Date(current);

  while (true) {
    if (isWeekend(date)) {
      // volgende maandag 08:00
      date = startOfDay(addDays(date, 1));
      continue;
    }

    const start = setMinutes(setHours(startOfDay(date), WORK_START_HOUR), 0);
    const end = setMinutes(setHours(startOfDay(date), WORK_END_HOUR), 0);

    if (date < start) {
      date = start;
      continue;
    }

    if (date >= end) {
      // volgende dag om 08:00
      date = startOfDay(addDays(date, 1));
      continue;
    }

    // check pauzes
    for (const br of BREAKS) {
      const brStart = setMinutes(setHours(startOfDay(date), br.start.h), br.start.m);
      const brEnd = setMinutes(setHours(startOfDay(date), br.end.h), br.end.m);
      if (date >= brStart && date < brEnd) {
        date = brEnd;
        continue;
      }
    }

    return date;
  }
}

// ✅ Hulpfunctie: voeg werkminuten toe, oversla pauzes/weekends
function addWorkingMinutes(start: Date, minutes: number): Date {
  let remaining = minutes;
  let current = new Date(start);

  while (remaining > 0) {
    current = getNextWorkingTime(current);

    const startOfWork = setMinutes(setHours(startOfDay(current), WORK_START_HOUR), 0);
    const endOfWork = setMinutes(setHours(startOfDay(current), WORK_END_HOUR), 0);

    // bepaal volgende pauze
    let nextBreakStart = endOfWork;
    let nextBreakEnd = endOfWork;
    for (const br of BREAKS) {
      const brStart = setMinutes(setHours(startOfDay(current), br.start.h), br.start.m);
      const brEnd = setMinutes(setHours(startOfDay(current), br.end.h), br.end.m);
      if (brStart > current) {
        nextBreakStart = brStart;
        nextBreakEnd = brEnd;
        break;
      }
    }

    const untilBreak = differenceInMinutes(nextBreakStart, current);
    const untilEnd = differenceInMinutes(endOfWork, current);
    const usable = Math.min(untilBreak, untilEnd, remaining);

    if (usable <= 0) {
      // naar volgende dag of na pauze
      current = getNextWorkingTime(addMinutes(current, 1));
      continue;
    }

    current = addMinutes(current, usable);
    remaining -= usable;

    if (current >= nextBreakStart && current < nextBreakEnd) {
      current = nextBreakEnd;
    }

    if (current >= endOfWork) {
      // naar volgende werkdag
      current = getNextWorkingTime(addDays(current, 1));
    }
  }

  return current;
}

const WorkstationGanttChart: React.FC<WorkstationGanttChartProps> = ({ selectedDate }) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  // consistent minutenbasis
  const getScaleConfig = () => {
    if (zoom >= 2) {
      return { label: 'minutes', unitInMinutes: 15, unitWidth: 8 * zoom, visibleRangeMinutes: 24 * 60 * 3 };
    } else if (zoom >= 1) {
      return { label: 'hours', unitInMinutes: 60, unitWidth: 40 * zoom, visibleRangeMinutes: 24 * 60 * 3 };
    } else {
      return { label: 'days', unitInMinutes: 24 * 60, unitWidth: 120 * zoom, visibleRangeMinutes: 24 * 60 * 10 };
    }
  };

  const scale = getScaleConfig();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const workstationData = await workstationService.getAll();
        setWorkstations(workstationData || []);

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
            phases (
              name,
              projects ( id, name )
            ),
            task_workstation_links ( workstations ( id, name ) )
          `)
          .in('status', ['TODO', 'HOLD'])
          .not('due_date', 'is', null)
          .order('due_date');

        if (error) throw error;

        const transformed =
          (tasksData || []).map((t: any) => ({
            ...t,
            workstations: t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
          })) || [];

        setTasks(transformed);
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedDate]);

  const timelineStart = startOfDay(selectedDate);
  const totalUnits = Math.ceil(scale.visibleRangeMinutes / scale.unitInMinutes);
  const timeline = Array.from({ length: totalUnits }, (_, i) =>
    addMinutes(timelineStart, i * scale.unitInMinutes)
  );

  const getTasksForWorkstation = (wsId: string) =>
    tasks
      .filter((t) => t.workstations?.some((ws) => ws.id === wsId))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // ✅ nieuwe planner: alleen binnen werkuren
  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    let current = getNextWorkingTime(timelineStart);
    const scheduled: Array<{ task: Task; start: Date; end: Date }> = [];

    for (const task of wsTasks) {
      const start = getNextWorkingTime(current);
      const end = addWorkingMinutes(start, Math.max(1, Math.round(task.duration)));
      scheduled.push({ task, start, end });
      current = end;
    }
    return scheduled;
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.25));
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
        <AlertDescription>Add workstations to view scheduling.</AlertDescription>
      </Alert>
    );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Workstation Gantt Chart (met werkuren & pauzes)</CardTitle>
          <div className="flex gap-2">
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
        <div
          ref={scrollContainerRef}
          className="overflow-auto border rounded-lg bg-background"
          style={{ maxHeight: '600px' }}
        >
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
                  style={{ width: `${scale.unitWidth}px` }}
                >
                  {scale.label === 'days'
                    ? format(t, 'dd MMM')
                    : format(t, 'HH:mm')}
                </div>
              ))}
            </div>
          </div>

          {/* body */}
          <div className="relative">
            {workstations.map((ws) => {
              const scheduled = computeTaskSchedule(ws.id);
              return (
                <div key={ws.id} className="relative border-b" style={{ height: `${rowHeight}px` }}>
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-4 font-medium z-10"
                    style={{ width: `${workstationLabelWidth}px` }}
                  >
                    {ws.name}
                  </div>

                  <div className="absolute top-0 bottom-0" style={{ left: `${workstationLabelWidth}px`, right: 0 }}>
                    {timeline.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-border/50"
                        style={{ left: `${i * scale.unitWidth}px` }}
                      />
                    ))}

                    <TooltipProvider>
                      {scheduled.map(({ task, start, end }) => {
                        const minutesFromStart = differenceInMinutes(start, timelineStart);
                        const duration = differenceInMinutes(end, start);
                        const left = (minutesFromStart / scale.unitInMinutes) * scale.unitWidth;
                        const width = (duration / scale.unitInMinutes) * scale.unitWidth;
                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded-md px-2 py-1 text-xs font-medium shadow-md"
                                style={{
                                  left: `${left}px`,
                                  width: `${Math.max(6, width)}px`,
                                  top: `8px`,
                                  height: `${rowHeight - 16}px`,
                                  backgroundColor: '#4e79a7',
                                  color: '#fff',
                                }}
                              >
                                {task.title}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <div className="font-semibold">{task.title}</div>
                                <div>Start: {format(start, 'PPpp')}</div>
                                <div>Einde: {format(end, 'PPpp')}</div>
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
