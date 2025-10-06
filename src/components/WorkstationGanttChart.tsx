import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  addMinutes,
  addHours,
  addDays,
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
  duration: number; // in minutes
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
  selectedDate: Date;
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

  // === Determine current timeline scale ===
  const getScaleConfig = () => {
    if (zoom >= 2) {
      // minute-level
      return {
        label: 'minutes',
        unit: 30, // show every 30 minutes
        unitWidth: 4 * zoom, // 4px per 30 min * zoom
        totalUnits: 8 * 60 / 30 * 3, // 3 workdays (8h each)
        formatLabel: (date: Date) => format(date, 'HH:mm'),
        stepFn: addMinutes,
      };
    } else if (zoom >= 1) {
      // hour-level
      return {
        label: 'hours',
        unit: 1,
        unitWidth: 40 * zoom, // pixels per hour
        totalUnits: 8 * 3, // 3 workdays
        formatLabel: (date: Date) => format(date, 'HH:mm'),
        stepFn: addHours,
      };
    } else {
      // day-level
      return {
        label: 'days',
        unit: 1,
        unitWidth: 120 * zoom, // pixels per day
        totalUnits: 10, // 10 days
        formatLabel: (date: Date) => format(date, 'dd MMM'),
        stepFn: addDays,
      };
    }
  };

  const scale = getScaleConfig();

  // === Generate vibrant project color dynamically ===
  const getProjectColor = (projectId: string): { bg: string; text: string } => {
    if (!projectId) {
      return { bg: '#888', text: '#fff' };
    }
    const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    const bg = `hsl(${hue}, 70%, 45%)`;
    const text = `hsl(${hue}, 100%, 95%)`;
    return { bg, text };
  };

  // === Fetch workstations and tasks ===
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const workstationData = await workstationService.getAll();
        setWorkstations(workstationData);

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

        const transformedTasks =
          tasksData?.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            duration: task.duration,
            status: task.status,
            due_date: task.due_date,
            phase_id: task.phase_id,
            phases: task.phases,
            workstations:
              task.task_workstation_links?.map((link: any) => link.workstations).filter(Boolean) || [],
          })) || [];

        setTasks(transformedTasks);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // === Build timeline ===
  const getTimeline = () => {
    const dates: Date[] = [];
    let current = startOfDay(selectedDate);
    for (let i = 0; i < scale.totalUnits; i++) {
      dates.push(current);
      current = scale.stepFn(current, scale.unit);
    }
    return dates;
  };

  const timeline = getTimeline();

  // === Schedule tasks (no overlap, minute-precise) ===
  const getTasksForWorkstation = (id: string) =>
    tasks
      .filter((t) => t.workstations?.some((ws) => ws.id === id))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const computeTaskSchedule = (workstationId: string) => {
    const wsTasks = getTasksForWorkstation(workstationId);
    let currentTime = startOfDay(selectedDate);
    const schedule: Array<{ task: Task; start: Date; end: Date }> = [];

    for (const task of wsTasks) {
      const start = currentTime;
      const end = addMinutes(start, task.duration);
      schedule.push({ task, start, end });
      currentTime = end;
    }

    return schedule;
  };

  // === Zoom handlers ===
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.5, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.5, 0.3));
  const handleRefresh = () => window.location.reload();

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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workstation Gantt Chart (Minute-Accurate)</CardTitle>
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
          Zoom in to view hours and minutes. Tasks are scheduled sequentially without overlap.
        </div>

        <div
          ref={scrollContainerRef}
          className="overflow-auto border rounded-lg bg-background"
          style={{ maxHeight: '600px' }}
        >
          {/* Timeline header */}
          <div
            className="sticky top-0 z-20 bg-muted border-b"
            style={{
              marginLeft: `${workstationLabelWidth}px`,
              height: `${headerHeight}px`,
            }}
          >
            <div className="flex" style={{ height: '100%' }}>
              {timeline.map((t, i) => (
                <div
                  key={i}
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

          {/* Gantt body */}
          <div className="relative">
            {workstations.map((ws) => {
              const scheduled = computeTaskSchedule(ws.id);
              const height = rowHeight;

              return (
                <div key={ws.id} className="relative border-b" style={{ height: `${height}px` }}>
                  {/* Label */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-4 font-medium z-10"
                    style={{ width: `${workstationLabelWidth}px` }}
                  >
                    <div className="truncate">{ws.name}</div>
                  </div>

                  {/* Timeline */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${workstationLabelWidth}px`,
                      right: 0,
                    }}
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
                        const minutesFromStart = differenceInMinutes(start, selectedDate);
                        const taskMinutes = differenceInMinutes(end, start);
                        const left = Math.max(0, (minutesFromStart / scale.unit) * scale.unitWidth);
                        const width = Math.max(10, (taskMinutes / scale.unit) * scale.unitWidth);

                        const projectId = task.phases?.projects?.id || '';
                        const projectName = task.phases?.projects?.name || 'Unknown Project';
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
                                      : '1px solid rgba(0,0,0,0.2)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                  zIndex: 5,
                                }}
                              >
                                <div className="truncate font-bold text-sm">{projectName}</div>
                                <div className="truncate text-[11px] opacity-90 mt-0.5">
                                  {task.title}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs z-50 bg-popover">
                              <div className="space-y-1">
                                <div className="font-semibold text-base">{projectName}</div>
                                <div className="text-sm font-medium">{task.title}</div>
                                {task.description && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {task.description}
                                  </div>
                                )}
                                <div className="text-xs space-y-0.5 pt-2 border-t">
                                  <div>
                                    <strong>Start:</strong> {format(start, 'PPPp')}
                                  </div>
                                  <div>
                                    <strong>End:</strong> {format(end, 'PPPp')}
                                  </div>
                                  <div>
                                    <strong>Duration:</strong> {task.duration} minutes
                                  </div>
                                  <div>
                                    <strong>Status:</strong> {task.status}
                                  </div>
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
