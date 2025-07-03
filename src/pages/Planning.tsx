import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, isWeekend, isSameDay } from 'date-fns';
import { Calendar, Users, Clock, AlertTriangle, CheckCircle, Play, Pause, RefreshCw, User, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { planningService } from '@/services/planningService';
import { dataService } from '@/services/dataService';
import { supabase } from '@/integrations/supabase/client';
import EnhancedDailyTimeline from '@/components/EnhancedDailyTimeline';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

interface Employee {
  id: string;
  name: string;
  role: string;
  workstation?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date: string;
  assignee_id?: string;
  project_name?: string;
  project_id?: string;
  workstation?: string;
  phase_id: string;
  duration?: number;
}

interface Schedule {
  id: string;
  employee_id: string;
  task_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_auto_generated: boolean;
  employee?: Employee;
  task?: Task;
}

interface TimelineTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  status: string;
  project_name: string;
  project_id: string | null;
  workstation: string;
  priority: string;
  canComplete: boolean;
  isActive: boolean;
  employee_name?: string;
  employee_id?: string;
  is_on_holiday?: boolean;
}

const Planning: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [activeView, setActiveView] = useState<'overview' | 'timeline'>('overview');
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Employee[];
    }
  });

  // Fetch schedules for selected date
  const { data: schedules = [], isLoading: loadingSchedules, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', selectedDate],
    queryFn: () => planningService.getSchedulesByDate(selectedDate),
    enabled: !!selectedDate
  });

  // Generate planning mutation
  const generatePlanningMutation = useMutation({
    mutationFn: () => planningService.generateDailyPlan(selectedDate),
    onSuccess: () => {
      toast.success('Planning generated successfully');
      refetchSchedules();
    },
    onError: (error: any) => {
      console.error('Error generating planning:', error);
      toast.error(error.message || 'Failed to generate planning');
    }
  });

  // Generate personal planning mutation
  const generatePersonalPlanningMutation = useMutation({
    mutationFn: ({ employeeId, date }: { employeeId: string; date: Date }) => 
      planningService.generatePlanFromPersonalTasks(employeeId, date),
    onSuccess: () => {
      toast.success('Personal planning generated successfully');
      refetchSchedules();
    },
    onError: (error: any) => {
      console.error('Error generating personal planning:', error);
      toast.error(error.message || 'Failed to generate personal planning');
    }
  });

  // Check for employee holidays and transform schedules for timeline
  const timelineTasks = useMemo(async (): Promise<TimelineTask[]> => {
    if (!schedules || schedules.length === 0) return [];

    const tasks: TimelineTask[] = [];
    
    for (const schedule of schedules) {
      const employee = employees.find(emp => emp.id === schedule.employee_id);
      
      // Check if employee is on holiday
      let isOnHoliday = false;
      try {
        isOnHoliday = await planningService.isEmployeeOnHoliday(schedule.employee_id, selectedDate);
      } catch (error) {
        console.error('Error checking holiday status:', error);
      }

      const task: TimelineTask = {
        id: schedule.id,
        title: isOnHoliday ? `${employee?.name || 'Employee'} - On Approved Holiday` : schedule.title,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        description: isOnHoliday ? 'Employee has an approved holiday request for this date.' : (schedule.description || ''),
        status: isOnHoliday ? 'holiday' : (schedule.task?.status || 'scheduled'),
        project_name: isOnHoliday ? 'Holiday' : (schedule.task?.project_name || 'No Project'),
        project_id: isOnHoliday ? null : (schedule.task?.project_id || null),
        workstation: schedule.task?.workstation || employee?.workstation || '',
        priority: schedule.task?.priority || 'medium',
        canComplete: !isOnHoliday && (schedule.task?.status === 'in_progress' || schedule.task?.status === 'todo'),
        isActive: !isOnHoliday && schedule.task?.status === 'in_progress',
        employee_name: employee?.name,
        employee_id: schedule.employee_id,
        is_on_holiday: isOnHoliday
      };

      tasks.push(task);
    }

    return tasks;
  }, [schedules, employees, selectedDate]);

  // Convert the async useMemo to a proper async effect
  const [timelineTasksData, setTimelineTasksData] = useState<TimelineTask[]>([]);
  
  useEffect(() => {
    const loadTimelineTasks = async () => {
      const tasks = await timelineTasks;
      setTimelineTasksData(tasks);
    };
    
    loadTimelineTasks();
  }, [timelineTasks]);

  // Filter schedules based on selected employee
  const filteredSchedules = useMemo(() => {
    if (selectedEmployee === 'all') return schedules;
    return schedules.filter(schedule => schedule.employee_id === selectedEmployee);
  }, [schedules, selectedEmployee]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalSchedules = filteredSchedules.length;
    const employeesWithSchedules = new Set(filteredSchedules.map(s => s.employee_id)).size;
    const autoGenerated = filteredSchedules.filter(s => s.is_auto_generated).length;
    const holidaySchedules = timelineTasksData.filter(t => t.is_on_holiday).length;
    
    return {
      totalSchedules,
      employeesWithSchedules,
      autoGenerated,
      holidaySchedules
    };
  }, [filteredSchedules, timelineTasksData]);

  const handleGeneratePlanning = () => {
    generatePlanningMutation.mutate();
  };

  const handleGeneratePersonalPlanning = (employeeId: string) => {
    generatePersonalPlanningMutation.mutate({ employeeId, date: selectedDate });
  };

  const handleTaskStart = (taskId: string) => {
    console.log('Starting task:', taskId);
    toast.info('Task starting functionality would be implemented here');
  };

  const handleTaskComplete = (taskId: string) => {
    console.log('Completing task:', taskId);
    toast.info('Task completion functionality would be implemented here');
  };

  const handleShowFiles = (projectId: string) => {
    console.log('Showing files for project:', projectId);
    toast.info('Project files functionality would be implemented here');
  };

  const handleShowParts = (projectId: string) => {
    console.log('Showing parts for project:', projectId);
    toast.info('Parts list functionality would be implemented here');
  };

  const handleShowBarcode = (projectId: string) => {
    console.log('Showing barcode for project:', projectId);
    toast.info('Barcode functionality would be implemented here');
  };

  const handleShowOrders = (projectId: string) => {
    console.log('Showing orders for project:', projectId);
    toast.info('Orders functionality would be implemented here');
  };

  if (loadingEmployees || loadingSchedules) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading planning data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Production Planning</h1>
          <p className="text-muted-foreground">
            Manage daily schedules and task assignments
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleGeneratePlanning}
            disabled={generatePlanningMutation.isPending}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${generatePlanningMutation.isPending ? 'animate-spin' : ''}`} />
            {generatePlanningMutation.isPending ? 'Generating...' : 'Generate Weekly Plan'}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planning Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">View</label>
              <Select value={activeView} onValueChange={(value: 'overview' | 'timeline') => setActiveView(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold">{statistics.totalSchedules}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Employees Scheduled</p>
                <p className="text-2xl font-bold">{statistics.employeesWithSchedules}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto Generated</p>
                <p className="text-2xl font-bold">{statistics.autoGenerated}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">On Holiday</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.holidaySchedules}</p>
              </div>
              <Plane className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holiday Alert */}
      {statistics.holidaySchedules > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Plane className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>{statistics.holidaySchedules}</strong> scheduled task(s) cannot be completed today due to approved employee holidays.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeView} onValueChange={(value: string) => setActiveView(value as 'overview' | 'timeline')}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Overview</CardTitle>
              <CardDescription>
                Scheduled tasks for {format(selectedDate, 'PPPP')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSchedules.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No schedules found for the selected date and employee.</p>
                  <Button 
                    onClick={handleGeneratePlanning}
                    disabled={generatePlanningMutation.isPending}
                    className="mt-4"
                  >
                    Generate Planning
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSchedules.map((schedule) => {
                    const employee = employees.find(emp => emp.id === schedule.employee_id);
                    const isOnHoliday = timelineTasksData.find(t => t.id === schedule.id)?.is_on_holiday;
                    
                    return (
                      <div 
                        key={schedule.id} 
                        className={`p-4 border rounded-lg space-y-2 ${isOnHoliday ? 'bg-blue-50 border-blue-200' : 'hover:shadow-sm'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className={`font-medium ${isOnHoliday ? 'text-blue-800' : ''}`}>
                                {isOnHoliday ? `${employee?.name} - On Approved Holiday` : schedule.title}
                              </h3>
                              {schedule.is_auto_generated && (
                                <Badge variant="secondary" className="text-xs">Auto</Badge>
                              )}
                              {isOnHoliday && (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                                  <Plane className="h-3 w-3 mr-1" />
                                  Holiday
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {format(new Date(schedule.start_time), 'HH:mm')} - {format(new Date(schedule.end_time), 'HH:mm')}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {employee?.name || 'Unknown Employee'}
                              </span>
                            </div>

                            {isOnHoliday && (
                              <div className="mt-2 p-2 bg-blue-100 border border-blue-200 rounded text-sm text-blue-800">
                                Employee has an approved holiday request for this date. This task cannot be completed.
                              </div>
                            )}
                          </div>

                          {!isOnHoliday && selectedEmployee !== 'all' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGeneratePersonalPlanning(schedule.employee_id)}
                              disabled={generatePersonalPlanningMutation.isPending}
                            >
                              Generate Personal Plan
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <EnhancedDailyTimeline
            tasks={timelineTasksData}
            onStartTask={handleTaskStart}
            onCompleteTask={handleTaskComplete}
            onShowFiles={handleShowFiles}
            onShowParts={handleShowParts}
            onShowBarcode={handleShowBarcode}
            onShowOrders={handleShowOrders}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Planning;
