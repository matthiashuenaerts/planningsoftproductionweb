import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Calendar, 
  Clock, 
  Truck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Package,
  User,
  Target,
  Timer,
  ListTodo,
  Zap
} from 'lucide-react';
import { taskService, projectService, Project, Task } from '@/services/dataService';
import { rushOrderService } from '@/services/rushOrderService';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isBefore, addDays } from 'date-fns';

interface PersonalItem {
  id: string;
  title: string;
  content?: string;
  type: string;
  priority: string;
  status: string;
  due_date?: string;
  created_at: string;
}

interface TruckAssignment {
  id: string;
  project_id: string;
  loading_date: string;
  installation_date: string;
  notes?: string;
  project?: { name: string; client: string };
}

interface RushOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string;
  created_at: string;
}

interface ProductionMetrics {
  todayCompleted: number;
  todayTotal: number;
  weeklyAverage: number;
  onScheduleProjects: number;
  delayedProjects: number;
  efficiency: number;
}

const ProductionDashboard: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [todayTruckLoadings, setTodayTruckLoadings] = useState<TruckAssignment[]>([]);
  const [upcomingLogistics, setUpcomingLogistics] = useState<Project[]>([]);
  const [unstartedRushOrders, setUnstartedRushOrders] = useState<RushOrder[]>([]);
  const [productionMetrics, setProductionMetrics] = useState<ProductionMetrics>({
    todayCompleted: 0,
    todayTotal: 0,
    weeklyAverage: 0,
    onScheduleProjects: 0,
    delayedProjects: 0,
    efficiency: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, [currentEmployee]);

  const fetchDashboardData = async () => {
    if (!currentEmployee) return;
    
    try {
      setLoading(true);
      
      await Promise.all([
        fetchPersonalTasks(),
        fetchPersonalItems(),
        fetchTodayTruckLoadings(),
        fetchUpcomingLogistics(),
        fetchUnstartedRushOrders(),
        fetchProductionMetrics()
      ]);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalTasks = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tasks = await taskService.getByDueDate(today);
      
      // Filter tasks for current user or their workstation
      const myTasks = tasks.filter(task => 
        task.assignee_id === currentEmployee?.id || 
        task.workstation === currentEmployee?.workstation
      );
      
      setPersonalTasks(myTasks);
    } catch (error) {
      console.error('Error fetching personal tasks:', error);
    }
  };

  const fetchPersonalItems = async () => {
    try {
      const { data, error } = await supabase
        .from('personal_items')
        .select('*')
        .eq('user_id', currentEmployee?.id)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(5);

      if (error) throw error;
      setPersonalItems(data || []);
    } catch (error) {
      console.error('Error fetching personal items:', error);
    }
  };

  const fetchTodayTruckLoadings = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('project_truck_assignments')
        .select(`
          *,
          projects:project_id (name, client)
        `)
        .eq('loading_date', today)
        .order('loading_date');

      if (error) throw error;
      setTodayTruckLoadings(data || []);
    } catch (error) {
      console.error('Error fetching truck loadings:', error);
    }
  };

  const fetchUpcomingLogistics = async () => {
    try {
      const nextWeek = addDays(new Date(), 7).toISOString().split('T')[0];
      const projects = await projectService.getAll();
      
      const upcomingProjects = projects.filter(project => 
        project.status === 'in_progress' && 
        project.installation_date <= nextWeek &&
        project.installation_date >= new Date().toISOString().split('T')[0]
      );
      
      setUpcomingLogistics(upcomingProjects.slice(0, 5));
    } catch (error) {
      console.error('Error fetching upcoming logistics:', error);
    }
  };

  const fetchUnstartedRushOrders = async () => {
    try {
      const allRushOrders = await rushOrderService.getAllRushOrders();
      const unstarted = allRushOrders.filter(order => 
        order.status === 'pending'
      );
      setUnstartedRushOrders(unstarted.slice(0, 3));
    } catch (error) {
      console.error('Error fetching unstarted rush orders:', error);
    }
  };

  const fetchProductionMetrics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allTasks = await taskService.getAll();
      const allProjects = await projectService.getAll();
      
      // Today's metrics
      const todayTasks = allTasks.filter(task => task.due_date === today);
      const completedToday = todayTasks.filter(task => task.status === 'COMPLETED');
      
      // Project schedule analysis
      const onSchedule = allProjects.filter(project => {
        const installationDate = new Date(project.installation_date);
        const today = new Date();
        return project.status === 'in_progress' && !isBefore(installationDate, today);
      });
      
      const delayed = allProjects.filter(project => {
        const installationDate = new Date(project.installation_date);
        const today = new Date();
        return project.status === 'in_progress' && isBefore(installationDate, today);
      });
      
      // Weekly average (mock calculation for demo)
      const weeklyCompletedTasks = allTasks.filter(task => 
        task.status === 'COMPLETED' && task.completed_at
      );
      
      const efficiency = todayTasks.length > 0 
        ? Math.round((completedToday.length / todayTasks.length) * 100)
        : 100;

      setProductionMetrics({
        todayCompleted: completedToday.length,
        todayTotal: todayTasks.length,
        weeklyAverage: Math.round(weeklyCompletedTasks.length / 7),
        onScheduleProjects: onSchedule.length,
        delayedProjects: delayed.length,
        efficiency
      });
    } catch (error) {
      console.error('Error fetching production metrics:', error);
    }
  };

  const getScheduleStatus = () => {
    const { onScheduleProjects, delayedProjects } = productionMetrics;
    if (delayedProjects === 0) return { status: 'ahead', color: 'text-green-600', icon: TrendingUp };
    if (delayedProjects > onScheduleProjects) return { status: 'behind', color: 'text-red-600', icon: TrendingDown };
    return { status: 'on-track', color: 'text-blue-600', icon: Target };
  };

  const scheduleInfo = getScheduleStatus();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome back, {currentEmployee?.name}!
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM do, yyyy')} • Production Dashboard
        </p>
      </div>

      {/* Critical Alerts */}
      {(todayTruckLoadings.length > 0 || unstartedRushOrders.length > 0 || productionMetrics.delayedProjects > 0) && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {todayTruckLoadings.length > 0 && `${todayTruckLoadings.length} truck(s) need loading today. `}
            {unstartedRushOrders.length > 0 && `${unstartedRushOrders.length} urgent rush order(s) pending. `}
            {productionMetrics.delayedProjects > 0 && `${productionMetrics.delayedProjects} project(s) behind schedule.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Progress</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productionMetrics.todayCompleted}/{productionMetrics.todayTotal}
            </div>
            <Progress value={productionMetrics.efficiency} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{productionMetrics.efficiency}% efficiency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Status</CardTitle>
            <scheduleInfo.icon className={`h-4 w-4 ${scheduleInfo.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionMetrics.onScheduleProjects}</div>
            <p className="text-xs text-muted-foreground">
              On schedule, {productionMetrics.delayedProjects} delayed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Truck Loadings</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTruckLoadings.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rush Orders</CardTitle>
            <Zap className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unstartedRushOrders.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Personal Tasks Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                My Tasks Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {personalTasks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p>No tasks assigned for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {personalTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <p className="text-xs text-muted-foreground">{task.workstation}</p>
                      </div>
                      <Badge variant={
                        task.status === 'COMPLETED' ? 'default' :
                        task.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                      }>
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                  {personalTasks.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{personalTasks.length - 5} more tasks...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Items/Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-purple-600" />
                Personal Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {personalItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No personal notes</p>
              ) : (
                <div className="space-y-2">
                  {personalItems.map((item) => (
                    <div key={item.id} className="p-2 bg-muted/30 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.priority}
                        </Badge>
                        <span className="font-medium">{item.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Production Status Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Today's Truck Loading
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayTruckLoadings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No truck loadings scheduled</p>
              ) : (
                <div className="space-y-3">
                  {todayTruckLoadings.map((loading) => (
                    <div key={loading.id} className="p-3 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm">
                        {loading.project?.name || 'Unknown Project'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {loading.project?.client} • Install: {format(new Date(loading.installation_date), 'MMM dd')}
                      </p>
                      {loading.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{loading.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                Upcoming Logistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingLogistics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming logistics</p>
              ) : (
                <div className="space-y-3">
                  {upcomingLogistics.map((project) => (
                    <div key={project.id} className="p-3 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm">{project.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {project.client} • {format(new Date(project.installation_date), 'MMM dd')}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <Progress value={project.progress} className="flex-1 mr-2" />
                        <span className="text-xs font-medium">{project.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rush Orders & Alerts Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-red-600" />
                Urgent Rush Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unstartedRushOrders.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p>No urgent orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unstartedRushOrders.map((order) => (
                    <div key={order.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive" className="text-xs">
                          {order.priority}
                        </Badge>
                        <span className="text-xs text-red-600">
                          Due: {format(new Date(order.deadline), 'MMM dd')}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm">{order.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Created: {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-orange-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Calendar className="mr-2 h-4 w-4" />
                View Full Schedule
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Clock className="mr-2 h-4 w-4" />
                Time Registration
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <ListTodo className="mr-2 h-4 w-4" />
                Personal Tasks
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductionDashboard;