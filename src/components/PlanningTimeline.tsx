import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Clock,
  Square,
  CheckSquare,
  MoreVertical,
  Edit,
  Trash2,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import PlanningTaskManager from './PlanningTaskManager';

interface PlanningTimelineProps {
  selectedDate: Date;
  employees: any[];
  isAdmin: boolean;
}

interface ScheduledTask {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  task_id: string | null;
  phase_id: string | null;
  is_auto_generated: boolean;
  is_completed?: boolean;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    name: string;
  };
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    duration?: number;
    workstation?: string;
  };
  phase?: {
    id: string;
    name: string;
    project_id: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

const PlanningTimeline: React.FC<PlanningTimelineProps> = ({ 
  selectedDate,
  employees,
  isAdmin
}) => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  
  // Convert date to string in ISO format
  const dateString = selectedDate.toISOString().split('T')[0];

  // Time segments for the day
  const timeSegments = [
    { name: 'Morning', startTime: '07:00', endTime: '10:00', color: 'bg-blue-50 border-blue-200' },
    { name: 'Mid-day', startTime: '10:15', endTime: '12:30', color: 'bg-green-50 border-green-200' },
    { name: 'Afternoon', startTime: '13:00', endTime: '16:00', color: 'bg-amber-50 border-amber-200' },
  ];

  useEffect(() => {
    fetchScheduledTasks();
  }, [selectedDate, employees, dateString]);

  const fetchScheduledTasks = async () => {
    try {
      setLoading(true);
      
      // Create the start and end datetime for the selected date
      const startDate = `${dateString}T00:00:00`;
      const endDate = `${dateString}T23:59:59`;
      
      let query = supabase
        .from('schedules')
        .select(`
          *,
          employee:employees(id, name),
          task:tasks(id, title, status, priority, duration, workstation),
          phase:phases(id, name, project_id)
        `)
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .order('start_time', { ascending: true });
        
      // If not admin, filter by employee ID
      if (!isAdmin && currentEmployee) {
        query = query.eq('employee_id', currentEmployee.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get project info for tasks that have phases
      const tasksWithProjects = await Promise.all((data || []).map(async (task) => {
        if (task.phase && task.phase.project_id) {
          const { data: projectData } = await supabase
            .from('projects')
            .select('id, name')
            .eq('id', task.phase.project_id)
            .single();
          
          return { ...task, project: projectData };
        }
        return task;
      }));
      
      setScheduledTasks(tasksWithProjects);
    } catch (error: any) {
      console.error('Error fetching scheduled tasks:', error);
      toast({
        title: 'Error',
        description: `Failed to load schedule: ${error.message}`,
        variant: 'destructive'
      });
      setScheduledTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const generateScheduleForEmployee = async (employeeId: string) => {
    try {
      setGeneratingSchedule(true);
      
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get employee's workstations
      const { data: workerWorkstations, error: workstationsError } = await supabase
        .from('employee_workstation_links')
        .select(`
          workstations (
            id,
            name
          )
        `)
        .eq('employee_id', employeeId);

      if (workstationsError) {
        console.error('Error fetching worker workstations:', workstationsError);
        throw workstationsError;
      }

      let assignedWorkstationNames = workerWorkstations?.map(link => link.workstations?.name).filter(Boolean) || [];
      
      // If no workstations assigned via links, check legacy workstation field
      if (assignedWorkstationNames.length === 0 && employee.workstation) {
        assignedWorkstationNames.push(employee.workstation);
      }

      if (assignedWorkstationNames.length === 0) {
        toast({
          title: "No Workstations Assigned",
          description: `${employee.name} has no workstations assigned. Please assign workstations first.`,
          variant: "destructive"
        });
        return;
      }

      // Clear existing auto-generated schedules for this employee and date
      await supabase
        .from('schedules')
        .delete()
        .eq('employee_id', employeeId)
        .gte('start_time', `${dateString}T00:00:00`)
        .lte('start_time', `${dateString}T23:59:59`)
        .eq('is_auto_generated', true);

      // Get available tasks for the employee's workstations
      let tasksQuery = supabase
        .from('tasks')
        .select(`
          *,
          phases (
            name,
            projects (name)
          )
        `)
        .neq('status', 'COMPLETED')
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      // Filter by assignee or workstation
      tasksQuery = tasksQuery.or(`assignee_id.eq.${employeeId},workstation.in.(${assignedWorkstationNames.map(w => `"${w}"`).join(',')})`);

      const { data: tasks, error: tasksError } = await tasksQuery;

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        throw tasksError;
      }

      if (!tasks || tasks.length === 0) {
        toast({
          title: "No Tasks Available",
          description: `No tasks available for ${employee.name}'s workstations: ${assignedWorkstationNames.join(', ')}`,
          variant: "destructive"
        });
        return;
      }

      // Sort tasks by priority and due date
      const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      tasks.sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
        
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA.getTime() - dateB.getTime();
      });

      // Create schedule items for each time segment
      const schedulesToInsert = [];
      let taskIndex = 0;

      for (const segment of timeSegments) {
        if (taskIndex >= tasks.length) break;

        const task = tasks[taskIndex];
        const startTime = new Date(`${dateString}T${segment.startTime}:00`);
        const endTime = new Date(`${dateString}T${segment.endTime}:00`);

        schedulesToInsert.push({
          employee_id: employeeId,
          task_id: task.id,
          title: task.title,
          description: task.description || '',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          is_auto_generated: true
        });

        taskIndex++;
      }

      // Insert schedules
      if (schedulesToInsert.length > 0) {
        const { error } = await supabase
          .from('schedules')
          .insert(schedulesToInsert);

        if (error) throw error;
      }

      await fetchScheduledTasks();
      
      toast({
        title: "Schedule Generated",
        description: `Generated ${schedulesToInsert.length} schedule items for ${employee.name}`,
      });
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedule: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };
  
  const markTaskCompleted = async (taskId: string) => {
    try {
      // First update the schedule status
      const updateData = { is_completed: true } as Record<string, boolean>;
      
      await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', taskId);
      
      // If it's linked to a task, update the task status too
      const scheduledTask = scheduledTasks.find(t => t.id === taskId);
      if (scheduledTask && scheduledTask.task_id) {
        await supabase
          .from('tasks')
          .update({ 
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            completed_by: currentEmployee?.id
          })
          .eq('id', scheduledTask.task_id);
      }
      
      // Update the UI
      setScheduledTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, is_completed: true, task: task.task ? { ...task.task, status: 'COMPLETED' } : null } 
            : task
        )
      );
      
      toast({
        title: 'Success',
        description: 'Task marked as completed'
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: `Failed to update task: ${error.message}`,
        variant: 'destructive'
      });
    }
  };
  
  const removeFromSchedule = async (taskId: string) => {
    try {
      await supabase
        .from('schedules')
        .delete()
        .eq('id', taskId);
      
      // Update the UI
      setScheduledTasks(prev => prev.filter(task => task.id !== taskId));
      
      toast({
        title: 'Success',
        description: 'Task removed from schedule'
      });
    } catch (error: any) {
      console.error('Error removing task:', error);
      toast({
        title: 'Error',
        description: `Failed to remove task: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleEditTask = (task: ScheduledTask) => {
    setEditingTask(task);
    setActiveEmployeeId(task.employee_id);
    setShowTaskManager(true);
  };

  const handleAddTask = (employeeId: string) => {
    setEditingTask(null);
    setActiveEmployeeId(employeeId);
    setShowTaskManager(true);
  };

  const handleTaskManagerSave = () => {
    fetchScheduledTasks();
    setShowTaskManager(false);
    setEditingTask(null);
    setActiveEmployeeId(null);
  };
  
  // Helper to format time
  const formatTime = (timeString: string) => {
    try {
      return format(parseISO(timeString), 'h:mm a');
    } catch (error) {
      return 'Invalid time';
    }
  };
  
  // Get tasks for a specific employee and time segment
  const getTasksForSegment = (employeeId: string, segmentStart: string, segmentEnd: string) => {
    // Convert segment times to ISO strings for comparison
    const segmentStartTime = `${dateString}T${segmentStart}:00`;
    const segmentEndTime = `${dateString}T${segmentEnd}:00`;
    
    return scheduledTasks.filter(task => {
      return (
        task.employee_id === employeeId &&
        new Date(task.start_time) >= new Date(segmentStartTime) &&
        new Date(task.start_time) < new Date(segmentEndTime)
      );
    });
  };
  
  // Get priority color
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

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-semibold w-64">Employee</th>
                    {timeSegments.map((segment) => (
                      <th key={segment.name} className="p-2 text-left font-semibold">
                        {segment.name} <span className="font-normal text-muted-foreground">({segment.startTime} - {segment.endTime})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.length > 0 ? (
                    employees.map((employee) => (
                      <tr key={employee.id} className="border-b align-top">
                        <td className="p-2">
                          <div className="flex flex-col sticky left-0">
                            <div className="font-medium flex items-center">
                              <User className="h-5 w-5 mr-2 flex-shrink-0" />
                              <span className="truncate">{employee.name}</span>
                            </div>
                            {employee.workstation && (
                              <Badge variant="outline" className="ml-7 mt-1 w-fit">
                                {employee.workstation}
                              </Badge>
                            )}
                            {isAdmin && (
                              <div className="flex items-center space-x-2 mt-2 ml-7">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => fetchScheduledTasks()}
                                  title="Refresh schedule"
                                  className="h-8 w-8"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  onClick={() => generateScheduleForEmployee(employee.id)}
                                  disabled={generatingSchedule}
                                  title="Generate schedule"
                                  className="h-8 w-8"
                                >
                                  <Zap className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </td>
                        {timeSegments.map((segment) => (
                          <td key={segment.name} className="p-2 align-top">
                            <div className="space-y-2">
                              {getTasksForSegment(employee.id, segment.startTime, segment.endTime).length > 0 ? (
                                getTasksForSegment(employee.id, segment.startTime, segment.endTime).map((task) => (
                                  <div 
                                    key={task.id} 
                                    className={cn(
                                      "rounded border p-3",
                                      task.is_auto_generated ? "bg-gray-50 border-gray-200" : "bg-white border-blue-200",
                                      task.is_completed && "opacity-60"
                                    )}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 pr-2">
                                        <div className="font-medium">{task.title}</div>
                                        
                                        {task.project && (
                                          <div className="text-sm text-blue-600 mb-1">
                                            Project: {task.project.name}
                                          </div>
                                        )}
                                        
                                        {task.task?.workstation && (
                                          <div className="text-sm text-purple-600 mb-1">
                                            Workstation: {task.task.workstation}
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center text-sm text-muted-foreground">
                                          <Clock className="h-3 w-3 mr-1" />
                                          {formatTime(task.start_time)} - {formatTime(task.end_time)}
                                          {task.task?.duration && (
                                            <span className="ml-2">
                                              ({task.task.duration}m)
                                            </span>
                                          )}
                                        </div>
                                        
                                        {task.description && (
                                          <p className="text-sm mt-2 text-gray-600 line-clamp-2">{task.description}</p>
                                        )}
                                      </div>
                                      
                                      <div className="flex flex-col items-end space-y-1">
                                        <div className="flex items-center space-x-2">
                                          {task.task?.priority && (
                                            <Badge className={cn("text-xs", getPriorityColor(task.task.priority))}>
                                              {task.task.priority}
                                            </Badge>
                                          )}
                                          
                                          {task.is_auto_generated && (
                                            <Badge variant="outline" className="text-xs">
                                              Auto
                                            </Badge>
                                          )}
                                          
                                          {isAdmin && (
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <MoreVertical className="h-4 w-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem 
                                                  onClick={() => handleEditTask(task)}
                                                >
                                                  <Edit className="h-4 w-4 mr-2" />
                                                  Edit Task
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                  onClick={() => markTaskCompleted(task.id)}
                                                  disabled={task.task?.status === 'COMPLETED' || task.is_completed}
                                                >
                                                  <CheckSquare className="h-4 w-4 mr-2" />
                                                  Mark as Completed
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => removeFromSchedule(task.id)}
                                                  className="text-red-600"
                                                >
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Remove from Schedule
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="py-6 text-center text-muted-foreground border-2 border-dashed border-gray-200 rounded h-full flex flex-col justify-center items-center min-h-[100px]">
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAddTask(employee.id)}
                                      className="mt-2"
                                    >
                                      <Square className="h-4 w-4 mr-1" />
                                      Add Task
                                    </Button>
                                  )}
                                  {!isAdmin && (
                                    <>
                                      <Square className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                      <p className="text-sm">No tasks scheduled</p>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={timeSegments.length + 1}>
                        <div className="text-center py-8 px-4 border rounded-lg m-2">
                          <p className="text-muted-foreground">
                            {isAdmin 
                              ? "No employees found. Please add employees first."
                              : "No schedule available for you on this date."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showTaskManager && (
        <PlanningTaskManager
          isOpen={showTaskManager}
          onClose={() => {
            setShowTaskManager(false);
            setEditingTask(null);
            setActiveEmployeeId(null);
          }}
          selectedDate={selectedDate}
          selectedEmployee={activeEmployeeId || ''}
          scheduleItem={editingTask}
          onSave={handleTaskManagerSave}
        />
      )}
    </div>
  );
};

export default PlanningTimeline;
