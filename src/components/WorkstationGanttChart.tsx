import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  parseISO,
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
  duration: number; // minuten
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
  workstations?: Array<{
    id: string;
    name: string;
  }>;
}

interface WorkstationGanttChartProps {
  selectedDate: Date; // referentiedatum (we gebruiken startOfDay(selectedDate) als timeline-start)
}

const WorkstationGanttChart: React.FC<WorkstationGanttChartProps> = ({ selectedDate }) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1); // hogere waarde = meer inzoomen (meer detail)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  // ---------- schaalconfiguratie (consistent in minuten) ----------
  const getScaleConfig = () => {
    // We gebruiken unitInMinutes (consistent) + unitWidth (px per unit)
    // Visible range (hoeveel tijd in view) verschilt per schaal
    if (zoom >= 2) {
      // minuten-niveau: 15-min units
      const unitInMinutes = 15;
      const unitWidth = 8 * zoom; // px per 15 min
      const visibleRangeMinutes = 24 * 60 * 3; // standaard 3 dagen zichtbaar (kan je aanpassen)
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return {
        label: 'minutes',
        unitInMinutes,
        unitWidth,
        totalUnits,
        formatLabel: (date: Date) => format(date, 'HH:mm'),
      };
    } else if (zoom >= 1) {
      // uur-niveau: 60-min units
      const unitInMinutes = 60;
      const unitWidth = 40 * zoom; // px per hour
      const visibleRangeMinutes = 24 * 60 * 3; // 3 dagen zichtbaar
      const totalUnits = Math.ceil(visibleRangeMinutes / unitInMinutes);
      return {
        label: 'hours',
        unitInMinutes,
        unitWidth,
        totalUnits,
        formatLabel: (date: Date) => format(date, 'HH:mm'),
      };
    } else {
      // dag-niveau: 1440-min units (1 dag)
      const unitInMinutes = 24 * 60;
      const unitWidth = 120 * zoom; // px per day
      const visibleRangeDays = 10; // 10 dagen zichtbaar
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
    // bepaal of tekst wit of donker moet zijn a.d.h.v. luminantie (eenvoudig)
    const text = `hsl(${hue}, 100%, 95%)`;
    return { bg, text };
  };

  // ---------- data fetch ----------
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
          .not('due_date', 'is', null)
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
            phases: t.phases,
            workstations:
              t.task_workstation_links?.map((l: any) => l.workstations).filter(Boolean) || [],
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

  // ---------- timeline (array van datums: iedere unit) ----------
  const timelineStart = startOfDay(selectedDate); // vaste referentie
  const timeline = (() => {
    const arr: Date[] = [];
    for (let i = 0; i < scale.totalUnits; i++) {
      arr.push(addMinutes(timelineStart, i * scale.unitInMinutes));
    }
    return arr;
  })();
  const timelineEnd = addMinutes(timelineStart, scale.totalUnits * scale.unitInMinutes);

  // ---------- taken per workstation (gesorteerd) ----------
  const getTasksForWorkstation = (workstationId: string) =>
    tasks
      .filter((t) => t.workstations?.some((ws) => ws.id === workstationId))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // ---------- schedule berekenen (geen overlap, minute-precise) ----------
  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    let currentTime = timelineStart; // start opeenvolgend plannen vanaf timelineStart
    const scheduled: Array<{ task: Task; start: Date; end: Date }> = [];

    for (const task of wsTasks) {
      // start = currentTime, end = start + duration (in minuten)
      const start = currentTime;
      const end = addMinutes(start, Math.max(1, Math.round(task.duration ?? 0))); // minimaal 1 minuut
      scheduled.push({ task, start, end });
      currentTime = end; // volgende taak start wanneer deze eindigt
    }

    return scheduled;
  };

  // ---------- controls ----------
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.5, 6));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.5, 0.25));
  const handleRefresh = () => {
    setLoading(true);
    // eenvoudige refresh (kan je vervangen door her-fetch)
    setTimeout(() => {
      setLoading(false);
    }, 200);
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
          <CardTitle>Workstation Gantt Chart (precies op minuten)</CardTitle>
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
          Zoom in voor uur/minuut-resolutie. Schaal en positionering zijn nu consistent op minutenbasis.
        </div>

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
                        const width = Math.max(6, Math.round(rawWidth)); // min breedte

                        // skip volledig buiten zichtbare range (of render clipped items if je wilt)
                        if (end <= timelineStart) return null;
                        if (start >= timelineEnd) return null;

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
                                  <div><strong>Start:</strong> {format(start, 'PPPp')}</div>
                                  <div><strong>End:</strong> {format(end, 'PPPp')}</div>
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
