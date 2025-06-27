
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Calendar as CalendarIcon, Trash2, Edit, Plus } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import PersonalPlanningGenerator from '@/components/PersonalPlanningGenerator';
import PlanningTaskManager from '@/components/PlanningTaskManager';

interface Employee {
  id: string;
  name: string;
  role: string;
  workstation?: string;
}

interface Schedule {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  task_id?: string;
  phase_id?: string;
  employee_id: string;
  is_auto_generated: boolean;
  tasks?: {
    id: string;
    title: string;
    phases: {
      name: string;
      projects: {
        id: string;
        name: string;
        client: string;
      };
    };
  };
}

const Planning = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchSchedules();
    }
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to load employees: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const startOfSelectedDay = startOfDay(selectedDate);
      const endOfSelectedDay = endOfDay(selectedDate);

      console.log('Fetching schedules for date range:', {
        start: startOfSelectedDay.toISOString(),
        end: endOfSelectedDay.toISOString()
      });

      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          tasks(
            id,
            title,
            phases(
              name,
              projects(
                id,
                name,
                client
              )
            )
          )
        `)
        .gte('start_time', startOfSelectedDay.toISOString())
        .lte('start_time', endOfSelectedDay.toISOString())
        .order('start_time');

      if (error) throw error;

      console.log('Fetched schedules with project data:', data);
      setSchedules(data || []);
    } catch (error: any) {
      console.error('Error fetching schedules:', error);
      toast({
        title: 'Error',
        description: `Failed to load schedules: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Schedule deleted successfully'
      });

      fetchSchedules();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to delete schedule: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setSelectedEmployee(schedule.employee_id);
    setShowTaskManager(true);
  };

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setShowTaskManager(true);
  };

  const handleTaskManagerSave = () => {
    setShowTaskManager(false);
    setEditingSchedule(null);
    fetchSchedules();
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Unknown Employee';
  };

  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'HH:mm');
  };

  const getProjectInfo = (schedule: Schedule) => {
    if (schedule.tasks?.phases?.projects) {
      return {
        projectName: schedule.tasks.phases.projects.name,
        projectId: schedule.tasks.phases.projects.id
      };
    }
    return { projectName: 'No Project', projectId: null };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navbar />
      <div className="flex-1 ml-64 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Planning Management</h1>
          <p className="text-gray-600 mt-2">Manage daily schedules and generate planning for employees</p>
        </div>

        <PersonalPlanningGenerator
          selectedDate={selectedDate}
          employees={employees}
          selectedEmployee={selectedEmployee}
          onEmployeeChange={setSelectedEmployee}
          onPlanGenerated={fetchSchedules}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
              <Button
                onClick={handleAddSchedule}
                className="w-full mt-4"
                disabled={!selectedEmployee}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule Item
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  Daily Schedule - {format(selectedDate, 'MMMM dd, yyyy')}
                </CardTitle>
                <CardDescription>
                  View and manage scheduled tasks for the selected date
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No schedules found for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule) => {
                      const { projectName, projectId } = getProjectInfo(schedule);
                      
                      return (
                        <div key={schedule.id} className="border rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold text-lg">{schedule.title}</h3>
                                {schedule.is_auto_generated && (
                                  <Badge variant="secondary" className="text-xs">
                                    Auto-generated
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="text-sm text-green-600 font-medium mb-2">
                                Project: {projectName}
                                {projectId && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    (ID: {projectId})
                                  </span>
                                )}
                              </div>
                              
                              {schedule.description && (
                                <p className="text-gray-600 mb-2">{schedule.description}</p>
                              )}
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <div className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                </div>
                                <div className="flex items-center">
                                  <Users className="h-4 w-4 mr-1" />
                                  {getEmployeeName(schedule.employee_id)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditSchedule(schedule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {showTaskManager && (
          <PlanningTaskManager
            isOpen={showTaskManager}
            onClose={() => {
              setShowTaskManager(false);
              setEditingSchedule(null);
            }}
            selectedDate={selectedDate}
            selectedEmployee={selectedEmployee || ''}
            scheduleItem={editingSchedule}
            onSave={handleTaskManagerSave}
          />
        )}
      </div>
    </div>
  );
};

export default Planning;
