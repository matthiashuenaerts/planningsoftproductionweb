
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Settings } from 'lucide-react';
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
  };
}

const WorkstationScheduleView: React.FC<WorkstationScheduleViewProps> = ({ selectedDate }) => {
  const [workstationSchedules, setWorkstationSchedules] = useState<WorkstationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const TIMELINE_START_HOUR = 7;
  const TIMELINE_END_HOUR = 16;
  const MINUTE_TO_PIXEL_SCALE = 2;

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

  useEffect(() => {
    fetchWorkstationSchedules();
  }, [selectedDate]);

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
          task:tasks(id, title, description, priority, status)
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');

      if (error) throw error;

      setWorkstationSchedules(data || []);
    } catch (error: any) {
      console.error('Error fetching workstation schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load workstation schedules",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Group schedules by workstation
  const groupedSchedules = workstationSchedules.reduce((acc, schedule) => {
    const workstationId = schedule.workstation_id;
    if (!acc[workstationId]) {
      acc[workstationId] = {
        workstation: schedule.workstation,
        schedules: []
      };
    }
    acc[workstationId].schedules.push(schedule);
    return acc;
  }, {} as Record<string, { workstation: any; schedules: WorkstationSchedule[] }>);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.keys(groupedSchedules).length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <Settings className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p>No workstation schedules found for this date</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedSchedules).map(([workstationId, { workstation, schedules }]) => (
          <Card key={workstationId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  {workstation?.name || 'Unknown Workstation'}
                </div>
                <Badge variant="outline">
                  {schedules.length} task{schedules.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              {workstation?.description && (
                <p className="text-sm text-gray-600">{workstation.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex">
                {/* Timeline Axis */}
                <div className="w-16 text-right pr-4 flex-shrink-0">
                  {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }).map((_, i) => {
                    const hour = TIMELINE_START_HOUR + i;
                    return (
                      <div
                        key={hour}
                        style={{ height: `${60 * MINUTE_TO_PIXEL_SCALE}px` }}
                        className="relative border-t border-gray-200 first:border-t-0 -mr-4"
                      >
                        <p className="text-xs text-gray-500 absolute -top-2 right-2">
                          {`${hour.toString().padStart(2, '0')}:00`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Schedule container */}
                <div className="relative flex-1 border-l border-gray-200">
                  {/* Hour lines */}
                  {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }).map((_, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute w-full h-px bg-gray-200"
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

                    return (
                      <div
                        key={schedule.id}
                        className="absolute left-2 right-2 z-10"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      >
                        <div className={`relative h-full overflow-hidden rounded border p-2 ${
                          schedule.task?.priority ? getPriorityColor(schedule.task.priority) : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          <div className="flex justify-between h-full">
                            <div className="flex-1 overflow-hidden">
                              <h5 className="font-medium text-sm truncate" title={schedule.task_title}>
                                {schedule.task_title}
                              </h5>
                              <p className="text-xs text-gray-600 truncate font-medium" title={schedule.user_name}>
                                👤 {schedule.user_name}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="flex items-center">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)} ({duration}m)
                                </span>
                                {schedule.task?.priority && (
                                  <Badge variant="outline" className="py-0 px-1 text-[10px]">
                                    {schedule.task.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
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
