
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
          task:tasks(id, title, status, priority, duration),
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

  const editTask = (task: ScheduledTask) => {
    setEditingTask(task);
    setShowTaskManager(true);
  };

  const handleTaskManagerSave = () => {
    fetchScheduledTasks();
    setShowTaskManager(false);
    setEditingTask(null);
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
        <div className="space-y-6">
          {employees.length > 0 ? (
            employees.map((employee) => (
              <Card key={employee.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      {employee.name}
                      {employee.workstation && (
                        <Badge variant="outline" className="ml-2">
                          {employee.workstation}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {timeSegments.map((segment) => (
                      <div key={segment.name} className="rounded-md border overflow-hidden">
                        <div className={cn("px-4 py-2 font-medium border-b", segment.color)}>
                          {segment.name} ({segment.startTime} - {segment.endTime})
                        </div>
                        
                        <div className="p-2 bg-white">
                          {getTasksForSegment(employee.id, segment.startTime, segment.endTime).length > 0 ? (
                            <div className="space-y-2">
                              {getTasksForSegment(employee.id, segment.startTime, segment.endTime).map((task) => (
                                <div 
                                  key={task.id} 
                                  className={cn(
                                    "rounded border p-3",
                                    task.is_auto_generated ? "bg-gray-50" : "bg-white",
                                    task.is_completed && "opacity-60"
                                  )}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium">{task.title}</div>
                                      
                                      {task.project && (
                                        <div className="text-sm text-muted-foreground mb-1">
                                          Project: {task.project.name}
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
                                        <p className="text-sm mt-2">{task.description}</p>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      {task.task?.priority && (
                                        <Badge className={cn("text-xs", getPriorityColor(task.task.priority))}>
                                          {task.task.priority}
                                        </Badge>
                                      )}
                                      
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem 
                                            onClick={() => editTask(task)}
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
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-6 text-center text-muted-foreground">
                              No tasks scheduled for this time segment
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 px-4 border rounded-lg">
              <p className="text-muted-foreground">
                {isAdmin 
                  ? "No employees found. Please add employees first."
                  : "No schedule available for you on this date."}
              </p>
            </div>
          )}
        </div>
      )}

      <PlanningTaskManager
        isOpen={showTaskManager}
        onClose={() => {
          setShowTaskManager(false);
          setEditingTask(null);
        }}
        selectedDate={selectedDate}
        selectedEmployee={editingTask?.employee_id || ''}
        scheduleItem={editingTask}
        onSave={handleTaskManagerSave}
      />
    </div>
  );
};

export default PlanningTimeline;
