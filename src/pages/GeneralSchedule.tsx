
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Workstation {
  id: string;
  name: string;
  description: string | null;
}

interface WorkstationSchedule {
  id: string;
  workstation_id: string;
  task_id: string | null;
  task_title: string;
  user_name: string;
  start_time: string;
  end_time: string;
  workstation: { name: string };
}

interface HolidayRequest {
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  employee_name: string;
}

const GeneralSchedule: React.FC = () => {
  const [currentWorkstationGroup, setCurrentWorkstationGroup] = useState(0);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // Generate hour markers for the day (7 AM to 5 PM)
  const hourMarkers = [];
  for (let hour = 7; hour <= 17; hour++) {
    const time = new Date(today);
    time.setHours(hour, 0, 0, 0);
    hourMarkers.push(time);
  }

  // Timeline height calculation (10 hours * flexible height)
  const timelineHeight = 'calc(100vh - 120px)';

  // Workstations per page
  const WORKSTATIONS_PER_PAGE = 6;

  // Fetch all workstations
  const { data: allWorkstations = [] } = useQuery<Workstation[]>({
    queryKey: ['workstations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workstations')
        .select('id, name, description')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch workstation schedules for today
  const { data: workstationSchedules = [], isLoading } = useQuery<WorkstationSchedule[]>({
    queryKey: ['workstation-schedules', todayStart.toISOString(), todayEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workstation_schedules')
        .select(`
          id,
          workstation_id,
          task_id,
          task_title,
          user_name,
          start_time,
          end_time,
          workstation:workstations(name)
        `)
        .gte('start_time', todayStart.toISOString())
        .lte('end_time', todayEnd.toISOString())
        .order('start_time');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch holiday requests for today
  const { data: holidays = [] } = useQuery<HolidayRequest[]>({
    queryKey: ['holidays', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_requests')
        .select('user_id, start_date, end_date, reason, employee_name')
        .eq('status', 'approved')
        .lte('start_date', format(today, 'yyyy-MM-dd'))
        .gte('end_date', format(today, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data;
    }
  });

  // Check if user is on holiday today
  const isUserOnHoliday = (userName: string) => {
    return holidays.some(holiday => holiday.employee_name === userName);
  };

  // Get schedules for a specific workstation
  const getSchedulesForWorkstation = (workstationId: string) => {
    return workstationSchedules.filter(schedule => schedule.workstation_id === workstationId);
  };

  // Calculate position and height for a schedule block
  const getSchedulePosition = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    // Calculate minutes from 7 AM
    const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - 7) * 60 + end.getMinutes();
    
    // Calculate as percentage of total timeline (10 hours = 600 minutes)
    const totalMinutes = (17 - 7) * 60; // 600 minutes
    const topPercent = (startMinutes / totalMinutes) * 100;
    const heightPercent = Math.max(((endMinutes - startMinutes) / totalMinutes) * 100, 2.5); // Minimum 2.5% height
    
    return { top: `${topPercent}%`, height: `${heightPercent}%` };
  };

  // Get current page of workstations
  const getCurrentWorkstations = () => {
    const startIndex = currentWorkstationGroup * WORKSTATIONS_PER_PAGE;
    return allWorkstations.slice(startIndex, startIndex + WORKSTATIONS_PER_PAGE);
  };

  // Auto-cycle through workstation groups every 15 seconds
  useEffect(() => {
    if (allWorkstations.length <= WORKSTATIONS_PER_PAGE) return;

    const interval = setInterval(() => {
      setCurrentWorkstationGroup(prev => {
        const totalGroups = Math.ceil(allWorkstations.length / WORKSTATIONS_PER_PAGE);
        return (prev + 1) % totalGroups;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [allWorkstations.length, WORKSTATIONS_PER_PAGE]);

  // Get holiday info for user
  const getHolidayInfo = (userName: string) => {
    return holidays.find(holiday => holiday.employee_name === userName);
  };

  const currentWorkstations = getCurrentWorkstations();
  const totalGroups = Math.ceil(allWorkstations.length / WORKSTATIONS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Workstation Schedule - {format(today, 'EEEE, MMM dd, yyyy')}</h1>
        </div>
        {totalGroups > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Group {currentWorkstationGroup + 1} of {totalGroups}</span>
            <div className="flex gap-1">
              {Array.from({ length: totalGroups }).map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentWorkstationGroup ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Grid */}
      <div className="flex gap-3 flex-1 overflow-hidden">
        {/* Time Column */}
        <div className="flex flex-col min-w-[80px] flex-shrink-0">
          <div className="h-10 flex items-center justify-center bg-muted rounded-md font-medium text-sm">
            <Clock className="h-3 w-3 mr-1" />
            Time
          </div>
          <div className="relative mt-2 flex-1" style={{ height: timelineHeight }}>
            {/* Hour markers */}
            {hourMarkers.map((hour, index) => (
              <div
                key={hour.toISOString()}
                className="absolute left-0 right-0 flex items-center text-xs font-medium text-muted-foreground"
                style={{ top: `${(index / (hourMarkers.length - 1)) * 100}%` }}
              >
                <span className="bg-background px-1">{format(hour, 'HH:mm')}</span>
                <div className="flex-1 h-px bg-border ml-2"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Workstation Columns */}
        {currentWorkstations.map((workstation, index) => {
          const workstationScheduleItems = getSchedulesForWorkstation(workstation.id);

          return (
            <div key={workstation.id} className="flex flex-col flex-1 hover-scale animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              {/* Workstation Header */}
              <Card className="h-10">
                <CardContent className="p-2 flex items-center justify-center">
                  <div className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    <span className="text-sm font-medium truncate">{workstation.name}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Container */}
              <div className="relative mt-2 flex-1" style={{ height: timelineHeight }}>
                {/* Background grid lines */}
                {hourMarkers.map((_, index) => (
                  <div
                    key={index}
                    className="absolute left-0 right-0 h-px bg-border opacity-30"
                    style={{ top: `${(index / (hourMarkers.length - 1)) * 100}%` }}
                  ></div>
                ))}

                {/* Schedule blocks */}
                {workstationScheduleItems.map((schedule) => {
                  const position = getSchedulePosition(schedule.start_time, schedule.end_time);
                  const isOnHoliday = isUserOnHoliday(schedule.user_name);
                  const holidayInfo = getHolidayInfo(schedule.user_name);
                  
                  return (
                    <div
                      key={schedule.id}
                      className={`absolute left-0 right-0 rounded-md p-1 overflow-hidden transition-colors cursor-pointer ${
                        isOnHoliday 
                          ? 'bg-red-100 border border-red-300' 
                          : 'bg-green-100 border border-green-300 hover:bg-green-200'
                      }`}
                      style={{ 
                        top: position.top, 
                        height: position.height,
                        marginRight: '2px'
                      }}
                      title={`${schedule.task_title}\n${format(parseISO(schedule.start_time), 'HH:mm')} - ${format(parseISO(schedule.end_time), 'HH:mm')}\nAssigned to: ${schedule.user_name}${isOnHoliday ? '\n⚠️ User is on holiday' : ''}`}
                    >
                      {isOnHoliday ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Badge variant="destructive" className="text-xs px-1 mb-1">
                            HOLIDAY
                          </Badge>
                          <div className="text-xs text-red-800 font-medium line-clamp-1">
                            {schedule.user_name}
                          </div>
                          {holidayInfo?.reason && (
                            <div className="text-xs text-red-600 text-center line-clamp-1">
                              {holidayInfo.reason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-medium text-green-800 line-clamp-1">
                            {schedule.task_title}
                          </div>
                          <div className="text-xs text-green-700 line-clamp-1 font-medium">
                            👤 {schedule.user_name}
                          </div>
                          <div className="text-xs text-green-600 line-clamp-1">
                            {format(parseISO(schedule.start_time), 'HH:mm')} - 
                            {format(parseISO(schedule.end_time), 'HH:mm')}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Free time indicator */}
                {workstationScheduleItems.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-md opacity-50">
                    <span className="text-xs text-muted-foreground">No Tasks</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeneralSchedule;
