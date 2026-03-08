import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

interface WorkstationScheduleViewProps {
  selectedDate: Date;
}

interface WorkstationSchedule {
  id: string;
  workstation_id: string;
  task_id?: string;
  task_title: string;
  user_name: string;
  start_time: string;
  end_time: string;
  workstation?: {
    id: string;
    name: string;
    description?: string;
  };
  task?: {
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    assignee?: {
      id: string;
      name: string;
    };
    phase?: {
      project?: {
        id: string;
        name: string;
      };
    };
  };
}

interface PositionedSchedule extends WorkstationSchedule {
  column: number;
  totalColumns: number;
}

const WorkstationScheduleView: React.FC<WorkstationScheduleViewProps> = ({ selectedDate }) => {
  const [workstationSchedules, setWorkstationSchedules] = useState<WorkstationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const TIMELINE_START_HOUR = 7;
  const TIMELINE_END_HOUR = 16;
  const MINUTE_TO_PIXEL_SCALE = isMobile ? 1.4 : 2;

  const getMinutesFromTimelineStart = (time: string | Date): number => {
    const date = new Date(time);
    const timelineStartDate = new Date(date);
    timelineStartDate.setHours(TIMELINE_START_HOUR, 0, 0, 0);
    const diff = (date.getTime() - timelineStartDate.getTime()) / (1000 * 60);
    return Math.max(0, diff);
  };

  const formatTime = (timeStr: string) => {
    return format(new Date(timeStr), 'HH:mm');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const resolveOverlaps = (schedules: WorkstationSchedule[]): PositionedSchedule[] => {
    const sortedSchedules = schedules.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const positionedSchedules: PositionedSchedule[] = [];
    
    for (const schedule of sortedSchedules) {
      const startTime = new Date(schedule.start_time).getTime();
      const endTime = new Date(schedule.end_time).getTime();
      
      const overlapping = positionedSchedules.filter(positioned => {
        const posStartTime = new Date(positioned.start_time).getTime();
        const posEndTime = new Date(positioned.end_time).getTime();
        return (startTime < posEndTime && endTime > posStartTime);
      });

      if (overlapping.length === 0) {
        positionedSchedules.push({ ...schedule, column: 0, totalColumns: 1 });
      } else {
        const usedColumns = overlapping.map(o => o.column);
        let column = 0;
        while (usedColumns.includes(column)) column++;
        
        const maxColumn = Math.max(...usedColumns, column);
        const totalColumns = maxColumn + 1;
        
        overlapping.forEach(positioned => { positioned.totalColumns = totalColumns; });
        positionedSchedules.push({ ...schedule, column, totalColumns });
      }
    }
    
    return positionedSchedules;
  };

  useEffect(() => { fetchWorkstationSchedules(); }, [selectedDate]);

  const fetchWorkstationSchedules = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startOfDay = `${dateStr}T00:00:00`;
      const endOfDay = `${dateStr}T23:59:59`;

      const { data, error } = await supabase
        .from('workstation_schedules')
        .select(`
          *,
          workstation:workstations(id, name, description),
          task:tasks(
            id, title, description, priority, status,
            assignee:employees!tasks_assignee_id_fkey(id, name),
            phase:phases(project:projects(id, name))
          )
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');

      if (error) throw error;
      setWorkstationSchedules(data || []);
    } catch (error: any) {
      console.error('Error fetching workstation schedules:', error);
      toast({ title: "Error", description: "Failed to load workstation schedules", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateWorkstationSchedules = async () => {
    if (!selectedDate) return;
    try {
      setGeneratingSchedule(true);
      const { data: workerSchedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          *, employee:employees(id, name, role, workstation),
          task:tasks(id, title, description, priority, task_workstation_links(workstation:workstations(id, name)))
        `)
        .gte('start_time', format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00')
        .lte('start_time', format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59')
        .not('task_id', 'is', null);

      if (schedulesError) throw schedulesError;

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await supabase.from('workstation_schedules').delete()
        .gte('start_time', `${dateStr}T00:00:00`).lte('start_time', `${dateStr}T23:59:59`);

      const workstationSchedulesToCreate = [];
      for (const schedule of workerSchedulesData || []) {
        const taskWorkstationLinks = schedule.task?.task_workstation_links || [];
        const userName = schedule.employee?.name || 'Unknown User';
        const startTime = new Date(schedule.start_time);
        const endTime = new Date(schedule.end_time);
        
        if (taskWorkstationLinks && taskWorkstationLinks.length > 0) {
          for (const link of taskWorkstationLinks) {
            const workstation = link.workstation;
            if (workstation) {
              workstationSchedulesToCreate.push({
                workstation_id: workstation.id, task_id: schedule.task_id,
                task_title: schedule.title, user_name: userName,
                start_time: startTime.toISOString(), end_time: endTime.toISOString()
              });
            }
          }
        }
      }

      if (workstationSchedulesToCreate.length > 0) {
        const { error: insertError } = await supabase.from('workstation_schedules').insert(workstationSchedulesToCreate);
        if (insertError) throw insertError;
      }

      await fetchWorkstationSchedules();
      toast({ title: "Workstation Schedules Generated", description: `Generated ${workstationSchedulesToCreate.length} workstation schedules` });
    } catch (error: any) {
      console.error('Error generating workstation schedules:', error);
      toast({ title: "Error", description: `Failed to generate workstation schedules: ${error.message}`, variant: "destructive" });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const groupedSchedules = workstationSchedules.reduce((acc, schedule) => {
    const workstationId = schedule.workstation_id;
    if (!acc[workstationId]) acc[workstationId] = { workstation: schedule.workstation, schedules: [] };
    acc[workstationId].schedules.push(schedule);
    return acc;
  }, {} as Record<string, { workstation: any; schedules: WorkstationSchedule[] }>);

  const resolvedGroupedSchedules = Object.keys(groupedSchedules).reduce((acc, workstationId) => {
    const group = groupedSchedules[workstationId];
    acc[workstationId] = { workstation: group.workstation, schedules: resolveOverlaps(group.schedules) };
    return acc;
  }, {} as Record<string, { workstation: any; schedules: PositionedSchedule[] }>);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", !isMobile && "space-y-6")}>
      {/* Generate Button */}
      <div className="flex justify-end">
        <Button
          onClick={generateWorkstationSchedules}
          disabled={generatingSchedule}
          className={cn("flex items-center gap-2", isMobile && "h-9 text-xs w-full")}
        >
          <Zap className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {generatingSchedule ? 'Generating...' : isMobile ? 'Generate Schedules' : 'Generate Workstation Schedules'}
        </Button>
      </div>

      {Object.keys(resolvedGroupedSchedules).length === 0 ? (
        <Card>
          <CardContent className={cn(isMobile ? "py-6" : "py-8")}>
            <div className="text-center text-muted-foreground">
              <Settings className={cn("mx-auto mb-2", isMobile ? "h-6 w-6" : "h-8 w-8")} />
              <p className={cn(isMobile && "text-sm")}>No workstation schedules found for this date</p>
              <p className={cn("mt-1", isMobile ? "text-[10px]" : "text-xs")}>Generate workstation schedules from worker schedules using the button above</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(resolvedGroupedSchedules).map(([workstationId, { workstation, schedules }]) => (
          <Card key={workstationId}>
            <CardHeader className={cn(isMobile && "px-3 py-2")}>
              <CardTitle className={cn("flex items-center justify-between", isMobile && "text-sm")}>
                <div className="flex items-center min-w-0">
                  <Settings className={cn(isMobile ? "h-3.5 w-3.5 mr-1.5 shrink-0" : "h-5 w-5 mr-2")} />
                  <span className="truncate">{workstation?.name || 'Unknown Workstation'}</span>
                </div>
                <Badge variant="outline" className={cn(isMobile && "text-[10px] px-1.5 py-0")}>
                  {schedules.length} task{schedules.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className={cn(isMobile && "px-2 pb-3")}>
              <div className="flex overflow-x-auto">
                {/* Timeline Axis */}
                <div className={cn("text-right flex-shrink-0", isMobile ? "w-10 pr-1" : "w-16 pr-4")}>
                  {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }).map((_, i) => {
                    const hour = TIMELINE_START_HOUR + i;
                    return (
                      <div
                        key={hour}
                        style={{ height: `${60 * MINUTE_TO_PIXEL_SCALE}px` }}
                        className={cn("relative border-t border-muted first:border-t-0", isMobile ? "-mr-1" : "-mr-4")}
                      >
                        <p className={cn("absolute -top-2 text-muted-foreground", isMobile ? "text-[9px] right-0.5" : "text-xs right-2")}>
                          {`${hour.toString().padStart(2, '0')}:00`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Schedule container */}
                <div className="relative flex-1 border-l border-muted min-w-0">
                  {/* Hour lines */}
                  {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }).map((_, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute w-full h-px bg-muted"
                      style={{ top: `${(i + 1) * 60 * MINUTE_TO_PIXEL_SCALE}px` }}
                    />
                  ))}

                  {/* Schedule Items */}
                  {schedules.map((schedule) => {
                    const duration = Math.round(
                      (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / (1000 * 60)
                    );
                    const top = getMinutesFromTimelineStart(schedule.start_time) * MINUTE_TO_PIXEL_SCALE;
                    const height = duration * MINUTE_TO_PIXEL_SCALE;
                    const widthPercentage = 100 / schedule.totalColumns;
                    const leftPercentage = schedule.column * widthPercentage;
                    const assignedUserName = schedule.task?.assignee?.name || schedule.user_name;
                    const projectName = schedule.task?.phase?.project?.name;

                    return (
                      <div
                        key={schedule.id}
                        className="absolute z-10"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${leftPercentage}%`,
                          width: `${widthPercentage - 1}%`,
                          marginLeft: '1px',
                          marginRight: '1px'
                        }}
                      >
                        <div className={cn(
                          "relative h-full overflow-hidden rounded border",
                          isMobile ? "p-1" : "p-2",
                          schedule.task?.priority ? getPriorityColor(schedule.task.priority) : 'bg-blue-100 text-blue-800 border-blue-300'
                        )}>
                          <div className="flex-1 overflow-hidden">
                            <h5 className={cn("font-medium truncate", isMobile ? "text-[10px] leading-tight" : "text-sm")} title={schedule.task_title}>
                              {schedule.task_title}
                            </h5>
                            {projectName && (
                              <p className={cn("truncate font-medium text-muted-foreground", isMobile ? "text-[9px]" : "text-xs")} title={projectName}>
                                📋 {projectName}
                              </p>
                            )}
                            {(!isMobile || height > 40) && (
                              <p className={cn("truncate font-medium text-muted-foreground", isMobile ? "text-[9px]" : "text-xs")} title={assignedUserName}>
                                👤 {assignedUserName}
                              </p>
                            )}
                            {(!isMobile || height > 55) && (
                              <div className={cn("mt-0.5 flex items-center gap-1 flex-wrap", isMobile ? "text-[9px]" : "text-xs")}>
                                <span className="flex items-center">
                                  <Clock className={cn(isMobile ? "mr-0.5 h-2.5 w-2.5" : "mr-1 h-3 w-3")} />
                                  {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)} ({duration}m)
                                </span>
                                {!isMobile && schedule.task?.priority && (
                                  <Badge variant="outline" className="py-0 px-1 text-[10px]">
                                    {schedule.task.priority}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {!isMobile && schedule.task?.description && height > 100 && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={schedule.task.description}>
                                {schedule.task.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default WorkstationScheduleView;
