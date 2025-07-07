import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
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
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // Generate hour markers for the day (7 AM to 6 PM)
  const hourMarkers = [];
  for (let hour = 7; hour <= 18; hour++) {
    const time = new Date(today);
    time.setHours(hour, 0, 0, 0);
    hourMarkers.push(time);
  }

  // Timeline height calculation (11 hours * 60px per hour)
  const timelineHeight = (18 - 7) * 60; // 660px total

  // Users per page
  const USERS_PER_PAGE = 6;

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

  // Sort employees by role priority: workers first, then workstations, then others
  const employees = allEmployees.sort((a, b) => {
    const getRolePriority = (role: string) => {
      if (role === 'worker') return 1;
      if (role === 'installation_team') return 2; // workstations
      return 3; // others
    };

    const priorityA = getRolePriority(a.role);
    const priorityB = getRolePriority(b.role);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same priority, sort by name
    return a.name.localeCompare(b.name);
  });

  // Fetch schedules for today
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules', todayStart.toISOString(), todayEnd.toISOString()],
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
          employee:employees(name)
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

  // Check if employee is on holiday today
  const isEmployeeOnHoliday = (employeeId: string) => {
    return holidays.some(holiday => holiday.user_id === employeeId);
  };

  // Get schedules for a specific employee
  const getSchedulesForEmployee = (employeeId: string) => {
    return schedules.filter(schedule => schedule.employee_id === employeeId);
  };

  // Calculate position and height for a schedule block
  const getSchedulePosition = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    // Calculate minutes from 7 AM
    const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - 7) * 60 + end.getMinutes();
    
    const top = startMinutes; // 1px per minute
    const height = Math.max(endMinutes - startMinutes, 15); // Minimum 15px height
    
    return { top, height };
  };

  // Get current page of employees
  const getCurrentEmployees = () => {
    const startIndex = currentUserGroup * USERS_PER_PAGE;
    return employees.slice(startIndex, startIndex + USERS_PER_PAGE);
  };

  // Auto-cycle through user groups every 10 seconds
  useEffect(() => {
    if (employees.length <= USERS_PER_PAGE) return;

    const interval = setInterval(() => {
      setCurrentUserGroup(prev => {
        const totalGroups = Math.ceil(employees.length / USERS_PER_PAGE);
        return (prev + 1) % totalGroups;
      });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [employees.length, USERS_PER_PAGE]);

  // Get holiday info for employee
  const getHolidayInfo = (employeeId: string) => {
    return holidays.find(holiday => holiday.user_id === employeeId);
  };

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
          <h1 className="text-xl font-bold">General Schedule - {format(today, 'EEEE, MMM dd, yyyy')}</h1>
        </div>
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

      {/* Schedule Grid */}
      <div className="flex gap-3 flex-1 overflow-hidden">
        {/* Time Column */}
        <div className="flex flex-col min-w-[80px] flex-shrink-0">
          <div className="h-10 flex items-center justify-center bg-muted rounded-md font-medium text-sm">
            <Clock className="h-3 w-3 mr-1" />
            Time
          </div>
          <div className="relative mt-2" style={{ height: `${timelineHeight}px` }}>
            {/* Hour markers */}
            {hourMarkers.map((hour, index) => (
              <div
                key={hour.toISOString()}
                className="absolute left-0 right-0 flex items-center text-xs font-medium text-muted-foreground"
                style={{ top: `${index * 60}px` }}
              >
                <span className="bg-background px-1">{format(hour, 'HH:mm')}</span>
                <div className="flex-1 h-px bg-border ml-2"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Columns */}
        {currentEmployees.map((employee, index) => {
          const isOnHoliday = isEmployeeOnHoliday(employee.id);
          const holidayInfo = getHolidayInfo(employee.id);
          const employeeSchedules = getSchedulesForEmployee(employee.id);

          return (
            <div key={employee.id} className="flex flex-col flex-1 hover-scale animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              {/* Employee Header */}
              <Card className="h-10">
                <CardContent className="p-2 flex items-center justify-center">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="text-sm font-medium truncate">{employee.name}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Container */}
              <div className="relative mt-2" style={{ height: `${timelineHeight}px` }}>
                {/* Background grid lines */}
                {hourMarkers.map((_, index) => (
                  <div
                    key={index}
                    className="absolute left-0 right-0 h-px bg-border opacity-30"
                    style={{ top: `${index * 60}px` }}
                  ></div>
                ))}

                {/* Holiday overlay */}
                {isOnHoliday && (
                  <div className="absolute inset-0 bg-red-50 border-2 border-red-200 border-dashed rounded-md flex flex-col items-center justify-center">
                    <Badge variant="destructive" className="text-xs px-2 mb-1">
                      HOLIDAY
                    </Badge>
                    {holidayInfo?.reason && (
                      <span className="text-xs text-red-600 text-center px-2 line-clamp-2">
                        {holidayInfo.reason}
                      </span>
                    )}
                  </div>
                )}

                {/* Schedule blocks */}
                {!isOnHoliday && employeeSchedules.map((schedule) => {
                  const position = getSchedulePosition(schedule.start_time, schedule.end_time);
                  
                  return (
                    <div
                      key={schedule.id}
                      className="absolute left-0 right-0 bg-blue-100 border border-blue-300 rounded-md p-1 overflow-hidden hover:bg-blue-200 transition-colors cursor-pointer"
                      style={{ 
                        top: `${position.top}px`, 
                        height: `${position.height}px`,
                        marginRight: '2px'
                      }}
                      title={`${schedule.title}\n${format(parseISO(schedule.start_time), 'HH:mm')} - ${format(parseISO(schedule.end_time), 'HH:mm')}\n${schedule.description || ''}`}
                    >
                      <div className="text-xs font-medium text-blue-800 line-clamp-1">
                        {schedule.title}
                      </div>
                      <div className="text-xs text-blue-600 line-clamp-1">
                        {format(parseISO(schedule.start_time), 'HH:mm')} - 
                        {format(parseISO(schedule.end_time), 'HH:mm')}
                      </div>
                      {schedule.description && position.height > 30 && (
                        <div className="text-xs text-blue-500 line-clamp-1 mt-1">
                          {schedule.description}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Free time indicator */}
                {!isOnHoliday && employeeSchedules.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-md opacity-50">
                    <span className="text-xs text-muted-foreground">Free</span>
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