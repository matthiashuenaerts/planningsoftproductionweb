import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SeedDataButton from './SeedDataButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { projectService, taskService, Project, Task } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { orderService } from '@/services/orderService';
import { projectTeamAssignmentService } from '@/services/projectTeamAssignmentService';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Calendar, CheckCircle2, Clock, Users, BarChart3, ListTodo, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfToday, isToday, subDays, parseISO, addDays, isWeekend, startOfWeek } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
    progress: number | null;
  };
  loading_date: string;
  orderStatus?: {
    undeliveredCount: number;
    allDelivered: boolean;
    allCharged: boolean;
  };
  teamColor?: string;
}
const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentCompletedTasks, setRecentCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksByPriority, setTasksByPriority] = useState<any[]>([]);
  const [tasksByStatus, setTasksByStatus] = useState<any[]>([]);
  const [taskCompletionTrend, setTaskCompletionTrend] = useState<any[]>([]);
  const [truckLoadingData, setTruckLoadingData] = useState<{
    todayLoadings: LoadingAssignment[];
    daysToNext: number;
  }>({
    todayLoadings: [],
    daysToNext: 0
  });
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    return startOfWeek(today, {
      weekStartsOn: 1
    });
  });
  const [allLoadingAssignments, setAllLoadingAssignments] = useState<LoadingAssignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadedWeeks, setLoadedWeeks] = useState<Set<string>>(new Set());
  const [weekLoading, setWeekLoading] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const {
    toast
  } = useToast();
  const {
    currentEmployee
  } = useAuth();
  const {
    createLocalizedPath
  } = useLanguage();
  const navigate = useNavigate();
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch projects
        const projectsData = await projectService.getAll();
        setProjects(projectsData);

        // Efficient parallel queries for dashboard data
        const today = startOfToday();
        const sevenDaysAgo = format(subDays(today, 6), 'yyyy-MM-dd');
        
        const [
          tasksStatusCount,
          tasksPriorityCount,
          completedTasksLast7Days
        ] = await Promise.all([
          // Status distribution - count only
          supabase
            .from('tasks')
            .select('status', { count: 'exact', head: false })
            .in('status', ['TODO', 'IN_PROGRESS', 'COMPLETED']),
          
          // Priority distribution - count only
          supabase
            .from('tasks')
            .select('priority', { count: 'exact', head: false })
            .in('priority', ['Low', 'Medium', 'High', 'Urgent']),
          
          // Completed tasks in last 7 days
          supabase
            .from('tasks')
            .select('completed_at')
            .eq('status', 'COMPLETED')
            .not('completed_at', 'is', null)
            .gte('completed_at', sevenDaysAgo)
            .order('completed_at', { ascending: false })
        ]);

        // Process status data
        const statusCount: Record<string, number> = {
          TODO: 0,
          IN_PROGRESS: 0,
          COMPLETED: 0
        };
        (tasksStatusCount.data || []).forEach((task: any) => {
          if (task.status in statusCount) {
            statusCount[task.status]++;
          }
        });
        const statusData = Object.entries(statusCount).map(([name, value]) => ({
          name: name === 'TODO' ? 'To Do' : name === 'IN_PROGRESS' ? 'In Progress' : 'Completed',
          value
        }));
        setTasksByStatus(statusData);

        // Process priority data
        const priorityCount: Record<string, number> = {
          Low: 0,
          Medium: 0,
          High: 0,
          Urgent: 0
        };
        (tasksPriorityCount.data || []).forEach((task: any) => {
          if (task.priority in priorityCount) {
            priorityCount[task.priority]++;
          }
        });
        const priorityData = Object.entries(priorityCount).map(([name, value]) => ({
          name,
          value
        }));
        setTasksByPriority(priorityData);

        // Process task completion trend (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(today, 6 - i);
          return {
            date,
            dateString: format(date, 'MMM dd'),
            count: 0
          };
        });

        // Count completed tasks per day
        (completedTasksLast7Days.data || []).forEach((task: any) => {
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
        await fetchInitialTruckLoadingData();

        // Fetch upcoming external processing events
        await fetchUpcomingExternalProcessingEvents();
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
  const fetchUpcomingExternalProcessingEvents = async () => {
    try {
      const logisticsOutOrders = await orderService.getLogisticsOutOrders();
      const events: any[] = [];
      for (const order of logisticsOutOrders) {
        try {
          const allSteps = await orderService.getOrderSteps(order.id);
          const processingSteps = allSteps.filter(step => step.supplier && step.supplier.trim() !== '' && step.start_date);
          const project = await projectService.getById(order.project_id);
          const projectName = project?.name || "Unknown Project";
          processingSteps.forEach(step => {
            if (step.start_date && step.supplier) {
              // Add start date event
              const startDate = format(new Date(step.start_date), 'yyyy-MM-dd');
              events.push({
                date: startDate,
                type: 'start',
                title: `${step.name}`,
                description: `${projectName} - ${step.supplier}`,
                project_name: projectName
              });

              // Add expected return date if duration is provided
              if (step.expected_duration_days) {
                const returnDate = addDays(new Date(step.start_date), step.expected_duration_days);
                const returnDateStr = format(returnDate, 'yyyy-MM-dd');
                events.push({
                  date: returnDateStr,
                  type: 'return',
                  title: `${step.name}`,
                  description: `${projectName} - ${step.supplier}`,
                  project_name: projectName
                });
              }
            }
          });
        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error);
        }
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
      setUpcomingEvents(upcomingEvents);
    } catch (error) {
      console.error('Error fetching external processing events:', error);
    }
  };

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
  const fetchInitialTruckLoadingData = async () => {
    try {
      // Fetch holidays
      const holidaysData = await holidayService.getHolidays();
      setHolidays(holidaysData);

      // Fetch existing overrides
      const {
        data: overridesData,
        error: overridesError
      } = await supabase.from('project_loading_overrides').select('project_id, override_loading_date');
      if (overridesError) {
        console.error('Error fetching loading overrides:', overridesError);
      } else {
        // Convert overrides to map
        const overridesMap: Record<string, string> = {};
        (overridesData || []).forEach(override => {
          overridesMap[override.project_id] = override.override_loading_date;
        });
        setManualOverrides(overridesMap);
      }

      // Load current week data
      await loadWeekData(weekStartDate, holidaysData);
    } catch (error) {
      console.error('Error fetching initial truck loading data:', error);
    }
  };
  const loadWeekData = async (weekStart: Date, holidaysData?: Holiday[]) => {
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    // Skip if week already loaded
    if (loadedWeeks.has(weekKey)) return;
    try {
      setWeekLoading(true);
      const weekEnd = addDays(weekStart, 6);
      const holidaysList = holidaysData || holidays;

      // Fetch projects for this week range
      const {
        data: projectsData,
        error: projectsError
      } = await supabase.from('projects').select('id, name, client, status, installation_date, progress').not('installation_date', 'is', null).gte('installation_date', format(subDays(weekStart, 10), 'yyyy-MM-dd')) // Buffer for loading date calculation
      .lte('installation_date', format(addDays(weekEnd, 10), 'yyyy-MM-dd')).order('installation_date');
      if (projectsError) throw projectsError;

      // Calculate loading dates for projects
      const weekLoadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const loadingDate = getPreviousWorkday(installationDate, holidaysList);
        return {
          project,
          loading_date: format(loadingDate, 'yyyy-MM-dd')
        };
      }).filter(assignment => {
        const loadingDate = new Date(assignment.loading_date);
        return loadingDate >= weekStart && loadingDate <= weekEnd;
      });

      // Fetch additional data for each project
      const projectIds = weekLoadingAssignments.map(a => a.project.id);

      // Fetch orders for projects
      const {
        data: ordersData
      } = await supabase.from('orders').select('id, project_id, status').in('project_id', projectIds);

      // Fetch team assignments for projects  
      const teamAssignments = await Promise.all(projectIds.map(async projectId => {
        const assignments = await projectTeamAssignmentService.getByProject(projectId);
        return {
          projectId,
          assignments
        };
      }));

        // Enhance assignments with order status and team colors
        const enhancedAssignments = await Promise.all(weekLoadingAssignments.map(async assignment => {
          // Calculate order status - count undelivered items instead of undelivered orders
          const projectOrders = ordersData?.filter(o => o.project_id === assignment.project.id) || [];
          let undeliveredItemsCount = 0;

          // Count undelivered items from orders with certain statuses
          for (const order of projectOrders) {
            if (['pending', 'delayed', 'partially_delivered'].includes(order.status)) {
              try {
                const items = await orderService.getOrderItems(order.id);
                const undeliveredItems = items.filter(item => (item.quantity || 0) > (item.delivered_quantity || 0));
                undeliveredItemsCount += undeliveredItems.length;
              } catch (error) {
                console.error(`Error loading order items for order ${order.id}:`, error);
              }
            }
          }
          const allOrdersDelivered = projectOrders.length > 0 && projectOrders.every(o => o.status === 'delivered');
          const allOrdersCharged = projectOrders.length > 0 && projectOrders.every(o => o.status === 'charged');

        // Get team color
        const teamAssignment = teamAssignments.find(ta => ta.projectId === assignment.project.id);
        let teamColor = '';
        if (teamAssignment?.assignments && teamAssignment.assignments.length > 0) {
          // Look for any team assignment that contains color keywords
          for (const team of teamAssignment.assignments) {
            const color = getTeamColorFromName(team.team);
            if (color) {
              teamColor = color;
              break;
            }
          }
        }
          return {
            ...assignment,
            orderStatus: {
              undeliveredCount: undeliveredItemsCount,
              allDelivered: allOrdersDelivered,
              allCharged: allOrdersCharged
            },
            teamColor
          };
      }));

      // Merge with existing assignments
      setAllLoadingAssignments(prev => {
        const existingIds = new Set(prev.map(a => `${a.project.id}-${a.loading_date}`));
        const newAssignments = enhancedAssignments.filter(a => !existingIds.has(`${a.project.id}-${a.loading_date}`));
        return [...prev, ...newAssignments];
      });

      // Update today's loading stats if current week
      const today = format(new Date(), 'yyyy-MM-dd');
      const isCurrentWeek = today >= format(weekStart, 'yyyy-MM-dd') && today <= format(weekEnd, 'yyyy-MM-dd');
      if (isCurrentWeek) {
        // Consider manual overrides when calculating today's loadings
        const todayLoadings = enhancedAssignments.filter(assignment => {
          const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
          return effectiveLoadingDate === today;
        });

        // Calculate days to next loading (also considering overrides)
        let daysToNext = 0;
        if (todayLoadings.length === 0) {
          const futureLoadings = enhancedAssignments.filter(assignment => {
            const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
            const loadingDate = new Date(effectiveLoadingDate);
            return loadingDate > new Date();
          }).sort((a, b) => {
            const aDate = manualOverrides[a.project.id] || a.loading_date;
            const bDate = manualOverrides[b.project.id] || b.loading_date;
            return new Date(aDate).getTime() - new Date(bDate).getTime();
          });
          if (futureLoadings.length > 0) {
            const nextLoadingDate = new Date(manualOverrides[futureLoadings[0].project.id] || futureLoadings[0].loading_date);
            const today = new Date();
            daysToNext = Math.ceil((nextLoadingDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
          }
        }
        setTruckLoadingData({
          todayLoadings,
          daysToNext
        });
      }

      // Mark week as loaded
      setLoadedWeeks(prev => new Set([...prev, weekKey]));
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setWeekLoading(false);
    }
  };

  // Navigate weeks
  const prevWeek = async () => {
    const newWeekStart = addDays(weekStartDate, -7);
    setWeekStartDate(newWeekStart);
    await loadWeekData(newWeekStart);
  };
  const nextWeek = async () => {
    const newWeekStart = addDays(weekStartDate, 7);
    setWeekStartDate(newWeekStart);
    await loadWeekData(newWeekStart);
  };

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allLoadingAssignments.filter(assignment => {
      const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
      return effectiveLoadingDate === dateStr;
    });
  };

  // Get project color for visual distinction
  const getProjectColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'planned':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-300';
    }
  };

  // Get team background color based on team name
  const getTeamBackgroundColor = (teamColor?: string) => {
    if (!teamColor) return 'bg-gray-200/70';
    switch (teamColor) {
      case 'green':
        return 'bg-green-200/70';
      case 'blue':
        return 'bg-blue-200/70';
      case 'orange':
        return 'bg-orange-200/70';
      default:
        return 'bg-gray-200/70';
    }
  };

  // Determine team color from team name
  const getTeamColorFromName = (teamName: string): string => {
    if (!teamName) return '';
    const lowerTeamName = teamName.toLowerCase();
    if (lowerTeamName.includes('groen')) return 'green';
    if (lowerTeamName.includes('blauw')) return 'blue';
    if (lowerTeamName.includes('oranje')) return 'orange';
    return '';
  };

  // Calculate statistics
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const inProgressProjects = projects.filter(p => p.status === 'in_progress').length;

  // Tasks completed today
  const todayCompletedCount = recentCompletedTasks.filter(task => task.completed_at && isToday(parseISO(task.completed_at))).length;

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
  if (loading) {
    return <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>;
  }
  return <div>
      {currentEmployee?.role === 'admin' && <Alert className="mb-6 bg-blue-50 border border-blue-200">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800">Administrator Account</AlertTitle>
          <AlertDescription className="text-blue-700">
            You are logged in as an administrator. You have access to user management functionality.
          </AlertDescription>
        </Alert>}

      {projects.length === 0 && <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
          <p className="text-yellow-800">No projects found. Initialize the database with sample data to get started.</p>
          <SeedDataButton />
        </div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Projects" value={totalProjects.toString()} footer="Projects managed" icon={<Calendar className="h-5 w-5 text-blue-500" />} />
        <StatCard title="Completed Today" value={todayCompletedCount.toString()} footer="Tasks fulfilled today" icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        {upcomingEvents.length > 0 && <StatCard title="Logistiek Uitgaand" value={upcomingEvents.length.toString()} valueSubtext={upcomingEvents[0] ? `Next: ${format(new Date(upcomingEvents[0].date), 'dd/MM')}` : ''} footer={upcomingEvents.slice(0, 2).map(event => `<span style="color: ${event.type === 'return' ? '#22c55e' : '#3b82f6'}">${format(new Date(event.date), 'dd/MM')} - ${event.project_name}</span>`).join('<br>')} icon={<Users className="h-5 w-5 text-purple-500" />} onClick={() => navigate(createLocalizedPath('/logistics-out'))} />}
        <StatCard title="Truck Loading" value={truckLoadingData.todayLoadings.length > 0 ? truckLoadingData.todayLoadings.length.toString() : truckLoadingData.daysToNext.toString()} footer={truckLoadingData.todayLoadings.length > 0 ? `Loading today: ${truckLoadingData.todayLoadings.map(l => l.project.name).join(', ')}` : truckLoadingData.daysToNext > 0 ? `${truckLoadingData.daysToNext} days to next loading` : 'No upcoming loadings'} icon={<Truck className="h-5 w-5 text-orange-500" />} />
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
              <Button variant="outline" size="icon" onClick={prevWeek} disabled={weekLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
                {weekLoading && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
              </span>
              <Button variant="outline" size="icon" onClick={nextWeek} disabled={weekLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({
            length: 7
          }, (_, i) => addDays(weekStartDate, i)).map((date, index) => {
            const dayAssignments = getAssignmentsForDate(date);
            const isCurrentDay = isToday(date);
            return <div key={index} className={cn("min-h-[120px] border rounded p-2", isCurrentDay ? "border-red-500 bg-red-50" : "border-gray-200")}>
                  <div className={cn("text-center text-sm font-medium mb-2", isCurrentDay ? "text-red-700" : "text-gray-700")}>
                    <div>{format(date, 'EEE')}</div>
                    <div className="text-lg">{format(date, 'd')}</div>
                  </div>
                  
                  <div className="space-y-1">
                    {dayAssignments.map((assignment, index) => {
                  const isManuallyAdjusted = manualOverrides[assignment.project.id] !== undefined;
                  const isCharged = assignment.orderStatus?.allCharged;
                  return <div key={`${assignment.project.id}-${index}`} className={cn("p-1 rounded text-xs border cursor-pointer hover:opacity-80 transition-opacity relative", getProjectColor(assignment.project.status), getTeamBackgroundColor(assignment.teamColor), isManuallyAdjusted && "ring-2 ring-orange-400", isCharged && "opacity-50")} onClick={() => navigate(createLocalizedPath(`/projects/${assignment.project.id}`))}>
                          {/* Order status indicator */}
                          {assignment.orderStatus && <div className={cn("absolute -top-1 -right-1 rounded-full text-xs font-bold text-white flex items-center justify-center min-w-[16px] h-4 px-1", isCharged ? "bg-green-600" : assignment.orderStatus.allDelivered ? "bg-green-500" : "bg-red-500")}>
                              {isCharged || assignment.orderStatus.allDelivered ? "✓" : assignment.orderStatus.undeliveredCount}
                            </div>}
                          
                          {/* Manual override indicator */}
                          {isManuallyAdjusted && <div className="absolute -top-1 -left-1 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center min-w-[16px] h-4 px-1">
                              ↻
                            </div>}
                          
                          <div className="font-medium break-words whitespace-normal leading-tight">{assignment.project.name}</div>
                          <div className="text-xs text-gray-500">
                            Install: {format(new Date(assignment.project.installation_date), 'MMM d')} | {assignment.project.progress || 0}%
                            {isManuallyAdjusted && <span className="text-orange-600 ml-1 font-medium">*</span>}
                          </div>
                        </div>;
                })}
                  </div>
                </div>;
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
              <ChartContainer config={{
              completed: {
                label: "Completed",
                theme: {
                  light: "#4ade80",
                  dark: "#4ade80"
                }
              }
            }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskCompletionTrend}>
                    <XAxis dataKey="dateString" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={({
                    active,
                    payload
                  }) => <ChartTooltipContent active={active} payload={payload} labelFormatter={value => `${value}`} />} />
                    <Bar dataKey="count" name="completed" fill="var(--color-completed, #4ade80)" />
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
                  <Pie data={tasksByStatus} cx="50%" cy="50%" labelLine={false} outerRadius={100} dataKey="value" label={({
                  name,
                  percent
                }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {tasksByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]} />)}
                  </Pie>
                  <Tooltip formatter={value => [`${value} tasks`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
interface StatCardProps {
  title: string;
  value: string;
  footer: string;
  icon?: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
  valueSubtext?: string;
}
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  footer,
  icon,
  subtitle,
  onClick,
  valueSubtext
}) => {
  return <Card className={onClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""} onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {valueSubtext && <div className="text-xs text-muted-foreground">{valueSubtext}</div>}
        </div>
        <div className="text-xs text-muted-foreground mt-1 space-y-1">
          {footer.split('\n').map((line, index) => <p key={index} className="break-words" dangerouslySetInnerHTML={{
          __html: line
        }}></p>)}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 break-words font-medium">{subtitle}</p>}
      </CardContent>
    </Card>;
};
export default Dashboard;