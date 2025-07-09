
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface Schedule {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  employee: { name: string };
  task?: {
    assignee?: {
      id: string;
      name: string;
    };
    phase?: {
      project?: {
        name: string;
      };
    };
  };
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
  };
}

interface HolidayRequest {
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  employee_name: string;
}

const GeneralSchedule: React.FC = () => {
  const [currentUserGroup, setCurrentUserGroup] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const today = new Date();
  const selectedDateStart = startOfDay(selectedDate);
  const selectedDateEnd = endOfDay(selectedDate);
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  // Timeline constants
  const TIMELINE_START_HOUR = 7;
  const TIMELINE_END_HOUR = 17;
  const MINUTE_TO_PIXEL_SCALE = 2;

  // Generate hour markers for the day (7 AM to 5 PM)
  const hourMarkers = [];
  for (let hour = 7; hour <= 17; hour++) {
    const time = new Date(selectedDate);
    time.setHours(hour, 0, 0, 0);
    hourMarkers.push(time);
  }

  // Timeline height calculation
  const timelineHeight = 'calc(100vh - 120px)';

  // Users per page
  const USERS_PER_PAGE = 6;

  // Helper function to get next workday (skip weekends)
  const getNextWorkday = (date: Date) => {
    let nextDay = addDays(date, 1);
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  };

  const nextWorkday = getNextWorkday(new Date());

  // Fetch all employees (excluding admins and managers)
  const { data: allEmployees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-filtered'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .not('role', 'in', '("admin","manager")')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Sort employees by role priority
  const employees = allEmployees.sort((a, b) => {
    const getRolePriority = (role: string) => {
      if (role === 'worker') return 1;
      if (role === 'installation_team') return 2;
      return 3;
    };

    const priorityA = getRolePriority(a.role);
    const priorityB = getRolePriority(b.role);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    return a.name.localeCompare(b.name);
  });

  // Fetch schedules for selected date
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules', selectedDateStart.toISOString(), selectedDateEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          employee_id,
          title,
          description,
          start_time,
          end_time,
          employee:employees(name),
          task:tasks(
            assignee:employees!tasks_assignee_id_fkey(id, name),
            phase:phases(
              project:projects(name)
            )
          )
        `)
        .gte('start_time', selectedDateStart.toISOString())
        .lte('end_time', selectedDateEnd.toISOString())
        .order('start_time');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch workstation schedules for selected date
  const { data: workstationSchedules = [] } = useQuery<WorkstationSchedule[]>({
    queryKey: ['workstation-schedules', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startOfDay = `${dateStr}T00:00:00`;
      const endOfDay = `${dateStr}T23:59:59`;

      const { data, error } = await supabase
        .from('workstation_schedules')
        .select(`
          *,
          workstation:workstations(id, name, description),
          task:tasks(
            id, 
            title, 
            description, 
            priority, 
            status,
            assignee:employees!tasks_assignee_id_fkey(id, name)
          )
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch holiday requests for selected date
  const { data: holidays = [] } = useQuery<HolidayRequest[]>({
    queryKey: ['holidays', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_requests')
        .select('user_id, start_date, end_date, reason, employee_name')
        .eq('status', 'approved')
        .lte('start_date', format(selectedDate, 'yyyy-MM-dd'))
        .gte('end_date', format(selectedDate, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data;
    }
  });

  // Helper functions
  const isEmployeeOnHoliday = (employeeId: string) => {
    return holidays.some(holiday => holiday.user_id === employeeId);
  };

  const getSchedulesForEmployee = (employeeId: string) => {
    return schedules.filter(schedule => schedule.employee_id === employeeId);
  };

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

  const getSchedulePosition = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - 7) * 60 + end.getMinutes();
    
    const totalMinutes = (17 - 7) * 60;
    const topPercent = (startMinutes / totalMinutes) * 100;
    const heightPercent = Math.max(((endMinutes - startMinutes) / totalMinutes) * 100, 2.5);
    
    return { top: `${topPercent}%`, height: `${heightPercent}%` };
  };

  const getCurrentEmployees = () => {
    const startIndex = currentUserGroup * USERS_PER_PAGE;
    return employees.slice(startIndex, startIndex + USERS_PER_PAGE);
  };

  const getHolidayInfo = (employeeId: string) => {
    return holidays.find(holiday => holiday.user_id === employeeId);
  };

  // Auto-cycle through user groups
  useEffect(() => {
    if (employees.length <= USERS_PER_PAGE) return;

    const interval = setInterval(() => {
      setCurrentUserGroup(prev => {
        const totalGroups = Math.ceil(employees.length / USERS_PER_PAGE);
        return (prev + 1) % totalGroups;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [employees.length, USERS_PER_PAGE]);

  // Group workstation schedules by workstation
  const groupedWorkstationSchedules = workstationSchedules.reduce((acc, schedule) => {
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

  const currentEmployees = getCurrentEmployees();
  const totalGroups = Math.ceil(employees.length / USERS_PER_PAGE);

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
          <h1 className="text-xl font-bold">General Schedule - {format(selectedDate, 'EEEE, MMM dd, yyyy')}</h1>
          {!isToday && (
            <div className="flex items-center gap-2 ml-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-orange-600 font-medium">
                {format(selectedDate, 'yyyy-MM-dd') === format(nextWorkday, 'yyyy-MM-dd') ? 'Next Workday' : 'Future Date'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Date Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isToday 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(nextWorkday)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                !isToday && format(selectedDate, 'yyyy-MM-dd') === format(nextWorkday, 'yyyy-MM-dd')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Next Workday
            </button>
          </div>

          {/* Employee Group Pagination */}
          {totalGroups > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Group {currentUserGroup + 1} of {totalGroups}</span>
              <div className="flex gap-1">
                {Array.from({ length: totalGroups }).map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentUserGroup ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Indicator */}
      {!isToday && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-800">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">
                You are viewing the schedule for {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workstation Schedules */}
      <div className="space-y-6 flex-1 overflow-y-auto">
        {Object.keys(groupedWorkstationSchedules).length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <Settings className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p>No workstation schedules found for this date</p>
                <p className="text-xs mt-1">Workstation schedules are generated from the planning page</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedWorkstationSchedules).map(([workstationId, { workstation, schedules }]) => (
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
                      const assignedUserName = schedule.task?.assignee?.name || schedule.user_name;

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
                                <p className="text-xs text-gray-600 truncate font-medium" title={assignedUserName}>
                                  👤 {assignedUserName}
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
                                {schedule.task?.description && height > 80 && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={schedule.task.description}>
                                    {schedule.task.description}
                                  </p>
                                )}
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
    </div>
  );
};

export default GeneralSchedule;
