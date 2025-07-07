import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isSameDay, addDays } from 'date-fns';
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

const GeneralScheduleView: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Get week boundaries
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

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

  // Fetch schedules for the current week
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules', weekStart.toISOString(), weekEnd.toISOString()],
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
        .gte('start_time', weekStart.toISOString())
        .lte('end_time', weekEnd.toISOString())
        .order('start_time');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch holiday requests for the current week
  const { data: holidays = [] } = useQuery<HolidayRequest[]>({
    queryKey: ['holidays', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_requests')
        .select('user_id, start_date, end_date, reason, employee_name')
        .eq('status', 'approved')
        .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
        .gte('end_date', format(weekStart, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data;
    }
  });

  // Generate days of the week
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i));
  }

  // Check if employee is on holiday for a specific date
  const isEmployeeOnHoliday = (employeeId: string, date: Date) => {
    return holidays.some(holiday => 
      holiday.user_id === employeeId &&
      new Date(holiday.start_date) <= date &&
      new Date(holiday.end_date) >= date
    );
  };

  // Get schedules for a specific employee and date
  const getSchedulesForEmployeeAndDate = (employeeId: string, date: Date) => {
    return schedules.filter(schedule => 
      schedule.employee_id === employeeId &&
      isSameDay(parseISO(schedule.start_time), date)
    );
  };

  // Get holiday info for employee and date
  const getHolidayInfo = (employeeId: string, date: Date) => {
    return holidays.find(holiday => 
      holiday.user_id === employeeId &&
      new Date(holiday.start_date) <= date &&
      new Date(holiday.end_date) >= date
    );
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">General Schedule Overview</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-4 py-2 text-sm font-medium bg-muted rounded-md">
            {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-8 gap-2 h-[calc(100vh-200px)]">
        {/* Employee Names Column */}
        <div className="space-y-2">
          <div className="h-12 flex items-center justify-center bg-muted rounded-md font-medium">
            <User className="h-4 w-4 mr-2" />
            Employee
          </div>
          {employees.map((employee) => (
            <Card key={employee.id} className="h-24">
              <CardContent className="p-3 flex items-center justify-center text-center">
                <span className="text-sm font-medium text-muted-foreground">
                  {employee.name}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Days Columns */}
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="space-y-2">
            {/* Day Header */}
            <div className="h-12 flex flex-col items-center justify-center bg-muted rounded-md">
              <div className="text-xs font-medium text-muted-foreground">
                {format(day, 'EEE')}
              </div>
              <div className="text-sm font-bold">
                {format(day, 'dd')}
              </div>
            </div>

            {/* Employee Schedules */}
            {employees.map((employee) => {
              const isOnHoliday = isEmployeeOnHoliday(employee.id, day);
              const employeeSchedules = getSchedulesForEmployeeAndDate(employee.id, day);
              const holidayInfo = getHolidayInfo(employee.id, day);

              return (
                <Card key={`${employee.id}-${day.toISOString()}`} className="h-24">
                  <CardContent className="p-2 space-y-1">
                    {isOnHoliday ? (
                      <div className="flex flex-col items-center justify-center h-full bg-red-50 rounded border-red-200 border">
                        <Badge variant="destructive" className="text-xs px-1">
                          HOLIDAY
                        </Badge>
                        {holidayInfo?.reason && (
                          <span className="text-xs text-red-600 text-center line-clamp-2">
                            {holidayInfo.reason}
                          </span>
                        )}
                      </div>
                    ) : employeeSchedules.length > 0 ? (
                      <div className="space-y-1 overflow-y-auto h-full">
                        {employeeSchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="bg-blue-50 border border-blue-200 rounded p-1"
                          >
                            <div className="text-xs font-medium text-blue-800 line-clamp-1">
                              {schedule.title}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(parseISO(schedule.start_time), 'HH:mm')} - 
                                {format(parseISO(schedule.end_time), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <span className="text-xs">No schedule</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneralScheduleView;