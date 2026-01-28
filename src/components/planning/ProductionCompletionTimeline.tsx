import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, ZoomIn, ZoomOut } from 'lucide-react';
import { format, addDays, startOfDay, differenceInDays, isWeekend, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';

interface ProjectCompletionInfo {
  projectId: string;
  projectName: string;
  client: string;
  installationDate: Date;
  lastProductionStepEnd?: Date;
  status: 'on_track' | 'at_risk' | 'overdue' | 'pending';
  daysRemaining: number;
}

interface ProductionCompletionTimelineProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  scheduleData?: any[];
}

const ProductionCompletionTimeline: React.FC<ProductionCompletionTimelineProps> = ({
  selectedDate,
  onDateChange,
  scheduleData
}) => {
  const [lastProductionStep, setLastProductionStep] = useState<StandardTask | null>(null);
  const [projectCompletions, setProjectCompletions] = useState<ProjectCompletionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week'>('week');
  const [timelineStart, setTimelineStart] = useState(startOfDay(new Date()));

  // Calculate timeline range based on zoom level
  const daysToShow = zoomLevel === 'day' ? 14 : 28;
  const dayWidth = zoomLevel === 'day' ? 80 : 40;

  useEffect(() => {
    fetchLastProductionStep();
  }, []);

  useEffect(() => {
    if (lastProductionStep) {
      fetchProjectCompletions();
    }
  }, [lastProductionStep, scheduleData]);

  const fetchLastProductionStep = async () => {
    try {
      const step = await standardTasksService.getLastProductionStep();
      setLastProductionStep(step);
    } catch (error) {
      console.error('Error fetching last production step:', error);
    }
  };

  const fetchProjectCompletions = async () => {
    if (!lastProductionStep) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch active projects with their tasks
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          client,
          installation_date,
          status
        `)
        .in('status', ['planned', 'in_progress'])
        .order('installation_date', { ascending: true });

      if (projectsError) throw projectsError;

      // Fetch scheduled completion times for last production step tasks
      const { data: schedules, error: schedulesError } = await supabase
        .from('gantt_schedules')
        .select(`
          id,
          task_id,
          end_time,
          scheduled_date,
          tasks!inner (
            id,
            standard_task_id,
            phases!inner (
              project_id
            )
          )
        `)
        .eq('tasks.standard_task_id', lastProductionStep.id);

      if (schedulesError) throw schedulesError;

      // Map scheduled completion times to projects
      const completionMap = new Map<string, Date>();
      schedules?.forEach((schedule: any) => {
        const projectId = schedule.tasks?.phases?.project_id;
        if (projectId) {
          const endTime = new Date(`${schedule.scheduled_date}T${schedule.end_time}`);
          const existing = completionMap.get(projectId);
          if (!existing || endTime > existing) {
            completionMap.set(projectId, endTime);
          }
        }
      });

      // Build project completion info
      const today = new Date();
      const completions: ProjectCompletionInfo[] = (projects || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const lastStepEnd = completionMap.get(project.id);
        const daysRemaining = differenceInDays(installationDate, today);

        let status: ProjectCompletionInfo['status'] = 'pending';
        if (lastStepEnd) {
          if (lastStepEnd > installationDate) {
            status = 'overdue';
          } else if (differenceInDays(installationDate, lastStepEnd) <= 2) {
            status = 'at_risk';
          } else {
            status = 'on_track';
          }
        }

        return {
          projectId: project.id,
          projectName: project.name,
          client: project.client,
          installationDate,
          lastProductionStepEnd: lastStepEnd,
          status,
          daysRemaining
        };
      });

      setProjectCompletions(completions.filter(p => p.daysRemaining >= -7)); // Show projects from past week
    } catch (error) {
      console.error('Error fetching project completions:', error);
    } finally {
      setLoading(false);
    }
  };

  const timelineDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      days.push(addDays(timelineStart, i));
    }
    return days;
  }, [timelineStart, daysToShow]);

  const navigateTimeline = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -7 : 7;
    setTimelineStart(addDays(timelineStart, offset));
  };

  const getStatusColor = (status: ProjectCompletionInfo['status']) => {
    switch (status) {
      case 'on_track': return 'bg-green-500';
      case 'at_risk': return 'bg-yellow-500';
      case 'overdue': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getStatusBadge = (status: ProjectCompletionInfo['status']) => {
    switch (status) {
      case 'on_track': return <Badge className="bg-green-100 text-green-800 border-green-300">On Track</Badge>;
      case 'at_risk': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">At Risk</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 border-red-300">Overdue</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getProjectPosition = (project: ProjectCompletionInfo) => {
    const startOffset = differenceInDays(project.installationDate, timelineStart);
    return Math.max(0, Math.min(startOffset, daysToShow - 1));
  };

  if (!lastProductionStep) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-amber-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Last Production Step Not Configured
          </CardTitle>
          <CardDescription className="text-amber-700">
            Please configure a "Last Production Step" in Settings → Standard Tasks to enable production timeline tracking and capacity calculations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Flag className="h-5 w-5 mr-2 text-primary" />
              Production Completion Timeline
            </CardTitle>
            <CardDescription className="flex items-center mt-1">
              <span>Milestone: </span>
              <Badge variant="outline" className="ml-2">
                {lastProductionStep.task_number} - {lastProductionStep.task_name}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoomLevel(zoomLevel === 'day' ? 'week' : 'day')}
            >
              {zoomLevel === 'day' ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateTimeline('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setTimelineStart(startOfDay(new Date()))}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateTimeline('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Timeline Header */}
            <ScrollArea className="w-full">
              <div style={{ width: `${daysToShow * dayWidth}px` }}>
                {/* Days Header */}
                <div className="flex border-b">
                  {timelineDays.map((day, index) => {
                    const isToday = isSameDay(day, new Date());
                    const isWeekendDay = isWeekend(day);
                    return (
                      <div
                        key={index}
                        className={`flex-shrink-0 text-center text-xs py-2 border-r ${
                          isToday ? 'bg-primary/10 font-bold' : isWeekendDay ? 'bg-muted/50' : ''
                        }`}
                        style={{ width: `${dayWidth}px` }}
                      >
                        <div className="font-medium">{format(day, 'EEE')}</div>
                        <div className={isToday ? 'text-primary' : 'text-muted-foreground'}>
                          {format(day, 'dd/MM')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Projects on Timeline */}
                <div className="relative min-h-[200px] py-2">
                  {/* Today indicator line */}
                  {timelineDays.some(d => isSameDay(d, new Date())) && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                      style={{
                        left: `${differenceInDays(new Date(), timelineStart) * dayWidth + dayWidth / 2}px`
                      }}
                    />
                  )}

                  {projectCompletions.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <Calendar className="h-5 w-5 mr-2" />
                      No active projects found
                    </div>
                  ) : (
                    projectCompletions.map((project, rowIndex) => {
                      const installPos = differenceInDays(project.installationDate, timelineStart);
                      const completionPos = project.lastProductionStepEnd
                        ? differenceInDays(project.lastProductionStepEnd, timelineStart)
                        : null;

                      const isInView = installPos >= 0 && installPos < daysToShow;
                      const completionInView = completionPos !== null && completionPos >= 0 && completionPos < daysToShow;

                      return (
                        <div
                          key={project.projectId}
                          className="relative h-10 flex items-center"
                          style={{ marginBottom: '4px' }}
                        >
                          {/* Completion marker */}
                          {completionInView && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`absolute h-6 w-6 rounded-full flex items-center justify-center ${getStatusColor(project.status)} text-white cursor-pointer z-20`}
                                    style={{
                                      left: `${completionPos! * dayWidth + dayWidth / 2 - 12}px`
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <div className="font-medium">{project.projectName}</div>
                                    <div>Production Complete: {format(project.lastProductionStepEnd!, 'dd/MM/yyyy HH:mm')}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* Line connecting completion to installation */}
                          {completionInView && isInView && (
                            <div
                              className={`absolute h-1 ${getStatusColor(project.status)}`}
                              style={{
                                left: `${completionPos! * dayWidth + dayWidth / 2}px`,
                                width: `${(installPos - completionPos!) * dayWidth}px`
                              }}
                            />
                          )}

                          {/* Installation marker (flag) */}
                          {isInView && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="absolute h-8 flex items-center cursor-pointer z-20"
                                    style={{
                                      left: `${installPos * dayWidth + dayWidth / 2 - 4}px`
                                    }}
                                  >
                                    <div className="flex flex-col items-center">
                                      <Flag className="h-5 w-5 text-primary" />
                                      <span className="text-xs truncate max-w-20 font-medium">
                                        {project.projectName.substring(0, 10)}
                                      </span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm space-y-1">
                                    <div className="font-bold">{project.projectName}</div>
                                    <div>Client: {project.client}</div>
                                    <div>Installation: {format(project.installationDate, 'dd/MM/yyyy')}</div>
                                    <div className="flex items-center gap-2">
                                      Status: {getStatusBadge(project.status)}
                                    </div>
                                    {project.lastProductionStepEnd && (
                                      <div>
                                        Production Complete: {format(project.lastProductionStepEnd, 'dd/MM/yyyy HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {projectCompletions.filter(p => p.status === 'on_track').length}
                </div>
                <div className="text-sm text-muted-foreground">On Track</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {projectCompletions.filter(p => p.status === 'at_risk').length}
                </div>
                <div className="text-sm text-muted-foreground">At Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {projectCompletions.filter(p => p.status === 'overdue').length}
                </div>
                <div className="text-sm text-muted-foreground">Overdue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {projectCompletions.filter(p => p.status === 'pending').length}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionCompletionTimeline;
