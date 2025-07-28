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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Calendar, CalendarDays, Clock, Package, FileText, Folder, Plus, List, Settings, Barcode, TrendingUp, TrendingDown, Edit3, Save, X, Home, Camera, Paperclip, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import OrderEditModal from '@/components/OrderEditModal';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

interface TaskWithTimeData extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  actual_duration_minutes?: number;
  efficiency_percentage?: number;
}

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithTimeData[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{ [orderId: string]: any[] }>({});
  const [orderAttachments, setOrderAttachments] = useState<{ [orderId: string]: any[] }>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [showAccessoriesDialog, setShowAccessoriesDialog] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [projectEfficiency, setProjectEfficiency] = useState<number | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const { currentEmployee } = useAuth();
  const { t, lang, createLocalizedPath } = useLanguage();

  const calculateAndSaveTaskEfficiency = useCallback(async (completedTasks: TaskWithTimeData[]) => {
    if (!projectId || completedTasks.length === 0) return [];

    // Filter out tasks that already have efficiency data calculated
    const tasksNeedingCalculation = completedTasks.filter(task => 
      task.actual_duration_minutes === null || task.actual_duration_minutes === undefined ||
      task.efficiency_percentage === null || task.efficiency_percentage === undefined
    );

    if (tasksNeedingCalculation.length === 0) {
      console.log('All completed tasks already have efficiency data - skipping calculation');
      return completedTasks;
    }

    console.log(`Processing ${tasksNeedingCalculation.length} tasks that need efficiency calculation (skipping ${completedTasks.length - tasksNeedingCalculation.length} already calculated)`);
    
    // Get all task IDs for batch query - only for tasks needing calculation
    const taskIds = tasksNeedingCalculation.map(task => task.id);
    
    // Batch fetch all time registrations for tasks needing calculation
    const { data: allTimeRegs, error: timeRegsError } = await supabase
      .from('time_registrations')
      .select('task_id, duration_minutes')
      .in('task_id', taskIds)
      .not('duration_minutes', 'is', null);

    if (timeRegsError) {
      console.error('Error fetching time registrations:', timeRegsError);
      return completedTasks;
    }

    // Group time registrations by task_id
    const timeRegsByTask = new Map<string, number>();
    allTimeRegs?.forEach(reg => {
      const currentTotal = timeRegsByTask.get(reg.task_id) || 0;
      timeRegsByTask.set(reg.task_id, currentTotal + (reg.duration_minutes || 0));
    });

    let totalPlannedMinutes = 0;
    let totalActualMinutes = 0;
    const tasksToUpdate: { id: string; actual_duration_minutes: number; efficiency_percentage: number }[] = [];
    const updatedTasks: TaskWithTimeData[] = [...completedTasks];

    // Process only tasks that need calculation
    for (const task of tasksNeedingCalculation) {
      const actualMinutes = timeRegsByTask.get(task.id) || 0;
      const plannedMinutes = task.duration || 0;

      console.log(`Task ${task.id}: Planned ${plannedMinutes}min, Actual ${actualMinutes}min`);

      if (plannedMinutes > 0 && actualMinutes > 0) {
        const efficiency = ((plannedMinutes - actualMinutes) / plannedMinutes) * 100;
        
        totalPlannedMinutes += plannedMinutes;
        totalActualMinutes += actualMinutes;

        tasksToUpdate.push({
          id: task.id,
          actual_duration_minutes: actualMinutes,
          efficiency_percentage: Math.round(efficiency)
        });

        // Update the task in the updatedTasks array
        const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
          updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            actual_duration_minutes: actualMinutes,
            efficiency_percentage: Math.round(efficiency)
          };
        }
      } else {
        console.log(`Skipping task ${task.id}: plannedMinutes=${plannedMinutes}, actualMinutes=${actualMinutes}`);
      }
    }

    // Include already calculated tasks in project efficiency calculation
    completedTasks.forEach(task => {
      if (task.actual_duration_minutes && task.duration && !tasksNeedingCalculation.includes(task)) {
        totalPlannedMinutes += task.duration;
        totalActualMinutes += task.actual_duration_minutes;
      }
    });

    // Batch update only tasks that need updating
    if (tasksToUpdate.length > 0) {
      console.log(`Batch updating ${tasksToUpdate.length} tasks with efficiency data`);
      
      const updatePromises = tasksToUpdate.map(taskUpdate => 
        supabase
          .from('tasks')
          .update({
            actual_duration_minutes: taskUpdate.actual_duration_minutes,
            efficiency_percentage: taskUpdate.efficiency_percentage
          })
          .eq('id', taskUpdate.id)
      );

      try {
        await Promise.all(updatePromises);
        console.log('Successfully batch updated all task efficiencies');
      } catch (error) {
        console.error('Error batch updating task efficiencies:', error);
      }
    }

    // Calculate and save overall project efficiency
    if (totalPlannedMinutes > 0) {
      const overallEfficiency = ((totalPlannedMinutes - totalActualMinutes) / totalPlannedMinutes) * 100;
      setProjectEfficiency(Math.round(overallEfficiency));
      
      console.log(`Project efficiency: ${Math.round(overallEfficiency)}% (${totalActualMinutes}min actual vs ${totalPlannedMinutes}min planned)`);
      
      try {
        await supabase
          .from('projects')
          .update({
            efficiency_percentage: Math.round(overallEfficiency)
          })
          .eq('id', projectId);

        console.log('Successfully updated project efficiency in database');
      } catch (error) {
        console.error('Error updating project efficiency:', error);
      }
    }

    return updatedTasks;
  }, [projectId]);

  const fetchAndSetSortedTasks = useCallback(async (pId: string) => {
    console.log('Fetching and sorting tasks for project:', pId);
    
    const phaseData = await projectService.getProjectPhases(pId);
    const standardTasks = await standardTasksService.getAll();
    const standardTaskMap = new Map(standardTasks.map(st => [st.id, st.task_number]));

    let allTasks: TaskWithTimeData[] = [];
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

    const completedTasks = allTasks.filter(task => task.status === 'COMPLETED');
    console.log(`Found ${completedTasks.length} completed tasks`);
    
    if (completedTasks.length > 0) {
      const updatedCompletedTasks = await calculateAndSaveTaskEfficiency(completedTasks);
      
      // Replace tasks that were updated
      allTasks = allTasks.map(task => {
        const updatedTask = updatedCompletedTasks.find(ut => ut.id === task.id);
        return updatedTask || task;
      });
    }
    
    setTasks(allTasks);
  }, [calculateAndSaveTaskEfficiency]);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        console.log('Loading project data for:', projectId);
        
        const projectData = await projectService.getById(projectId);
        setProject(projectData);
        
        // Fetch and process tasks with time registration data
        await fetchAndSetSortedTasks(projectId);

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

        // Fetch project efficiency from database (it should be updated by now)
        try {
          const { data: projectWithEfficiency } = await supabase
            .from('projects')
            .select('efficiency_percentage')
            .eq('id', projectId)
            .maybeSingle();

          if (projectWithEfficiency?.efficiency_percentage !== null) {
            setProjectEfficiency(projectWithEfficiency.efficiency_percentage);
            console.log('Loaded project efficiency from database:', projectWithEfficiency.efficiency_percentage);
          }
        } catch (error) {
          console.error('Error fetching project efficiency:', error);
        }
      } catch (error: any) {
        console.error('Error loading project data:', error);
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

      // Recalculate efficiency when task is completed or any status changes
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
    if (projectId) {
      orderService.getByProject(projectId).then(setOrders);
    }
  };

  const handleEditDescription = () => {
    setEditedDescription(project?.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!projectId || !project) return;

    try {
      setSavingDescription(true);
      await projectService.update(projectId, { description: editedDescription });
      setProject({ ...project, description: editedDescription });
      setIsEditingDescription(false);
      toast({
        title: t('success'),
        description: t('project_updated_successfully')
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_update_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setSavingDescription(false);
    }
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  // Helper functions for order management
  const loadOrderItems = async (orderId: string) => {
    try {
      const items = await orderService.getOrderItems(orderId);
      setOrderItems(prev => ({ ...prev, [orderId]: items }));
    } catch (error) {
      console.error('Error loading order items:', error);
    }
  };

  const loadOrderAttachments = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({ ...prev, [orderId]: attachments }));
    } catch (error) {
      console.error('Error loading order attachments:', error);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
      // Load order items and attachments when expanding
      if (!orderItems[orderId]) {
        loadOrderItems(orderId);
      }
      if (!orderAttachments[orderId]) {
        loadOrderAttachments(orderId);
      }
    }
    setExpandedOrders(newExpanded);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus as any);
      const updatedOrders = await orderService.getByProject(projectId!);
      setOrders(updatedOrders);
      toast({
        title: t('success'),
        description: t('order_status_updated'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await orderService.delete(orderId);
      const updatedOrders = await orderService.getByProject(projectId!);
      setOrders(updatedOrders);
      toast({
        title: t('success'),
        description: t('order_deleted_successfully'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderEditModal(true);
  };

  const handleOrderEditSuccess = () => {
    if (projectId) {
      orderService.getByProject(projectId).then(setOrders);
    }
    setShowOrderEditModal(false);
    setSelectedOrderId(null);
  };

  const handleDeliveryConfirm = async (orderId: string) => {
    try {
      await orderService.updateOrderStatus(orderId, 'delivered');
      const updatedOrders = await orderService.getByProject(projectId!);
      setOrders(updatedOrders);
      loadOrderAttachments(orderId); // Reload attachments to show the new photo
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
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
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'delayed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'delayed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTaskCountByStatus = (status: string) => {
    return tasks.filter(task => task.status === status).length;
  };

  const todoTasks = tasks.filter(task => task.status === 'TODO');
  const holdTasks = tasks.filter(task => task.status === 'HOLD');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  const openTasks = [...todoTasks, ...holdTasks];

  const openOrdersCount = orders.filter(order => order.status === 'pending').length;
  const undeliveredOrdersCount = orders.filter(order => order.status !== 'delivered').length;
  const allOrdersDelivered = orders.length > 0 && undeliveredOrdersCount === 0;
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
            
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
                <p className="text-muted-foreground">{t('client_label')}: {project?.client}</p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant={activeTab === 'home' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('home')}
                >
                  <Home className="mr-2 h-4 w-4" /> {t('home')}
                </Button>
                <Button 
                  variant={activeTab === 'orders' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('orders')}
                  className={cn(
                    activeTab === 'orders' ? '' : (
                      allOrdersDelivered 
                        ? "bg-green-500 text-white hover:bg-green-600" 
                        : undeliveredOrdersCount > 0 
                          ? "bg-red-500 text-white hover:bg-red-600" 
                          : ""
                    )
                  )}
                >
                  <Package className="mr-2 h-4 w-4" /> 
                  {t('orders')}
                  {undeliveredOrdersCount > 0 && (
                    <span className="ml-2 bg-white text-red-500 px-2 py-1 rounded-full text-xs font-bold">
                      {undeliveredOrdersCount}
                    </span>
                  )}
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
          ) : activeTab === 'orders' ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('orders')}</CardTitle>
                  <Button onClick={() => setShowNewOrderModal(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('add_order')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">{t('no_orders_found')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <Collapsible 
                          key={order.id} 
                          open={expandedOrders.has(order.id)}
                          onOpenChange={() => toggleOrderExpansion(order.id)}
                        >
                          <div className={cn(
                            "border rounded-lg p-4 transition-all duration-200",
                            order.status === 'delivered' ? 'bg-green-50 border-green-200' :
                            order.status === 'delayed' ? 'bg-red-50 border-red-200' :
                            order.status === 'pending' ? 'bg-orange-50 border-orange-200' :
                            'bg-card border-border'
                          )}>
                            {/* Order Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" className="p-0 h-auto flex items-center gap-2 hover:bg-transparent">
                                    {expandedOrders.has(order.id) ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <h4 className="font-semibold text-lg">{order.supplier}</h4>
                                  </Button>
                                </CollapsibleTrigger>
                                
                                {/* Status Badge with Icon */}
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(order.status)}
                                  <Badge className={getStatusColor(order.status)}>
                                    {order.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {/* Manual Status Editor */}
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => handleStatusChange(order.id, value)}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs bg-background border z-50">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50">
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="canceled">Canceled</SelectItem>
                                    <SelectItem value="delayed">Delayed</SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Action Buttons */}
                                <div className="flex gap-1">{/* Action Buttons */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditOrder(order.id)}
                                    className="h-8 w-8 p-0 hover:bg-blue-50"
                                    title="Edit order"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                                    title="Delete order"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Order Basic Info - Enhanced Design */}
                            <div className="bg-muted/30 rounded-lg p-3 mb-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <span className="font-medium text-muted-foreground">{t('expected_delivery')}:</span>
                                    <div className="font-medium">
                                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : t('not_set')}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <span className="font-medium text-muted-foreground">{t('order_type')}:</span>
                                    <div className="font-medium capitalize">{order.order_type.replace('_', ' ')}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <span className="font-medium text-muted-foreground">{t('created')}:</span>
                                    <div className="font-medium">
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {order.notes && (
                              <div className="bg-blue-50 border-l-4 border-blue-200 p-3 mb-3">
                                <div className="flex items-start gap-2">
                                  <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-blue-800 mb-1">Order Notes:</p>
                                    <p className="text-sm text-blue-700 italic">"{order.notes}"</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Camera and File Actions - Enhanced */}
                            <div className="flex items-center justify-between mb-3 p-3 bg-muted/20 rounded-lg">
                              <div className="flex items-center gap-2">
                                <h5 className="font-medium text-sm">Attachments & Actions:</h5>
                              </div>
                              <OrderAttachmentUploader 
                                orderId={order.id}
                                onUploadSuccess={() => loadOrderAttachments(order.id)}
                                compact={true}
                                showDeliveryConfirm={order.status !== 'delivered'}
                                onDeliveryConfirm={() => handleDeliveryConfirm(order.id)}
                              />
                            </div>

                            {/* Collapsible Content */}
                            <CollapsibleContent className="space-y-4">
                              {/* Order Items */}
                              {orderItems[order.id] && orderItems[order.id].length > 0 && (
                                <div className="mb-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Package className="h-4 w-4 text-primary" />
                                    <h5 className="font-semibold text-sm">{t('order_items')} ({orderItems[order.id].length})</h5>
                                  </div>
                                  <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                                    {orderItems[order.id].map((item: any, index: number) => (
                                      <div key={item.id} className="flex justify-between items-center p-2 bg-background rounded border">
                                        <div className="flex-1">
                                          <span className="font-medium text-sm">{item.description}</span>
                                          {item.article_code && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Article: {item.article_code}
                                            </div>
                                          )}
                                          {item.notes && (
                                            <div className="text-xs text-muted-foreground mt-1 italic">
                                              Note: {item.notes}
                                            </div>
                                          )}
                                        </div>
                                        <div className="ml-4">
                                          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                                            Qty: {item.quantity}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Order Attachments */}
                              {orderAttachments[order.id] && orderAttachments[order.id].length > 0 && (
                                <div className="mb-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Paperclip className="h-4 w-4 text-primary" />
                                    <h5 className="font-semibold text-sm">{t('attachments')} ({orderAttachments[order.id].length})</h5>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {orderAttachments[order.id].map((attachment: any) => (
                                      <div key={attachment.id} className="flex items-center justify-between bg-background rounded-lg p-3 border">
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className={cn(
                                            "p-2 rounded",
                                            attachment.file_name.includes('DELIVERY_CONFIRMED') 
                                              ? "bg-green-100 text-green-700" 
                                              : "bg-muted text-muted-foreground"
                                          )}>
                                            {attachment.file_name.includes('DELIVERY_CONFIRMED') ? (
                                              <CheckCircle className="h-4 w-4" />
                                            ) : (
                                              <Paperclip className="h-4 w-4" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {(attachment.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(attachment.created_at).toLocaleDateString()}
                                            </p>
                                            {attachment.file_name.includes('DELIVERY_CONFIRMED') && (
                                              <p className="text-xs text-green-600 font-medium">✓ Delivery Confirmation Photo</p>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(attachment.file_path, '_blank')}
                                          className="ml-3 h-8"
                                        >
                                          <Camera className="h-3 w-3 mr-1" />
                                          {t('view')}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* No items/attachments message */}
                              {(!orderItems[order.id] || orderItems[order.id].length === 0) && 
                               (!orderAttachments[order.id] || orderAttachments[order.id].length === 0) && (
                                <div className="text-center py-8 bg-muted/20 rounded-lg">
                                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-muted-foreground text-sm font-medium">
                                    {t('no_items_or_attachments')}
                                  </p>
                                  <p className="text-muted-foreground text-xs mt-1">
                                    Expand this order to add items and attachments
                                  </p>
                                </div>
                              )}
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">{t('description') || 'Description'}</h4>
                      {!isEditingDescription && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleEditDescription}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {isEditingDescription ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          placeholder={t('enter_project_description') || 'Enter project description...'}
                          className="min-h-[80px] resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveDescription}
                            disabled={savingDescription}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            {savingDescription ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEditDescription}
                            disabled={savingDescription}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {t('cancel') || 'Cancel'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {project?.description || (t('no_description') || 'No description added yet.')}
                      </div>
                    )}
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

                  {projectEfficiency !== null && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">{t('project_efficiency') || 'Project Efficiency'}</h4>
                      <div className="flex items-center gap-2">
                        {projectEfficiency >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-medium ${projectEfficiency >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {projectEfficiency >= 0 ? '+' : ''}{projectEfficiency}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {projectEfficiency >= 0 ? (t('efficiency_faster') || 'faster than planned') : (t('efficiency_slower') || 'slower than planned')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t('project_barcode')}</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowBarcodeDialog(true)}
                      className="w-full"
                    >
                      <Barcode className="mr-2 h-4 w-4" />
                      {t('view_barcode')}
                    </Button>
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
                        showEfficiencyData={true}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId!}
        onSuccess={handleNewOrderSuccess}
        showAddOrderButton={true}
        accessories={accessories}
        installationDate={project?.installation_date}
      />

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

      <AccessoriesDialog
        open={showAccessoriesDialog}
        onOpenChange={setShowAccessoriesDialog}
        projectId={projectId!}
      />

      <ProjectBarcodeDialog
        isOpen={showBarcodeDialog}
        onClose={() => setShowBarcodeDialog(false)}
        projectId={projectId!}
        projectName={project?.name || ''}
      />

      {selectedOrderId && (
        <OrderEditModal
          open={showOrderEditModal}
          onOpenChange={setShowOrderEditModal}
          orderId={selectedOrderId}
          onSuccess={handleOrderEditSuccess}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
