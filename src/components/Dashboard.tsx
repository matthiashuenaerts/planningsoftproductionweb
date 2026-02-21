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
import { projectTeamAssignmentOverrideService } from '@/services/projectTeamAssignmentOverrideService';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Calendar, CheckCircle2, Clock, Users, BarChart3, ListTodo, Truck, ChevronLeft, ChevronRight, Factory, Package, Check } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfToday, isToday, subDays, parseISO, addDays, isWeekend, startOfWeek } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { supabase } from '@/integrations/supabase/client';
import { holidayService, Holiday } from '@/services/holidayService';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
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
  truck?: {
    id: string;
    name: string;
  };
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
  const [teamAssignmentOverrides, setTeamAssignmentOverrides] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  
  // Workstation stats state
  const [workstationStats, setWorkstationStats] = useState<Array<{
    id: string;
    name: string;
    openTasks: number;
    openProjects: number;
    openHours: number;
    todoTasks: Array<{
      title: string;
      projectName: string;
      priority: string;
      duration: number;
    }>;
  }>>([]);
  const {
    toast
  } = useToast();
  const {
    currentEmployee
  } = useAuth();
  const {
    createLocalizedPath,
    t
  } = useLanguage();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch projects
        const projectsData = await projectService.getAll(tenant?.id);
        setProjects(projectsData);

        // Efficient parallel queries for dashboard data
        const today = startOfToday();
        const sevenDaysAgo = format(subDays(today, 6), 'yyyy-MM-dd');
        
        // Build tenant-filtered task queries
        let statusQuery = supabase
            .from('tasks')
            .select('status', { count: 'exact', head: false })
            .in('status', ['TODO', 'IN_PROGRESS', 'COMPLETED']);
        let priorityQuery = supabase
            .from('tasks')
            .select('priority', { count: 'exact', head: false })
            .in('priority', ['Low', 'Medium', 'High', 'Urgent']);
        let completedQuery = supabase
            .from('tasks')
            .select('completed_at')
            .eq('status', 'COMPLETED')
            .not('completed_at', 'is', null)
            .gte('completed_at', sevenDaysAgo)
            .order('completed_at', { ascending: false });

        if (tenant?.id) {
          statusQuery = statusQuery.eq('tenant_id', tenant.id);
          priorityQuery = priorityQuery.eq('tenant_id', tenant.id);
          completedQuery = completedQuery.eq('tenant_id', tenant.id);
        }

        const [
          tasksStatusCount,
          tasksPriorityCount,
          completedTasksLast7Days
        ] = await Promise.all([statusQuery, priorityQuery, completedQuery]);

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
          name: name === 'TODO' ? t('dashboard_to_do') : name === 'IN_PROGRESS' ? t('dashboard_in_progress') : t('dashboard_completed'),
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

        // Fetch upcoming external processing events and workstation stats in parallel
        await Promise.all([
          fetchUpcomingExternalProcessingEvents(),
          fetchWorkstationStats()
        ]);
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
  }, [toast, tenant?.id]);
  const fetchWorkstationStats = async () => {
    if (!currentEmployee) return;
    
    try {
      // Fetch only workstations assigned to the current employee
      const { data: employeeWorkstationLinks, error: employeeLinksError } = await supabase
        .from('employee_workstation_links')
        .select('workstation_id')
        .eq('employee_id', currentEmployee.id);

      if (employeeLinksError) throw employeeLinksError;
      
      // If no workstations are assigned, return early
      if (!employeeWorkstationLinks || employeeWorkstationLinks.length === 0) {
        setWorkstationStats([]);
        return;
      }

      // Get the workstation IDs assigned to this employee
      const assignedWorkstationIds = employeeWorkstationLinks.map(link => link.workstation_id);

      // Fetch only the assigned workstations
      const { data: workstations, error: wsError } = await supabase
        .from('workstations')
        .select('id, name')
        .in('id', assignedWorkstationIds)
        .order('name');

      if (wsError) throw wsError;
      if (!workstations || workstations.length === 0) {
        setWorkstationStats([]);
        return;
      }

      // Fetch all standard task workstation links only for assigned workstations
      const { data: standardTaskLinks, error: linksError } = await supabase
        .from('standard_task_workstation_links')
        .select('standard_task_id, workstation_id')
        .in('workstation_id', assignedWorkstationIds);

      if (linksError) throw linksError;

      // Fetch all standard tasks to get task numbers
      const { data: standardTasks, error: stError } = await supabase
        .from('standard_tasks')
        .select('id, task_number');

      if (stError) throw stError;

      // Create a map of standard_task_id -> workstation_ids
      const taskToWorkstationMap = new Map<string, string[]>();
      (standardTaskLinks || []).forEach(link => {
        if (!taskToWorkstationMap.has(link.standard_task_id)) {
          taskToWorkstationMap.set(link.standard_task_id, []);
        }
        taskToWorkstationMap.get(link.standard_task_id)!.push(link.workstation_id);
      });

      // Create a map of task_number -> workstation_ids
      const taskNumberToWorkstationMap = new Map<string, string[]>();
      (standardTasks || []).forEach(st => {
        const workstationIds = taskToWorkstationMap.get(st.id);
        if (workstationIds) {
          taskNumberToWorkstationMap.set(st.task_number, workstationIds);
        }
      });

      // Fetch all open tasks (TODO or IN_PROGRESS) with project info
      const { data: openTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          duration,
          phase_id,
          phases!inner(project_id, projects!inner(id, name))
        `)
        .in('status', ['TODO', 'IN_PROGRESS'])
        .order('priority', { ascending: false });

      if (tasksError) throw tasksError;

      // Also fetch tasks linked directly via task_workstation_links
      const { data: taskWorkstationLinks, error: twlError } = await supabase
        .from('task_workstation_links')
        .select('task_id, workstation_id');

      if (twlError) throw twlError;

      // Create a map of task_id -> workstation_ids (direct links)
      const directTaskToWorkstationMap = new Map<string, string[]>();
      (taskWorkstationLinks || []).forEach(link => {
        if (!directTaskToWorkstationMap.has(link.task_id)) {
          directTaskToWorkstationMap.set(link.task_id, []);
        }
        directTaskToWorkstationMap.get(link.task_id)!.push(link.workstation_id);
      });

      // Calculate stats for each workstation
      const stats = workstations.map(ws => {
        const workstationTasks = (openTasks || []).filter(task => {
          // Check direct links first
          const directLinks = directTaskToWorkstationMap.get(task.id);
          if (directLinks && directLinks.includes(ws.id)) {
            return true;
          }

          // Check via task number in title
          const taskNumberMatch = task.title.match(/^(\d+\.\d+)/);
          if (taskNumberMatch) {
            const taskNumber = taskNumberMatch[1];
            const linkedWorkstations = taskNumberToWorkstationMap.get(taskNumber);
            return linkedWorkstations && linkedWorkstations.includes(ws.id);
          }
          
          return false;
        });

        // Calculate stats
        const openTasksCount = workstationTasks.length;
        const uniqueProjectIds = new Set(
          workstationTasks.map(t => (t.phases as any)?.projects?.id).filter(Boolean)
        );
        const openProjectsCount = uniqueProjectIds.size;
        const openHours = workstationTasks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60;

        // Get all TODO tasks sorted by priority
        const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const todoTasks = workstationTasks
          .filter(t => t.status === 'TODO')
          .sort((a, b) => {
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
            return bPriority - aPriority;
          })
          .map(task => ({
            title: task.title,
            projectName: (task.phases as any)?.projects?.name || 'Unknown',
            priority: task.priority,
            duration: task.duration || 0
          }));

        return {
          id: ws.id,
          name: ws.name,
          openTasks: openTasksCount,
          openProjects: openProjectsCount,
          openHours: Math.round(openHours * 10) / 10,
          todoTasks
        };
      });

      setWorkstationStats(stats);
    } catch (error) {
      console.error('Error fetching workstation stats:', error);
    }
  };

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
      const holidaysData = await holidayService.getHolidays(tenant?.id);
      setHolidays(holidaysData);

      // Fetch existing overrides in parallel
      const [loadingOverridesResult, teamOverridesResult] = await Promise.all([
        supabase.from('project_loading_overrides').select('project_id, override_loading_date'),
        projectTeamAssignmentOverrideService.getAll()
      ]);
      
      let overridesMap: Record<string, string> = {};
      if (loadingOverridesResult.error) {
        console.error('Error fetching loading overrides:', loadingOverridesResult.error);
      } else {
        // Convert overrides to map
        (loadingOverridesResult.data || []).forEach(override => {
          overridesMap[override.project_id] = override.override_loading_date;
        });
        setManualOverrides(overridesMap);
      }

      // Store team assignment overrides
      setTeamAssignmentOverrides(teamOverridesResult || []);

      // Load current week data with overrides
      await loadWeekData(weekStartDate, holidaysData, overridesMap);
    } catch (error) {
      console.error('Error fetching initial truck loading data:', error);
    }
  };
  const loadWeekData = async (weekStart: Date, holidaysData?: Holiday[], overridesMap?: Record<string, string>) => {
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    // Skip if week already loaded
    if (loadedWeeks.has(weekKey)) return;
    try {
      setWeekLoading(true);
      const weekEnd = addDays(weekStart, 6);
      const holidaysList = holidaysData || holidays;

      // Fetch placement teams for color lookup
      let teamsQuery = supabase
        .from('placement_teams')
        .select('id, name, color')
        .eq('is_active', true);
      if (tenant?.id) teamsQuery = teamsQuery.eq('tenant_id', tenant.id);
      const { data: placementTeamsData, error: teamsError } = await teamsQuery;
      
      if (teamsError) throw teamsError;
      const placementTeamsMap = new Map((placementTeamsData || []).map(team => [team.id, team.color]));

      // Fetch projects for this week range
      let projectsQuery = supabase.from('projects').select('id, name, client, status, installation_date, progress').not('installation_date', 'is', null).gte('installation_date', format(subDays(weekStart, 10), 'yyyy-MM-dd'))
      .lte('installation_date', format(addDays(weekEnd, 10), 'yyyy-MM-dd')).order('installation_date');
      if (tenant?.id) projectsQuery = projectsQuery.eq('tenant_id', tenant.id);
      const {
        data: projectsData,
        error: projectsError
      } = await projectsQuery;
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
        // Check if there's a manual override for this project (use passed overrides or state)
        const overrides = overridesMap || manualOverrides;
        const effectiveLoadingDate = overrides[assignment.project.id] || assignment.loading_date;
        const loadingDate = new Date(effectiveLoadingDate);
        return loadingDate >= weekStart && loadingDate <= weekEnd;
      });

      // Fetch additional data for each project
      const projectIds = weekLoadingAssignments.map(a => a.project.id);

      // Fetch orders for projects
      const {
        data: ordersData
      } = await supabase.from('orders').select('id, project_id, status').in('project_id', projectIds);

      // Fetch team assignments for projects and apply overrides
      const teamAssignments = await Promise.all(projectIds.map(async projectId => {
        const assignments = await projectTeamAssignmentService.getByProject(projectId);
        
        // Check if there's an override for this project
        const override = teamAssignmentOverrides.find(o => o.project_id === projectId);
        
        if (override) {
          // Use override data instead of regular assignment
          return {
            projectId,
            assignments: [{
              team: override.team_id,
              team_id: override.team_id,
              start_date: override.start_date,
              duration: 0 // Not used in this context
            }]
          };
        }
        
        return {
          projectId,
          assignments
        };
      }));

      // Fetch truck assignments for projects
      const { data: truckAssignmentsData } = await supabase
        .from('project_truck_assignments')
        .select(`
          project_id,
          truck_id,
          trucks!inner(id, truck_number)
        `)
        .in('project_id', projectIds);
      
      const truckAssignmentsMap = new Map(
        (truckAssignmentsData || []).map(ta => [ta.project_id, { id: ta.trucks.id, name: `T${ta.trucks.truck_number}` }])
      );

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

        // Get team color using team_id
        const teamAssignment = teamAssignments.find(ta => ta.projectId === assignment.project.id);
        let teamColor = '';
        if (teamAssignment?.assignments && teamAssignment.assignments.length > 0) {
          // Use team_id to look up color from placement_teams
          for (const team of teamAssignment.assignments) {
            if (team.team_id) {
              const color = placementTeamsMap.get(team.team_id);
              if (color) {
                teamColor = color;
                break;
              }
            }
          }
        }

        // Get truck assignment
        const truck = truckAssignmentsMap.get(assignment.project.id);

          return {
            ...assignment,
            orderStatus: {
              undeliveredCount: undeliveredItemsCount,
              allDelivered: allOrdersDelivered,
              allCharged: allOrdersCharged
            },
            teamColor,
            truck
        };
      }));

      // Merge with existing assignments and recalculate truck loading stats
      setAllLoadingAssignments(prev => {
        const existingIds = new Set(prev.map(a => `${a.project.id}-${a.loading_date}`));
        const newAssignments = enhancedAssignments.filter(a => !existingIds.has(`${a.project.id}-${a.loading_date}`));
        const updatedAssignments = [...prev, ...newAssignments];

        // Recalculate today's loading stats using ALL assignments
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // Consider manual overrides when calculating today's loadings
        const todayLoadings = updatedAssignments.filter(assignment => {
          const effectiveLoadingDate = (overridesMap || manualOverrides)[assignment.project.id] || assignment.loading_date;
          return effectiveLoadingDate === today;
        });

        // Calculate days to next loading using ALL assignments (also considering overrides)
        let daysToNext = 0;
        if (todayLoadings.length === 0) {
          const futureLoadings = updatedAssignments.filter(assignment => {
            const effectiveLoadingDate = (overridesMap || manualOverrides)[assignment.project.id] || assignment.loading_date;
            const loadingDate = new Date(effectiveLoadingDate);
            const todayDate = new Date(today);
            return loadingDate > todayDate;
          }).sort((a, b) => {
            const aDate = (overridesMap || manualOverrides)[a.project.id] || a.loading_date;
            const bDate = (overridesMap || manualOverrides)[b.project.id] || b.loading_date;
            return new Date(aDate).getTime() - new Date(bDate).getTime();
          });
          
          if (futureLoadings.length > 0) {
            const nextLoadingDate = new Date((overridesMap || manualOverrides)[futureLoadings[0].project.id] || futureLoadings[0].loading_date);
            const todayDate = new Date(today);
            daysToNext = Math.ceil((nextLoadingDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));
          }
        }
        
        setTruckLoadingData({
          todayLoadings,
          daysToNext
        });

        return updatedAssignments;
      });

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

  // Get team background style using hex color codes from settings
  const getTeamBackgroundStyle = (teamColor?: string): React.CSSProperties => {
    if (!teamColor) return {};
    // teamColor is now a hex code like #141eb3 from placement_teams.color
    return {
      backgroundColor: `${teamColor}25`,
      borderColor: `${teamColor}60`,
    };
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
  const STATUS_COLORS: Record<string, string> = {
    [t('dashboard_to_do')]: '#60a5fa',
    [t('dashboard_in_progress')]: '#f59e0b',
    [t('dashboard_completed')]: '#4ade80'
  };
  if (loading) {
    return <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>;
  }
  return <div>
      {currentEmployee?.role === 'admin' && <Alert className="mb-6 bg-blue-50 border border-blue-200">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800">{t('dashboard_admin_account')}</AlertTitle>
          <AlertDescription className="text-blue-700">
            {t('dashboard_admin_description')}
          </AlertDescription>
        </Alert>}

      {projects.length === 0 && <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
          <p className="text-yellow-800">{t('dashboard_no_projects')}</p>
          <SeedDataButton />
        </div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title={t('dashboard_total_projects')} value={totalProjects.toString()} footer={t('dashboard_projects_managed')} icon={<Calendar className="h-5 w-5 text-blue-500" />} />
        <StatCard title={t('dashboard_completed_today')} value={todayCompletedCount.toString()} footer={t('dashboard_tasks_fulfilled')} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        {upcomingEvents.length > 0 && <StatCard title={t('dashboard_logistics_out')} value={upcomingEvents.length.toString()} valueSubtext={upcomingEvents[0] ? `${t('dashboard_next')}: ${format(new Date(upcomingEvents[0].date), 'dd/MM')}` : ''} footer={upcomingEvents.slice(0, 2).map(event => `<span style="color: ${event.type === 'return' ? '#22c55e' : '#3b82f6'}">${format(new Date(event.date), 'dd/MM')} - ${event.project_name}</span>`).join('<br>')} icon={<Users className="h-5 w-5 text-purple-500" />} onClick={() => navigate(createLocalizedPath('/logistics-out'))} />}
        <StatCard title={t('dashboard_truck_loading')} value={truckLoadingData.todayLoadings.length > 0 ? truckLoadingData.todayLoadings.length.toString() : truckLoadingData.daysToNext.toString()} footer={truckLoadingData.todayLoadings.length > 0 ? `${t('dashboard_loading_today')}: ${truckLoadingData.todayLoadings.map(l => l.project.name).join(', ')}` : truckLoadingData.daysToNext > 0 ? `${truckLoadingData.daysToNext} ${t('dashboard_days_to_next')}` : t('dashboard_no_upcoming')} icon={<Truck className="h-5 w-5 text-orange-500" />} />
      </div>
      
      {/* Weekly Loading Schedule */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('dashboard_weekly_schedule')}
            </CardTitle>
            <div className="flex items-center justify-between md:justify-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevWeek} disabled={weekLoading} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs md:text-sm font-medium min-w-[140px] md:min-w-[200px] text-center px-2">
                {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
                {weekLoading && <span className="ml-2 text-xs text-gray-500">{t('dashboard_loading')}</span>}
              </span>
              <Button variant="outline" size="icon" onClick={nextWeek} disabled={weekLoading} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
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
                  return <div key={`${assignment.project.id}-${index}`} className={cn("p-1 rounded text-xs border cursor-pointer hover:opacity-80 transition-opacity relative", getProjectColor(assignment.project.status), isManuallyAdjusted && "ring-2 ring-orange-400", isCharged && "opacity-50")} style={getTeamBackgroundStyle(assignment.teamColor)} onClick={() => navigate(createLocalizedPath(`/projects/${assignment.project.id}`))}>
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
                            {assignment.truck && <span className="mr-1">🚛 {assignment.truck.name}</span>}
                            {t('dashboard_install')}: {format(new Date(assignment.project.installation_date), 'MMM d')} | {assignment.project.progress || 0}%
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
              {t('dashboard_task_completion_trend')}
            </CardTitle>
            <CardDescription>{t('dashboard_tasks_last_7_days')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ChartContainer config={{
              completed: {
                label: t('dashboard_completed'),
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
              {t('dashboard_tasks_by_status')}
            </CardTitle>
            <CardDescription>{t('dashboard_status_distribution')}</CardDescription>
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

      {/* Workstation Stats Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Factory className="h-6 w-6" />
          {t('dashboard_workstation_overview')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {workstationStats.map(ws => (
            <Card key={ws.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {ws.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 pb-3 border-b">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{ws.openTasks}</div>
                    <div className="text-xs text-muted-foreground">{t('dashboard_open_tasks')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{ws.openProjects}</div>
                    <div className="text-xs text-muted-foreground">{t('dashboard_projects')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{ws.openHours}h</div>
                    <div className="text-xs text-muted-foreground">{t('dashboard_est_hours')}</div>
                  </div>
                </div>

                {/* All Todo Tasks */}
                {ws.todoTasks.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ws.todoTasks.map((task, idx) => (
                      <div key={idx} className="bg-muted/50 p-2 rounded-md">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" title={task.title}>
                              {task.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={task.projectName}>
                              {task.projectName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs py-0",
                                  task.priority === 'Urgent' && "border-red-500 text-red-700 bg-red-50",
                                  task.priority === 'High' && "border-orange-500 text-orange-700 bg-orange-50",
                                  task.priority === 'Medium' && "border-yellow-500 text-yellow-700 bg-yellow-50",
                                  task.priority === 'Low' && "border-green-500 text-green-700 bg-green-50"
                                )}
                              >
                                {task.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {(task.duration / 60).toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-50 p-3 rounded-md text-center">
                    <Check className="h-8 w-8 mx-auto text-green-600 mb-1" />
                    <div className="text-sm text-green-700 font-medium">{t('dashboard_all_tasks_completed')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {workstationStats.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('dashboard_no_workstations')}</p>
            </CardContent>
          </Card>
        )}
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