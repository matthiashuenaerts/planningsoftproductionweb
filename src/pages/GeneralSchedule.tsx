import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Employee {
  id: string;
  name: string;
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
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // Generate time slots for the day (8 AM to 6 PM in 30-minute intervals)
  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = new Date(today);
      time.setHours(hour, minute, 0, 0);
      timeSlots.push(time);
    }
  }

  // Fetch all employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    }
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

  // Get schedules for a specific employee and time slot
  const getScheduleForEmployeeAtTime = (employeeId: string, timeSlot: Date) => {
    return schedules.find(schedule => {
      const scheduleStart = parseISO(schedule.start_time);
      const scheduleEnd = parseISO(schedule.end_time);
      return schedule.employee_id === employeeId &&
             scheduleStart <= timeSlot &&
             scheduleEnd > timeSlot;
    });
  };

  // Get holiday info for employee
  const getHolidayInfo = (employeeId: string) => {
    return holidays.find(holiday => holiday.user_id === employeeId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-full overflow-x-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">General Schedule - {format(today, 'EEEE, MMMM dd, yyyy')}</h1>
      </div>

      {/* Schedule Grid */}
      <div className="flex gap-4 min-w-fit">
        {/* Time Column */}
        <div className="flex flex-col gap-2 min-w-[100px]">
          <div className="h-12 flex items-center justify-center bg-muted rounded-md font-medium">
            <Clock className="h-4 w-4 mr-2" />
            Time
          </div>
          {timeSlots.map((timeSlot) => (
            <div
              key={timeSlot.toISOString()}
              className="h-16 flex items-center justify-center text-sm font-medium text-muted-foreground border-r border-border"
            >
              {format(timeSlot, 'HH:mm')}
            </div>
          ))}
        </div>

        {/* Employee Columns */}
        {employees.map((employee) => {
          const isOnHoliday = isEmployeeOnHoliday(employee.id);
          const holidayInfo = getHolidayInfo(employee.id);

          return (
            <div key={employee.id} className="flex flex-col gap-2 min-w-[200px]">
              {/* Employee Header */}
              <Card className="h-12">
                <CardContent className="p-3 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">{employee.name}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Time Slots */}
              {timeSlots.map((timeSlot) => {
                const schedule = getScheduleForEmployeeAtTime(employee.id, timeSlot);

                return (
                  <div
                    key={`${employee.id}-${timeSlot.toISOString()}`}
                    className="h-16 border border-border rounded-md"
                  >
                    {isOnHoliday ? (
                      <div className="h-full flex flex-col items-center justify-center bg-red-50 border-red-200 border rounded-md">
                        <Badge variant="destructive" className="text-xs px-1 mb-1">
                          HOLIDAY
                        </Badge>
                        {holidayInfo?.reason && (
                          <span className="text-xs text-red-600 text-center px-1 line-clamp-1">
                            {holidayInfo.reason}
                          </span>
                        )}
                      </div>
                    ) : schedule ? (
                      <div className="h-full bg-blue-50 border-blue-200 border rounded-md p-2 flex flex-col justify-center">
                        <div className="text-xs font-medium text-blue-800 line-clamp-1 mb-1">
                          {schedule.title}
                        </div>
                        <div className="text-xs text-blue-600 line-clamp-1">
                          {format(parseISO(schedule.start_time), 'HH:mm')} - 
                          {format(parseISO(schedule.end_time), 'HH:mm')}
                        </div>
                        {schedule.description && (
                          <div className="text-xs text-blue-500 line-clamp-1 mt-1">
                            {schedule.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center bg-gray-50 rounded-md">
                        <span className="text-xs text-muted-foreground">Free</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeneralSchedule;