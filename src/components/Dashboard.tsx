import React, { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';
import TaskList from './TaskList';
import SeedDataButton from './SeedDataButton';
import HolidayRequestsList from './HolidayRequestsList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { projectService, taskService, Project, Task } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ShieldCheck, 
  Calendar, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  BarChart3,
  ListTodo,
  Truck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { format, startOfToday, isToday, subDays, parseISO, addDays, isWeekend, startOfWeek } from 'date-fns';
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { supabase } from '@/integrations/supabase/client';
import { holidayService, Holiday } from '@/services/holidayService';
import { cn } from '@/lib/utils';

interface LoadingAssignment {
  project: {
    id: string;
    name: string;
    client: string;
    status: string;
    installation_date: string;
  };
  loading_date: string;
}

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([]);
  const [recentCompletedTasks, setRecentCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksByPriority, setTasksByPriority] = useState<any[]>([]);
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([]);
  const [taskCompletionTrend, setTaskCompletionTrend] = useState<any[]>([]);
  const [truckLoadingData, setTruckLoadingData] = useState<{ todayLoadings: LoadingAssignment[], daysToNext: number }>({ todayLoadings: [], daysToNext: 0 });
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  const [allLoadingAssignments, setAllLoadingAssignments] = useState<LoadingAssignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch projects
        const projectsData = await projectService.getAll();
        setProjects(projectsData);
        
        // Fetch today's tasks
        const todaysTasksData = await taskService.getTodaysTasks();
        setTodaysTasks(todaysTasksData);
        
        // Fetch all tasks (for chart data)
        const allTasks = await taskService.getAll();
        
        // Create priority distribution data
        const priorityCount = {
          Low: 0,
          Medium: 0,
          High: 0,
          Urgent: 0
        };
        
        allTasks.forEach(task => {
          if (task.priority in priorityCount) {
            priorityCount[task.priority as keyof typeof priorityCount]++;
          }
        });
        
        const priorityData = Object.entries(priorityCount).map(([name, value]) => ({
          name,
          value
        }));
        
        setTasksByPriority(priorityData);
        
        // Create status distribution data
        const statusCount = {
          TODO: 0,
          IN_PROGRESS: 0,
          COMPLETED: 0
        };
        
        allTasks.forEach(task => {
          if (task.status in statusCount) {
            statusCount[task.status as keyof typeof statusCount]++;
          }
        });
        
        const statusData = Object.entries(statusCount).map(([name, value]) => ({
          name: name === 'TODO' ? 'To Do' : name === 'IN_PROGRESS' ? 'In Progress' : 'Completed',
          value
        }));
        
        setTasksByStatus(statusData);
        
        // Get recently completed tasks (with valid completed_at timestamps)
        const completedTasks = allTasks
          .filter(task => task.status === 'COMPLETED' && task.completed_at)
          .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
          .slice(0, 250);
          
        setRecentCompletedTasks(completedTasks);
        
        // Create task completion trend (last 7 days)
        const today = startOfToday();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(today, 6 - i);
          return {
            date,
            dateString: format(date, 'MMM dd'),
            count: 0
          };
        });
        
        // Count completed tasks per day
        completedTasks.forEach(task => {
          if (task.completed_at) {
            const completedDate = parseISO(task.completed_at);
            const dayIndex = last7Days.findIndex(day => 
              format(day.date, 'yyyy-MM-dd') === format(completedDate, 'yyyy-MM-dd')
            );
            
            if (dayIndex !== -1) {
              last7Days[dayIndex].count++;
            }
          }
        });
        
        setTaskCompletionTrend(last7Days);
        
        // Fetch truck loading data
        await fetchTruckLoadingData();
        
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: "Error",
          description: `Failed to load dashboard data: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);

  // Calculate previous workday considering holidays
  const getPreviousWorkday = (date: Date, holidaysList: Holiday[]): Date => {
    let previousDay = subDays(date, 1);
    
    while (true) {
      // Skip weekends
      if (isWeekend(previousDay)) {
        previousDay = subDays(previousDay, 1);
        continue;
      }
      
      // Skip production holidays
      const dateStr = format(previousDay, 'yyyy-MM-dd');
      const isHoliday = holidaysList.some(h => h.date === dateStr && h.team === 'production');
      
      if (isHoliday) {
        previousDay = subDays(previousDay, 1);
        continue;
      }
      
      break;
    }
    
    return previousDay;
  };

  const fetchTruckLoadingData = async () => {
    try {
      // Fetch holidays
      const holidaysData = await holidayService.getHolidays();
      
      // Fetch all projects with installation dates
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client, status, installation_date')
        .not('installation_date', 'is', null)
        .order('installation_date');
        
      if (projectsError) throw projectsError;
      
      // Calculate loading dates for each project
      const loadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const loadingDate = getPreviousWorkday(installationDate, holidaysData);
        
        return {
          project,
          loading_date: format(loadingDate, 'yyyy-MM-dd'),
        };
      });
      
      // Get today's loadings
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayLoadings = loadingAssignments.filter(assignment => assignment.loading_date === today);
      
      // Calculate days to next loading
      let daysToNext = 0;
      if (todayLoadings.length === 0) {
        const futureLoadings = loadingAssignments.filter(assignment => {
          const loadingDate = new Date(assignment.loading_date);
          return loadingDate > new Date();
        }).sort((a, b) => new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime());
        
        if (futureLoadings.length > 0) {
          const nextLoadingDate = new Date(futureLoadings[0].loading_date);
          const today = new Date();
          daysToNext = Math.ceil((nextLoadingDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        }
      }
      
      setTruckLoadingData({ todayLoadings, daysToNext });
      setAllLoadingAssignments(loadingAssignments);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error fetching truck loading data:', error);
    }
  };

  // Navigate weeks
  const prevWeek = () => {
    setWeekStartDate(addDays(weekStartDate, -7));
  };

  const nextWeek = () => {
    setWeekStartDate(addDays(weekStartDate, 7));
  };

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allLoadingAssignments.filter(assignment => assignment.loading_date === dateStr);
  };

  // Get project color for visual distinction
  const getProjectColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'planned': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-orange-100 text-orange-800 border-orange-300';
    }
  };

  // Calculate statistics
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const inProgressProjects = projects.filter(p => p.status === 'in_progress').length;
  
  const overdueCount = todaysTasks.filter(task => 
    new Date(task.due_date) < new Date() && 
    task.status !== 'COMPLETED'
  ).length;
  
  // Tasks completed today
  const todayCompletedCount = recentCompletedTasks.filter(task => 
    task.completed_at && isToday(parseISO(task.completed_at))
  ).length;

  // Priority colors for charts
  const PRIORITY_COLORS = {
    Low: '#4ade80',
    Medium: '#60a5fa',
    High: '#f97316',
    Urgent: '#ef4444'
  };
  
  // Status colors for charts
  const STATUS_COLORS = {
    'To Do': '#60a5fa',
    'In Progress': '#f59e0b',
    'Completed': '#4ade80'
  };

  const canManageRequests = currentEmployee?.role === 'admin' || 
                           currentEmployee?.role === 'teamleader' || 
                           currentEmployee?.role === 'manager';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div>
      {currentEmployee?.role === 'admin' && (
        <Alert className="mb-6 bg-blue-50 border border-blue-200">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800">Administrator Account</AlertTitle>
          <AlertDescription className="text-blue-700">
            You are logged in as an administrator. You have access to user management functionality.
          </AlertDescription>
        </Alert>
      )}

      {projects.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
          <p className="text-yellow-800">No projects found. Initialize the database with sample data to get started.</p>
          <SeedDataButton />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard 
          title="Total Projects" 
          value={totalProjects.toString()} 
          footer="Projects managed" 
          icon={<Calendar className="h-5 w-5 text-blue-500" />}
        />
        <StatCard 
          title="Project Completion" 
          value={`${completedProjects}/${totalProjects}`} 
          footer={`${inProgressProjects} in progress`} 
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        />
        <StatCard 
          title="Tasks Today" 
          value={todaysTasks.length.toString()} 
          footer={`${overdueCount} overdue`} 
          icon={<Clock className="h-5 w-5 text-amber-500" />}
        />
        <StatCard 
          title="Completed Today" 
          value={todayCompletedCount.toString()}
          footer="Tasks fulfilled today" 
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
        <StatCard 
          title="Truck Loading" 
          value={truckLoadingData.todayLoadings.length > 0 ? truckLoadingData.todayLoadings.length.toString() : truckLoadingData.daysToNext.toString()}
          footer={truckLoadingData.todayLoadings.length > 0 ? 
            `Loading today: ${truckLoadingData.todayLoadings.map(l => l.project.name).join(', ')}` : 
            truckLoadingData.daysToNext > 0 ? `${truckLoadingData.daysToNext} days to next loading` : 'No upcoming loadings'
          } 
          icon={<Truck className="h-5 w-5 text-orange-500" />}
        />
      </div>
      
      {/* Weekly Loading Schedule */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Loading Schedule
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)).map((date, index) => {
              const dayAssignments = getAssignmentsForDate(date);
              const isCurrentDay = isToday(date);
              
              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[120px] border rounded p-2",
                    isCurrentDay ? "border-red-500 bg-red-50" : "border-gray-200"
                  )}
                >
                  <div className={cn(
                    "text-center text-sm font-medium mb-2",
                    isCurrentDay ? "text-red-700" : "text-gray-700"
                  )}>
                    <div>{format(date, 'EEE')}</div>
                    <div className="text-lg">{format(date, 'd')}</div>
                  </div>
                  
                  <div className="space-y-1">
                    {dayAssignments.map((assignment, index) => (
                      <div
                        key={`${assignment.project.id}-${index}`}
                        className={cn(
                          "p-1 rounded text-xs border",
                          getProjectColor(assignment.project.status)
                        )}
                      >
                        <div className="font-medium truncate">{assignment.project.name}</div>
                        <div className="text-xs text-gray-500">
                          Install: {format(new Date(assignment.project.installation_date), 'MMM d')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Task Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Task Completion Trend
            </CardTitle>
            <CardDescription>Tasks completed over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ChartContainer
                config={{
                  completed: { label: "Completed", theme: { light: "#4ade80", dark: "#4ade80" } }
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskCompletionTrend}>
                    <XAxis dataKey="dateString" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                          labelFormatter={(value) => `${value}`}
                        />
                      )}
                    />
                    <Bar
                      dataKey="count"
                      name="completed"
                      fill="var(--color-completed, #4ade80)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Tasks by Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-blue-500" />
              Tasks by Status
            </CardTitle>
            <CardDescription>Distribution of tasks by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tasksByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    dataKey="value"
                    label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {tasksByStatus.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} tasks`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Tasks by Priority */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Tasks by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tasksByPriority}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={({name, value}) => `${name}: ${value}`}
                  >
                    {tasksByPriority.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} tasks`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recently Completed Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Recently Completed Tasks
            </CardTitle>
            <CardDescription>Tasks that have been completed recently</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCompletedTasks.length > 0 ? (
              <div className="overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="hidden md:table-cell">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCompletedTasks.slice(0, 5).map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          {task.completed_at ? format(parseISO(task.completed_at), 'MMM dd, HH:mm') : 'Unknown'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            task.priority === 'High' || task.priority === 'Urgent' 
                              ? 'bg-red-100 text-red-800' 
                              : task.priority === 'Medium'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p>No completed tasks found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Holiday Requests Section */}
      <div className="mb-6">
        <HolidayRequestsList showAllRequests={canManageRequests} />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Active Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.slice(0, 3).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>

      <TaskList 
        tasks={todaysTasks} 
        title="Today's Tasks" 
        onTaskStatusChange={async (taskId, status) => {
          try {
            const now = new Date().toISOString();
            await taskService.update(taskId, { 
              status,
              ...(status === 'COMPLETED' ? { 
                completed_at: now,
                completed_by: currentEmployee?.id 
              } : {})
            });
            
            // Update local state
            setTodaysTasks(todaysTasks.map(task => 
              task.id === taskId ? { 
                ...task, 
                status,
                ...(status === 'COMPLETED' ? { 
                  completed_at: now,
                  completed_by: currentEmployee?.id 
                } : {})
              } : task
            ));
            
            toast({
              title: "Task updated",
              description: "Task status has been successfully updated."
            });

            // If it was completed, also update the completed tasks list
            if (status === 'COMPLETED') {
              const updatedTask = todaysTasks.find(task => task.id === taskId);
              if (updatedTask) {
                const updatedCompletedTask = {
                  ...updatedTask,
                  status,
                  completed_at: now,
                  completed_by: currentEmployee?.id
                };
                
                setRecentCompletedTasks([
                  updatedCompletedTask,
                  ...recentCompletedTasks.slice(0, 9)
                ]);
              }
            }
          } catch (error: any) {
            toast({
              title: "Error",
              description: `Failed to update task: ${error.message}`,
              variant: "destructive"
            });
          }
        }}
      />
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  footer: string;
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, footer, icon }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{footer}</p>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
