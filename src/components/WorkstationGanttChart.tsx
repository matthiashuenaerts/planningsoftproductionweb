import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, differenceInDays, startOfDay, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

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
  const [zoom, setZoom] = useState(1); // 1 = normal, 2 = zoomed in, 0.5 = zoomed out
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Timeline configuration
  const daysToShow = Math.ceil(30 / zoom); // Show more days when zoomed out
  const dayWidth = 120 * zoom; // pixels per day
  const rowHeight = 60;
  const headerHeight = 80;
  const workstationLabelWidth = 200;

  // Generate project colors based on project ID
  const getProjectColor = (projectId: string): string => {
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ];
    const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Fetch workstations and tasks
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all workstations
        const workstationData = await workstationService.getAll();
        setWorkstations(workstationData);

        // Fetch tasks with status TODO or ON_HOLD
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
          .in('status', ['TODO', 'ON_HOLD'])
          .not('due_date', 'is', null)
          .order('due_date');

        if (error) {
          console.error('Error fetching tasks:', error);
          throw error;
        }

        console.log('Raw tasks data:', tasksData);
        console.log('Number of raw tasks:', tasksData?.length || 0);

        // Transform the data to match our Task interface
        const transformedTasks = tasksData?.map((task: any) => {
          const workstations = task.task_workstation_links?.map((link: any) => link.workstations).filter(Boolean) || [];
          console.log(`Task ${task.title}: ${workstations.length} workstations`, workstations);
          
          return {
            id: task.id,
            title: task.title,
            description: task.description,
            duration: task.duration,
            status: task.status,
            due_date: task.due_date,
            phase_id: task.phase_id,
            phases: task.phases,
            workstations: workstations
          };
        }) || [];

        console.log('Transformed tasks:', transformedTasks);
        console.log('Total tasks fetched:', transformedTasks.length);

        setTasks(transformedTasks);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // Get date range for the chart
  const getDateRange = () => {
    const dates: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      dates.push(addDays(selectedDate, i));
    }
    return dates;
  };

  const dateRange = getDateRange();

  // Get tasks for a specific workstation
  const getTasksForWorkstation = (workstationId: string): Task[] => {
    const filteredTasks = tasks.filter(task => 
      task.workstations?.some(ws => ws.id === workstationId)
    );
    console.log(`Workstation ${workstationId}: ${filteredTasks.length} tasks`);
    return filteredTasks;
  };

  // Calculate task position and width
  const getTaskPosition = (task: Task) => {
    const taskDate = startOfDay(parseISO(task.due_date));
    const daysDiff = differenceInDays(taskDate, selectedDate);
    
    // Show tasks that fall within or near the visible range
    if (daysDiff < -5 || daysDiff >= daysToShow + 5) return null;
    
    const left = Math.max(0, daysDiff * dayWidth);
    // Duration in minutes, assume 8-hour workday (480 minutes)
    const durationInDays = task.duration / 480;
    const width = Math.max(20, durationInDays * dayWidth); // Minimum width of 20px
    
    return { left, width, daysDiff };
  };

  // Detect overlapping tasks for the same workstation
  const getTaskRow = (task: Task, workstationTasks: Task[]): number => {
    const taskDate = parseISO(task.due_date);
    const taskEnd = addDays(taskDate, Math.ceil(task.duration / (8 * 60)));
    
    // Find which row this task should be in to avoid overlaps
    let row = 0;
    const rowAssignments: { row: number; task: Task }[] = [];
    
    for (const otherTask of workstationTasks) {
      if (otherTask.id === task.id) continue;
      
      const otherDate = parseISO(otherTask.due_date);
      const otherEnd = addDays(otherDate, Math.ceil(otherTask.duration / (8 * 60)));
      
      // Check if tasks overlap
      const overlaps = taskDate < otherEnd && taskEnd > otherDate;
      
      if (overlaps) {
        const otherRow = rowAssignments.find(r => r.task.id === otherTask.id)?.row ?? 0;
        if (otherRow === row) {
          row++;
        }
      }
    }
    
    return row;
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.3));
  };

  const handleRefresh = () => {
    setLoading(true);
    // Trigger re-fetch by updating a dependency
    setTasks([]);
    setTimeout(() => {
      const fetchData = async () => {
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
            .in('status', ['TODO', 'ON_HOLD'])
            .not('due_date', 'is', null)
            .order('due_date');

          if (error) {
            console.error('Error refreshing tasks:', error);
            throw error;
          }

          const transformedTasks = tasksData?.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            duration: task.duration,
            status: task.status,
            due_date: task.due_date,
            phase_id: task.phase_id,
            phases: task.phases,
            workstations: task.task_workstation_links?.map((link: any) => link.workstations).filter(Boolean) || []
          })) || [];

          console.log('Refreshed tasks:', transformedTasks.length);

          setTasks(transformedTasks);
        } catch (error) {
          console.error('Error refreshing data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, 100);
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
        <AlertDescription>
          No workstations found. Please configure workstations in settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workstation Gantt Chart</CardTitle>
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
          Showing tasks with status TODO or ON_HOLD. Use zoom controls to adjust view.
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="overflow-auto border rounded-lg bg-background"
          style={{ maxHeight: '600px' }}
        >
          {/* Timeline Header */}
          <div 
            className="sticky top-0 z-20 bg-muted border-b"
            style={{ 
              marginLeft: `${workstationLabelWidth}px`,
              height: `${headerHeight}px`
            }}
          >
            <div className="flex" style={{ height: '100%' }}>
              {dateRange.map((date, idx) => (
                <div
                  key={idx}
                  className="border-r flex flex-col items-center justify-center text-xs font-medium"
                  style={{ 
                    width: `${dayWidth}px`,
                    minWidth: `${dayWidth}px`
                  }}
                >
                  <div>{format(date, 'EEE')}</div>
                  <div className="text-lg font-semibold">{format(date, 'd')}</div>
                  <div className="text-muted-foreground">{format(date, 'MMM')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Chart Body */}
          <div className="relative">
            {workstations.map((workstation, wsIdx) => {
              const workstationTasks = getTasksForWorkstation(workstation.id);
              const maxRows = Math.max(1, ...workstationTasks.map(task => getTaskRow(task, workstationTasks) + 1));
              const adjustedRowHeight = rowHeight * maxRows;

              return (
                <div
                  key={workstation.id}
                  className="relative border-b"
                  style={{ height: `${adjustedRowHeight}px` }}
                >
                  {/* Workstation Label */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-muted border-r flex items-center px-4 font-medium z-10"
                    style={{ width: `${workstationLabelWidth}px` }}
                  >
                    <div className="truncate">{workstation.name}</div>
                  </div>

                  {/* Timeline Grid */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ 
                      left: `${workstationLabelWidth}px`,
                      right: 0
                    }}
                  >
                    {/* Grid lines */}
                    {dateRange.map((_, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 bottom-0 border-r border-border/50"
                        style={{ left: `${idx * dayWidth}px` }}
                      />
                    ))}

                    {/* Tasks */}
                    <TooltipProvider>
                      {workstationTasks.map((task) => {
                        const position = getTaskPosition(task);
                        if (!position) {
                          console.log(`Task ${task.title} is outside visible range`);
                          return null;
                        }

                        const row = getTaskRow(task, workstationTasks);
                        const projectId = task.phases?.projects?.id || '';
                        const projectName = task.phases?.projects?.name || 'Unknown Project';
                        const phaseName = task.phases?.name || '';

                        console.log(`Rendering task: ${projectName} - ${task.title}`, {
                          left: position.left,
                          width: position.width,
                          daysDiff: position.daysDiff,
                          row
                        });

                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded-md px-3 py-2 text-xs font-medium text-white cursor-pointer hover:brightness-110 hover:shadow-lg transition-all overflow-hidden shadow-md"
                                style={{
                                  left: `${position.left}px`,
                                  width: `${position.width}px`,
                                  top: `${row * rowHeight + 8}px`,
                                  height: `${rowHeight - 16}px`,
                                  backgroundColor: getProjectColor(projectId),
                                  border: task.status === 'ON_HOLD' ? '2px dashed rgba(255,255,255,0.7)' : '2px solid rgba(255,255,255,0.2)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                  zIndex: 5
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
                                  <div><strong>Due:</strong> {format(parseISO(task.due_date), 'PPP')}</div>
                                  <div><strong>Duration:</strong> {Math.round(task.duration / 60)} hours ({(task.duration / 480).toFixed(1)} days)</div>
                                  <div><strong>Status:</strong> {task.status}</div>
                                  <div><strong>Workstations:</strong> {task.workstations?.map(ws => ws.name).join(', ')}</div>
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
