
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, User, Clock, CheckCircle, ArrowLeft, Plus, Building2, Package } from 'lucide-react';
import { format } from 'date-fns';
import NewTaskModal from '@/components/NewTaskModal';
import NewOrderModal from '@/components/NewOrderModal';
import { orderService } from '@/services/orderService';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date: string;
  workstation: string;
  assignee_id?: string;
  phase_id: string;
  standard_task_id?: string;
  employees?: {
    name: string;
  };
}

interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress: number;
  project_id: string;
  tasks: Task[];
}

interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: string;
}

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => dataService.getProjectById(id!),
    enabled: !!id
  });

  const { data: phases = [], isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('phases')
        .select(`
          *,
          tasks (
            *,
            employees (name)
          )
        `)
        .eq('project_id', id)
        .order('start_date');
      
      if (error) throw error;
      return data as Phase[];
    },
    enabled: !!id
  });

  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['project-orders', id],
    queryFn: () => id ? orderService.getByProject(id) : [],
    enabled: !!id
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'HOLD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const handleTaskStatusUpdate = (taskId: string, newStatus: string) => {
    updateTaskStatusMutation.mutate({ taskId, status: newStatus });
  };

  const handleNewTask = () => {
    queryClient.invalidateQueries({ queryKey: ['phases', id] });
    setIsNewTaskModalOpen(false);
  };

  const handleNewOrder = () => {
    refetchOrders();
    setIsNewOrderModalOpen(false);
  };

  if (projectLoading || phasesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Project not found</div>
        </div>
      </div>
    );
  }

  // Calculate overall statistics
  const allTasks = phases.flatMap(phase => phase.tasks || []);
  const completedTasks = allTasks.filter(task => task.status === 'COMPLETED');
  const inProgressTasks = allTasks.filter(task => task.status === 'IN_PROGRESS');
  const todoTasks = allTasks.filter(task => task.status === 'TODO');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/projects')}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-1">{project.description}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => setIsNewOrderModalOpen(true)}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Package className="h-4 w-4" />
              <span>New Order</span>
            </Button>
            <Button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </Button>
          </div>
        </div>

        {/* Project Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.progress}%</div>
              <Progress value={project.progress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                {completedTasks.length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Client</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{project.client}</div>
              <p className="text-xs text-muted-foreground">
                Project client
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Installation Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">
                {format(new Date(project.installation_date), 'MMM d, yyyy')}
              </div>
              <p className="text-xs text-muted-foreground">
                Scheduled date
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="phases" className="space-y-4">
          <TabsList>
            <TabsTrigger value="phases">Phases & Tasks</TabsTrigger>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="phases" className="space-y-6">
            {phases.map((phase) => (
              <Card key={phase.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{phase.name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(phase.start_date), 'MMM d')} - {format(new Date(phase.end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{phase.progress}%</div>
                        <Progress value={phase.progress} className="w-20" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {phase.tasks && phase.tasks.length > 0 ? (
                    <div className="space-y-3">
                      {phase.tasks.map((task) => (
                        <div key={task.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center text-sm text-gray-500">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {format(new Date(task.due_date), 'MMM d, yyyy')}
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <User className="h-4 w-4 mr-1" />
                                  {task.employees?.name || 'Unassigned'}
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <Building2 className="h-4 w-4 mr-1" />
                                  {task.workstation}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(task.status)}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              <div className="flex space-x-1">
                                {task.status === 'TODO' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTaskStatusUpdate(task.id, 'IN_PROGRESS')}
                                  >
                                    Start
                                  </Button>
                                )}
                                {task.status === 'IN_PROGRESS' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTaskStatusUpdate(task.id, 'COMPLETED')}
                                    className="text-green-600 border-green-600"
                                  >
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2">No tasks in this phase yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Order from {order.supplier}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Ordered: {format(new Date(order.order_date), 'MMM d, yyyy')} | 
                            Expected: {format(new Date(order.expected_delivery), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge className={
                          order.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'canceled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {order.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
                    <p className="mt-1 text-sm text-gray-500">Create your first order for this project.</p>
                    <Button
                      onClick={() => setIsNewOrderModalOpen(true)}
                      className="mt-4"
                    >
                      Create Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <NewTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          onTaskCreated={handleNewTask}
          preSelectedProject={project}
          phases={phases}
        />

        <NewOrderModal
          isOpen={isNewOrderModalOpen}
          onClose={() => setIsNewOrderModalOpen(false)}
          onOrderCreated={handleNewOrder}
          preSelectedProject={project}
        />
      </div>
    </div>
  );
};

export default ProjectDetails;
