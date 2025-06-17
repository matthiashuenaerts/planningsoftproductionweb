import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, CalendarDays, Clock, Package, FileText, Folder, Plus, List, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, Project, Task, taskService } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { standardTasksService } from '@/services/standardTasksService';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { orderService } from '@/services/orderService';
import TaskList from '@/components/TaskList';
import ProjectFileManager from '@/components/ProjectFileManager';
import OneDriveIntegration from '@/components/OneDriveIntegration';
import NewOrderModal from '@/components/NewOrderModal';
import { PartsListDialog } from '@/components/PartsListDialog';
import { AccessoriesDialog } from '@/components/AccessoriesDialog';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [showAccessoriesDialog, setShowAccessoriesDialog] = useState(false);
  const { currentEmployee } = useAuth();
  const { t, lang, createLocalizedPath } = useLanguage();

  const fetchAndSetSortedTasks = useCallback(async (pId: string) => {
    const phaseData = await projectService.getProjectPhases(pId);
    const standardTasks = await standardTasksService.getAll();
    const standardTaskMap = new Map(standardTasks.map(st => [st.id, st.task_number]));

    let allTasks: Task[] = [];
    for (const phase of phaseData) {
      const phaseTasks = await taskService.getByPhase(phase.id);
      allTasks = [...allTasks, ...phaseTasks];
    }

    allTasks.sort((a, b) => {
      const taskA_number = a.standard_task_id ? standardTaskMap.get(a.standard_task_id) : undefined;
      const taskB_number = b.standard_task_id ? standardTaskMap.get(b.standard_task_id) : undefined;

      if (taskA_number && taskB_number) {
        return taskA_number.localeCompare(taskB_number, undefined, { numeric: true });
      }
      if (taskA_number) return -1;
      if (taskB_number) return 1;
      return a.title.localeCompare(b.title);
    });
    
    setTasks(allTasks);
  }, []);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const projectData = await projectService.getById(projectId);
        setProject(projectData);
        
        await fetchAndSetSortedTasks(projectId);

        // Fetch accessories and orders
        const accessoriesData = await accessoriesService.getByProject(projectId);
        setAccessories(accessoriesData);

        const ordersData = await orderService.getByProject(projectId);
        
        const ordersWithDetails = await Promise.all(
          ordersData.map(async (order) => {
            if (order.order_type === 'semi-finished') {
              const orderSteps = await orderService.getOrderSteps(order.id);
              return { ...order, orderSteps };
            }
            return order;
          })
        );
        setOrders(ordersWithDetails);
      } catch (error: any) {
        toast({
          title: t('error'),
          description: t('failed_to_load_projects', { message: error.message }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, toast, fetchAndSetSortedTasks, t]);

  const checkAndUpdateLimitPhases = async (completedTaskId?: string) => {
    if (!projectId) return;
    
    try {
      // Get all tasks in the project that are on HOLD and have standard_task_id
      const { data: holdTasks, error: holdError } = await supabase
        .from('tasks')
        .select(`
          *,
          phases!inner(project_id)
        `)
        .eq('phases.project_id', projectId)
        .eq('status', 'HOLD')
        .not('standard_task_id', 'is', null);

      if (holdError) {
        console.error('Error fetching HOLD tasks:', holdError);
        return;
      }

      if (!holdTasks || holdTasks.length === 0) {
        console.log('No HOLD tasks found with standard_task_id');
        return;
      }

      // Check each HOLD task to see if its limit phases are now satisfied
      const tasksToUpdate = [];
      for (const holdTask of holdTasks) {
        if (holdTask.standard_task_id) {
          try {
            const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(
              holdTask.standard_task_id,
              projectId
            );

            if (limitPhasesSatisfied) {
              tasksToUpdate.push(holdTask);
            }
          } catch (error) {
            console.error(`Error checking limit phases for task ${holdTask.id}:`, error);
          }
        }
      }

      // Update all eligible tasks from HOLD to TODO
      if (tasksToUpdate.length > 0) {
        console.log(`Updating ${tasksToUpdate.length} tasks from HOLD to TODO`);
        
        for (const task of tasksToUpdate) {
          await supabase
            .from('tasks')
            .update({ 
              status: 'TODO',
              status_changed_at: new Date().toISOString()
            })
            .eq('id', task.id);
        }
        
        // No longer refetching here, caller will handle it.

        toast({
          title: t('tasks_updated'),
          description: t('tasks_updated_desc', { count: tasksToUpdate.length.toString() }),
        });
      }
    } catch (error) {
      console.error('Error in checkAndUpdateLimitPhases:', error);
    }
  };

  const checkLimitPhasesBeforeStart = async (taskId: string, standardTaskId?: string): Promise<boolean> => {
    if (!projectId || !standardTaskId) return true;
    
    try {
      const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(
        standardTaskId,
        projectId
      );

      if (!limitPhasesSatisfied) {
        toast({
          title: t('cannot_start_task'),
          description: t('cannot_start_task_desc'),
          variant: "destructive"
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking limit phases before start:', error);
      return true; // Allow start if we can't check (fail open)
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (!currentEmployee || !projectId) {
      toast({
        title: t('auth_error'),
        description: t('auth_error_desc'),
        variant: "destructive"
      });
      return;
    }
    
    try {
      const statusValue = newStatus as string;
      const currentTask = tasks.find(task => task.id === taskId);
      
      if (statusValue === 'IN_PROGRESS') {
        const canStart = await checkLimitPhasesBeforeStart(taskId, currentTask?.standard_task_id);
        if (!canStart) {
          return;
        }
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        toast({
          title: t('task_started'),
          description: t('task_started_desc'),
        });
      } else if (statusValue === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        toast({
          title: t('task_completed'),
          description: t('task_completed_desc'),
        });
      } else {
        const updateData: Partial<Task> = { 
          status: newStatus, 
          status_changed_at: new Date().toISOString() 
        };
      
        if (statusValue === 'IN_PROGRESS') {
          updateData.assignee_id = currentEmployee.id;
        }
      
        if (statusValue === 'COMPLETED') {
          updateData.completed_at = new Date().toISOString();
          updateData.completed_by = currentEmployee.id;
        }
      
        await taskService.update(taskId, updateData);
        toast({
          title: t('task_updated'),
          description: t('task_updated_desc', { status: newStatus }),
        });
      }

      if (newStatus === 'COMPLETED') {
        await checkAndUpdateLimitPhases(taskId);
      }

      await fetchAndSetSortedTasks(projectId);

    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('task_status_update_error', { message: error.message }),
        variant: "destructive"
      });
    }
  };

  const handleNewOrderSuccess = () => {
    toast({
      title: t('success'),
      description: t('order_created_successfully'),
    });
    // Refresh orders data
    if (projectId) {
      orderService.getByProject(projectId).then(setOrders);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{t('project_not_found')}</h2>
              <p className="text-muted-foreground mb-4">{t('project_not_found_description')}</p>
              <Button onClick={() => navigate(createLocalizedPath('/projects'))}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">{t('status_planned')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">{t('in_progress')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('completed')}</Badge>;
      case 'on_hold':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{t('status_on_hold')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'HOLD'];
    if (!validStatuses.includes(status)) {
      return 'bg-gray-100 text-gray-800';
    }
    
    switch (status) {
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'HOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskCountByStatus = (status: string) => {
    return tasks.filter(task => task.status === status).length;
  };

  // Group tasks by status - Fix the filtering logic
  const todoTasks = tasks.filter(task => task.status === 'TODO');
  const holdTasks = tasks.filter(task => task.status === 'HOLD');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  // Combine TODO and HOLD tasks for the "Open tasks" tab
  const openTasks = [...todoTasks, ...holdTasks];

  // Calculate summary stats
  const openOrdersCount = orders.filter(order => order.status === 'pending').length;
  const unavailableAccessoriesCount = accessories.filter(acc => 
    acc.status === 'to_order' || acc.status === 'ordered'
  ).length;
  const inStockAccessoriesCount = accessories.filter(acc => acc.status === 'in_stock').length;
  const deliveredAccessoriesCount = accessories.filter(acc => acc.status === 'delivered').length;
  const semiFinishedOrders = orders.filter(order => order.order_type === 'semi-finished');

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(createLocalizedPath('/projects'))}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
            </Button>
            
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
                <p className="text-muted-foreground">{t('client_label')}: {project?.client}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => navigate(createLocalizedPath(`/projects/${projectId}/orders`))}
                >
                  <Package className="mr-2 h-4 w-4" /> {t('orders')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPartsListDialog(true)}
                >
                  <List className="mr-2 h-4 w-4" /> {t('parts_list')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowAccessoriesDialog(true)}
                >
                  <Settings className="mr-2 h-4 w-4" /> {t('accessories')}
                </Button>
                <Button 
                  variant={activeTab === 'files' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('files')}
                >
                  <FileText className="mr-2 h-4 w-4" /> {t('files')}
                </Button>
                <Button 
                  variant={activeTab === 'onedrive' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('onedrive')}
                >
                  <Folder className="mr-2 h-4 w-4" /> {t('onedrive')}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{openTasks.length}</div>
                <p className="text-xs text-muted-foreground">{t('open_tasks')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{getTaskCountByStatus('IN_PROGRESS')}</div>
                <p className="text-xs text-muted-foreground">{t('in_progress')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{getTaskCountByStatus('COMPLETED')}</div>
                <p className="text-xs text-muted-foreground">{t('completed')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{tasks.length}</div>
                <p className="text-xs text-muted-foreground">{t('total_tasks')}</p>
              </CardContent>
            </Card>
          </div>

          {activeTab === 'files' ? (
            <ProjectFileManager projectId={projectId!} />
          ) : activeTab === 'onedrive' ? (
            <OneDriveIntegration projectId={projectId!} projectName={project?.name || ''} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Summary Card */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>{t('project_summary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('status')}</h4>
                    <div>{project && getStatusBadge(project.status)}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t('project_progress')}</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('completion')}</span>
                        <span className="font-medium">{project?.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div 
                          className="bg-primary h-2.5 rounded-full" 
                          style={{ width: `${project?.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t('orders_and_accessories')}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-orange-50 p-2 rounded">
                        <div className="font-medium text-orange-800">{openOrdersCount}</div>
                        <div className="text-orange-600 text-xs">{t('open_orders')}</div>
                      </div>
                      <div className="bg-red-50 p-2 rounded">
                        <div className="font-medium text-red-800">{unavailableAccessoriesCount}</div>
                        <div className="text-red-600 text-xs">{t('to_order')}</div>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <div className="font-medium text-green-800">{inStockAccessoriesCount}</div>
                        <div className="text-green-600 text-xs">{t('in_stock')}</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="font-medium text-blue-800">{deliveredAccessoriesCount}</div>
                        <div className="text-blue-600 text-xs">{t('delivered')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t('important_dates')}</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('start_date_label')}:</span>
                      <span>{project?.start_date && formatDate(project.start_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('installation_date_label')}:</span>
                      <span>{project?.installation_date && formatDate(project.installation_date)}</span>
                    </div>
                  </div>

                  {semiFinishedOrders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">{t('semi_finished_deliveries')}</h4>
                      <div className="space-y-1.5 text-sm">
                        {semiFinishedOrders.map((order: any) => (
                          order.orderSteps && order.orderSteps.length > 0 && (
                            <div key={order.id} className="bg-gray-50 p-2 rounded">
                              <p className="font-medium mb-1">{order.supplier}{t('main_order_suffix')}</p>
                              <div className="pl-2 space-y-1">
                                {order.orderSteps
                                  .filter((step: any) => step.supplier)
                                  .map((step: any) => (
                                    <div key={step.id} className="flex justify-between items-center">
                                      <span className="text-muted-foreground truncate" title={`${step.name} (${step.supplier})`}>
                                        {step.name} ({step.supplier})
                                      </span>
                                      <span className="font-medium whitespace-nowrap ml-2">
                                        {step.end_date ? formatDate(step.end_date) : t('not_applicable')}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Project Tasks Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t('project_tasks')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="todo">
                    <TabsList className="mb-4">
                      <TabsTrigger value="todo">{t('open_tasks_tab', { count: openTasks.length.toString() })}</TabsTrigger>
                      <TabsTrigger value="in_progress">{t('in_progress_tab', { count: inProgressTasks.length.toString() })}</TabsTrigger>
                      <TabsTrigger value="completed">{t('completed_tab', { count: completedTasks.length.toString() })}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="todo">
                      <TaskList 
                        tasks={openTasks} 
                        title={t('open_tasks_title')} 
                        onTaskStatusChange={handleTaskStatusChange}
                        showCompleteButton={true}
                      />
                    </TabsContent>
                    <TabsContent value="in_progress">
                      <TaskList 
                        tasks={inProgressTasks} 
                        title={t('in_progress_tasks_title')} 
                        onTaskStatusChange={handleTaskStatusChange}
                      />
                    </TabsContent>
                    <TabsContent value="completed">
                      <TaskList 
                        tasks={completedTasks} 
                        title={t('completed_tasks_title')}
                        onTaskStatusChange={handleTaskStatusChange}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal with Add Order button moved here */}
      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId!}
        onSuccess={handleNewOrderSuccess}
        showAddOrderButton={true}
        accessories={accessories}
        installationDate={project?.installation_date}
      />

      {/* Parts List Dialog */}
      <PartsListDialog
        isOpen={showPartsListDialog}
        onClose={() => setShowPartsListDialog(false)}
        projectId={projectId!}
        onImportComplete={() => {
          toast({
            title: t('success'),
            description: t('parts_list_imported_successfully'),
          });
        }}
      />

      {/* Accessories Dialog */}
      <AccessoriesDialog
        open={showAccessoriesDialog}
        onOpenChange={setShowAccessoriesDialog}
        projectId={projectId!}
      />
    </div>
  );
};

export default ProjectDetails;
