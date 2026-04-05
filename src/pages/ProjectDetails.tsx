import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Calendar, CalendarDays, Clock, Package, FileText, Folder, Plus, List, Settings, Barcode, TrendingUp, TrendingDown, Edit3, Save, X, Home, Camera, Paperclip, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Loader2, Circle, Eye, ArrowUpDown, ArrowUp, ArrowDown, MessageCircle, MapPin, DollarSign, Printer, HeadphonesIcon } from 'lucide-react';
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
import { PartsListImporter } from '@/components/PartsListImporter';
import { PartsListManager } from '@/components/PartsListManager';
import { partsListService, PartsList, Part } from '@/services/partsListService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { AccessoriesDialog } from '@/components/AccessoriesDialog';
import { AccessoriesInlineView } from '@/components/AccessoriesInlineView';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import OrderEditModal from '@/components/OrderEditModal';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';
import { ProjectChat } from '@/components/ProjectChat';
import { ProjectChatInline } from '@/components/ProjectChatInline';
import { projectChatService } from '@/services/projectChatService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PartDetailDialog } from '@/components/PartDetailDialog';
import { ProjectCostingTab } from '@/components/ProjectCostingTab';
import AfterSalesTab from '@/components/AfterSalesTab';
import ProjectMeasurementTab from '@/components/ProjectMeasurementTab';
interface TaskWithTimeData extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  actual_duration_minutes?: number;
  efficiency_percentage?: number;
}
const ProjectDetails = () => {
  const {
    projectId
  } = useParams<{
    projectId: string;
  }>();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithTimeData[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{
    [orderId: string]: any[];
  }>({});
  const [orderAttachments, setOrderAttachments] = useState<{
    [orderId: string]: any[];
  }>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [refreshPartsKey, setRefreshPartsKey] = useState(0);
  const [partsLists, setPartsLists] = useState<PartsList[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [partsFilters, setPartsFilters] = useState({
    materiaal: '',
    dikte: '',
    afmetingen: '',
    aantal: '',
    wand_naam: '',
    workstation_name_status: '',
    commentaar: '',
    status: 'all'
  });
  const [partsSortConfig, setPartsSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showAccessoriesView, setShowAccessoriesView] = useState(false);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [projectEfficiency, setProjectEfficiency] = useState<number | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [showProjectChat, setShowProjectChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [showPartDetailDialog, setShowPartDetailDialog] = useState(false);
  const [projectTeamAssignments, setProjectTeamAssignments] = useState<any[]>([]);
  const {
    currentEmployee
  } = useAuth();
  const {
    t,
    lang,
    createLocalizedPath
  } = useLanguage();
  const isMobile = useIsMobile();
  const calculateAndSaveTaskEfficiency = useCallback(async (completedTasks: TaskWithTimeData[]) => {
    if (!projectId || completedTasks.length === 0) return [];

    // Filter out tasks that already have efficiency data calculated
    const tasksNeedingCalculation = completedTasks.filter(task => task.actual_duration_minutes === null || task.actual_duration_minutes === undefined || task.efficiency_percentage === null || task.efficiency_percentage === undefined);
    if (tasksNeedingCalculation.length === 0) {
      console.log('All completed tasks already have efficiency data - skipping calculation');
      return completedTasks;
    }
    console.log(`Processing ${tasksNeedingCalculation.length} tasks that need efficiency calculation (skipping ${completedTasks.length - tasksNeedingCalculation.length} already calculated)`);

    // Get all task IDs for batch query - only for tasks needing calculation
    const taskIds = tasksNeedingCalculation.map(task => task.id);

    // Batch fetch all time registrations for tasks needing calculation
    const {
      data: allTimeRegs,
      error: timeRegsError
    } = await supabase.from('time_registrations').select('task_id, duration_minutes').in('task_id', taskIds).not('duration_minutes', 'is', null);
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
    const tasksToUpdate: {
      id: string;
      actual_duration_minutes: number;
      efficiency_percentage: number;
    }[] = [];
    const updatedTasks: TaskWithTimeData[] = [...completedTasks];

    // Process only tasks that need calculation
    for (const task of tasksNeedingCalculation) {
      const actualMinutes = timeRegsByTask.get(task.id) || 0;
      const estimatedMinutes = task.estimated_duration || 0;
      console.log(`Task ${task.id}: Estimated ${estimatedMinutes}min, Actual ${actualMinutes}min`);
      if (estimatedMinutes > 0 && actualMinutes > 0) {
        const efficiency = (estimatedMinutes - actualMinutes) / estimatedMinutes * 100;
        totalPlannedMinutes += estimatedMinutes;
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
        console.log(`Skipping task ${task.id}: estimatedMinutes=${estimatedMinutes}, actualMinutes=${actualMinutes}`);
      }
    }

    // Include already calculated tasks in project efficiency calculation
    completedTasks.forEach(task => {
      if (task.actual_duration_minutes && task.estimated_duration && !tasksNeedingCalculation.includes(task)) {
        totalPlannedMinutes += task.estimated_duration;
        totalActualMinutes += task.actual_duration_minutes;
      }
    });

    // Batch update only tasks that need updating
    if (tasksToUpdate.length > 0) {
      console.log(`Batch updating ${tasksToUpdate.length} tasks with efficiency data`);
      const updatePromises = tasksToUpdate.map(taskUpdate => supabase.from('tasks').update({
        actual_duration_minutes: taskUpdate.actual_duration_minutes,
        efficiency_percentage: taskUpdate.efficiency_percentage
      }).eq('id', taskUpdate.id));
      try {
        await Promise.all(updatePromises);
        console.log('Successfully batch updated all task efficiencies');
      } catch (error) {
        console.error('Error batch updating task efficiencies:', error);
      }
    }

    // Calculate and save overall project efficiency
    if (totalPlannedMinutes > 0) {
      const overallEfficiency = (totalPlannedMinutes - totalActualMinutes) / totalPlannedMinutes * 100;
      setProjectEfficiency(Math.round(overallEfficiency));
      console.log(`Project efficiency: ${Math.round(overallEfficiency)}% (${totalActualMinutes}min actual vs ${totalPlannedMinutes}min planned)`);
      try {
        await supabase.from('projects').update({
          efficiency_percentage: Math.round(overallEfficiency)
        }).eq('id', projectId);
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
    console.log('Found phases:', phaseData?.length || 0, phaseData);
    const standardTasks = await standardTasksService.getAll();
    const standardTaskMap = new Map(standardTasks.map(st => [st.id, st.task_number]));
    let allTasks: TaskWithTimeData[] = [];
    for (const phase of phaseData) {
      const phaseTasks = await taskService.getByPhase(phase.id);
      console.log(`Phase ${phase.name} has ${phaseTasks.length} tasks:`, phaseTasks);
      allTasks = [...allTasks, ...phaseTasks];
    }
    console.log('Total tasks found:', allTasks.length, allTasks);
    allTasks.sort((a, b) => {
      const taskA_number = a.standard_task_id ? standardTaskMap.get(a.standard_task_id) : undefined;
      const taskB_number = b.standard_task_id ? standardTaskMap.get(b.standard_task_id) : undefined;
      if (taskA_number && taskB_number) {
        return taskA_number.localeCompare(taskB_number, undefined, {
          numeric: true
        });
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
    console.log('Setting tasks in state:', allTasks.length, 'total tasks');
    setTasks(allTasks);
  }, [calculateAndSaveTaskEfficiency]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle URL parameters for tab and order navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const orderIdParam = urlParams.get('orderId');
      
      if (tabParam) {
        setActiveTab(tabParam);
      }
      
      if (orderIdParam && tabParam === 'orders') {
        setExpandedOrders(new Set([orderIdParam]));
      }
    };

    // Handle initial load
    handlePopState();
    
    // Listen for popstate events
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
        const ordersWithDetails = await Promise.all(ordersData.map(async order => {
          if (order.order_type === 'semi-finished') {
            const orderSteps = await orderService.getOrderSteps(order.id);
            return {
              ...order,
              orderSteps
            };
          }
          return order;
        }));
        setOrders(ordersWithDetails);

        // Load all order items upfront for undelivered quantity calculation
        const allOrderItems: { [orderId: string]: any[] } = {};
        await Promise.all(ordersWithDetails.map(async order => {
          try {
            const items = await orderService.getOrderItems(order.id);
            allOrderItems[order.id] = items;
          } catch (error) {
            console.error(`Error loading order items for order ${order.id}:`, error);
            allOrderItems[order.id] = [];
          }
        }));
        setOrderItems(allOrderItems);

        // Fetch project efficiency from database (it should be updated by now)
        try {
          const {
            data: projectWithEfficiency
          } = await supabase.from('projects').select('efficiency_percentage').eq('id', projectId).maybeSingle();
          if (projectWithEfficiency?.efficiency_percentage !== null) {
            setProjectEfficiency(projectWithEfficiency.efficiency_percentage);
            console.log('Loaded project efficiency from database:', projectWithEfficiency.efficiency_percentage);
          }
        } catch (error) {
          console.error('Error fetching project efficiency:', error);
        }

        // Fetch team assignments for this project
        try {
          const { data: teamAssignments } = await supabase
            .from('project_team_assignments')
            .select('id, project_id, team_id, is_service_ticket, start_date, duration, service_hours, fixed_time, service_notes, placement_teams(id, name, color)')
            .eq('project_id', projectId);
          setProjectTeamAssignments(teamAssignments || []);
          console.log('Loaded team assignments:', teamAssignments);
        } catch (error) {
          console.error('Error fetching team assignments:', error);
        }
      } catch (error: any) {
        console.error('Error loading project data:', error);
        toast({
          title: t('error'),
          description: t('failed_to_load_projects', {
            message: error.message
          }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchProjectData();
  }, [projectId, toast, fetchAndSetSortedTasks, t]);
  useEffect(() => {
    if (projectId) {
      loadPartsLists();
    }
  }, [projectId, refreshPartsKey]);

  // Load unread chat count on component mount and when project changes
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (projectId) {
        try {
          const count = await projectChatService.getUnreadMessageCount(projectId);
          setUnreadChatCount(count);
        } catch (error) {
          console.error('Error loading unread chat count:', error);
        }
      }
    };
    
    loadUnreadCount();
  }, [projectId]);
  const loadPartsLists = async () => {
    if (!projectId) return;
    setLoadingParts(true);
    try {
      const lists = await partsListService.getPartsListsByProject(projectId);
      setPartsLists(lists);

      // If there's a parts list, load the parts automatically
      if (lists.length > 0) {
        const partsData = await partsListService.getPartsByPartsList(lists[0].id);
        setParts(partsData);
      } else {
        setParts([]);
      }
    } catch (error) {
      console.error('Error loading parts lists:', error);
    } finally {
      setLoadingParts(false);
    }
  };
  const updatePartColor = async (partId: string, color: 'none' | 'green' | 'orange' | 'red') => {
    try {
      await partsListService.updatePartColor(partId, color);
      setParts(prev => prev.map(part => part.id === partId ? {
        ...part,
        color_status: color
      } : part));
      toast({
        title: t('success'),
        description: 'Part color status has been updated'
      });
    } catch (error) {
      console.error('Error updating part color:', error);
      toast({
        title: t('error'),
        description: 'Failed to update part color',
        variant: 'destructive'
      });
    }
  };
  const handleDeletePartsList = async (partsListId: string) => {
    if (!confirm('Are you sure you want to delete this parts list?')) return;
    try {
      await partsListService.deletePartsList(partsListId);
      toast({
        title: t('success'),
        description: 'Parts list deleted successfully'
      });
      loadPartsLists();
    } catch (error) {
      console.error('Error deleting parts list:', error);
      toast({
        title: t('error'),
        description: 'Failed to delete parts list',
        variant: 'destructive'
      });
    }
  };

  const printItemLabel = (item: any, order: any) => {
    const installationDate = project?.installation_date 
      ? new Date(project.installation_date).toLocaleDateString()
      : 'Not set';
    
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    const labelContent = `
      <div style="
        width: 89mm; 
        height: 32mm; 
        padding: 1.5mm; 
        font-family: Arial, sans-serif; 
        line-height: 1.1; 
        box-sizing: border-box; 
        display: flex; 
        flex-direction: column; 
        justify-content: space-between;
      ">
        <!-- Project Name (Full Width, Top, Wrapping, Scaled Font) -->
        <div style="
          width: 100%;
          text-align: center;
          font-weight: bold;
          font-size: clamp(10pt, 5vw, 16pt);
          line-height: 1.1;
          word-wrap: break-word;
          overflow-wrap: break-word;
          margin-bottom: 1mm;
          white-space: normal;
        ">
          ${project?.name || 'Unknown Project'}
        </div>

        <!-- Stock Location (if any) -->
        ${item.stock_location ? `
        <div style="
          font-weight: bold;
          font-size: 14pt;
          text-align: center;
          border: 1px solid #ccc;
          padding: 1mm;
          background: #f0f0f0;
          margin-bottom: 1mm;
        ">
          ${item.stock_location}
        </div>
        ` : ''}

        <!-- Item Details -->
        <div style="font-size: 8pt; display: flex; justify-content: space-between; margin-bottom: 0.5mm;">
          <div>Art: ${item.article_code || item.description || 'N/A'}</div>
          <div>Qty: ${item.delivered_quantity || item.quantity || 0}</div>
        </div>

        <!-- Dates -->
        <div style="font-size: 8pt; display: flex; justify-content: space-between;">
          <div>Completed: ${currentDate}</div>
          <div>Install: ${installationDate}</div>
        </div>

        <!-- Supplier (Bottom) -->
        <div style="
          font-size: 8pt; 
          text-align: right; 
          margin-top: 1mm; 
          border-top: 1px solid #ccc; 
          padding-top: 0.5mm;
        ">
          ${order.supplier || ''}
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Label Print - ${item.description || item.article_code}</title>
            <style>
              @page {
                size: 89mm 35mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                width: 89mm;
              }
            </style>
          </head>
          <body>
            ${labelContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }

    toast({
      title: "Label Sent to Printer",
      description: `Label for "${item.description || item.article_code}" sent to printer`,
    });
  };

  const getBackgroundColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-100 border-green-300';
      case 'orange':
        return 'bg-orange-100 border-orange-300';
      case 'red':
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };
  const getColorClass = (color: string) => {
    switch (color) {
      case 'green':
        return 'text-green-600 fill-green-600';
      case 'orange':
        return 'text-orange-600 fill-orange-600';
      case 'red':
        return 'text-red-600 fill-red-600';
      default:
        return 'text-gray-400 fill-gray-400';
    }
  };
  const ColorButton: React.FC<{
    color: 'none' | 'green' | 'orange' | 'red';
    isActive: boolean;
    onClick: () => void;
  }> = ({
    color,
    isActive,
    onClick
  }) => {
    const colorClasses = {
      none: 'text-gray-400 hover:text-gray-600',
      green: 'text-green-600 hover:text-green-700',
      orange: 'text-orange-600 hover:text-orange-700',
      red: 'text-red-600 hover:text-red-700'
    };
    return <Button variant="ghost" size="sm" onClick={onClick} className={`p-1 h-8 w-8 ${colorClasses[color]} ${isActive ? 'bg-muted' : ''}`}>
        <Circle className={`h-4 w-4 ${isActive ? 'fill-current' : ''}`} />
      </Button>;
  };
  const getStatusCounts = () => {
    return {
      total: parts.length,
      none: parts.filter(p => p.color_status === 'none').length,
      green: parts.filter(p => p.color_status === 'green').length,
      orange: parts.filter(p => p.color_status === 'orange').length,
      red: parts.filter(p => p.color_status === 'red').length
    };
  };
  const filteredParts = parts.filter(part => {
    const matchesStatus = partsFilters.status === 'all' || part.color_status === partsFilters.status;
    const matchesMaterial = partsFilters.materiaal === '' || (part.materiaal || '').toLowerCase().includes(partsFilters.materiaal.toLowerCase());
    const matchesDikte = partsFilters.dikte === '' || (part.dikte || '').toLowerCase().includes(partsFilters.dikte.toLowerCase());
    const matchesAfmetingen = partsFilters.afmetingen === '' || (part.lengte && part.breedte ? `${part.lengte} x ${part.breedte}` : part.lengte || part.breedte || '').toLowerCase().includes(partsFilters.afmetingen.toLowerCase());
    const matchesAantal = partsFilters.aantal === '' || (part.aantal?.toString() || '').includes(partsFilters.aantal);
    const matchesWandNaam = partsFilters.wand_naam === '' || (part.wand_naam || '').toLowerCase().includes(partsFilters.wand_naam.toLowerCase());
    const matchesWorkstationStatus = partsFilters.workstation_name_status === '' || (part.workstation_name_status || '').toLowerCase().includes(partsFilters.workstation_name_status.toLowerCase());
    const matchesCommentaar = partsFilters.commentaar === '' || (part.commentaar || part.commentaar_2 || '').toLowerCase().includes(partsFilters.commentaar.toLowerCase());
    return matchesStatus && matchesMaterial && matchesDikte && matchesAfmetingen && matchesAantal && matchesWandNaam && matchesWorkstationStatus && matchesCommentaar;
  });
  const updatePartsFilter = (key: string, value: string) => {
    setPartsFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  const clearAllFilters = () => {
    setPartsFilters({
      materiaal: '',
      dikte: '',
      afmetingen: '',
      aantal: '',
      wand_naam: '',
      workstation_name_status: '',
      commentaar: '',
      status: 'all'
    });
  };
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (partsSortConfig && partsSortConfig.key === key && partsSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setPartsSortConfig({
      key,
      direction
    });
  };
  const sortedAndFilteredParts = React.useMemo(() => {
    let sortedParts = [...filteredParts];
    if (partsSortConfig) {
      sortedParts.sort((a, b) => {
        const {
          key,
          direction
        } = partsSortConfig;
        let aVal: any, bVal: any;
        switch (key) {
          case 'status':
            aVal = a.color_status;
            bVal = b.color_status;
            break;
          case 'afmetingen':
            aVal = a.lengte && a.breedte ? `${a.lengte} x ${a.breedte}` : a.lengte || a.breedte || '';
            bVal = b.lengte && b.breedte ? `${b.lengte} x ${b.breedte}` : b.lengte || b.breedte || '';
            break;
          case 'aantal':
            aVal = a.aantal || 0;
            bVal = b.aantal || 0;
            break;
          case 'commentaar':
            aVal = a.commentaar || a.commentaar_2 || '';
            bVal = b.commentaar || b.commentaar_2 || '';
            break;
          default:
            aVal = (a as any)[key] || '';
            bVal = (b as any)[key] || '';
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortedParts;
  }, [filteredParts, partsSortConfig]);
  const checkAndUpdateLimitPhases = async (completedTaskId?: string) => {
    if (!projectId) return;
    try {
      const {
        data: holdTasks,
        error: holdError
      } = await supabase.from('tasks').select(`
          *,
          phases!inner(project_id)
        `).eq('phases.project_id', projectId).eq('status', 'HOLD').not('standard_task_id', 'is', null);
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
            const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(holdTask.standard_task_id, projectId);
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
          await supabase.from('tasks').update({
            status: 'TODO',
            status_changed_at: new Date().toISOString()
          }).eq('id', task.id);
        }
        toast({
          title: t('tasks_updated'),
          description: t('tasks_updated_desc', {
            count: tasksToUpdate.length.toString()
          })
        });
      }
    } catch (error) {
      console.error('Error in checkAndUpdateLimitPhases:', error);
    }
  };
  const checkLimitPhasesBeforeStart = async (taskId: string, standardTaskId?: string): Promise<boolean> => {
    if (!projectId || !standardTaskId) return true;
    try {
      const limitPhasesSatisfied = await standardTasksService.checkLimitPhasesCompleted(standardTaskId, projectId);
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
          description: t('task_started_desc')
        });
      } else if (statusValue === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId, currentEmployee.id);
        toast({
          title: t('task_completed'),
          description: t('task_completed_desc')
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
          description: t('task_updated_desc', {
            status: newStatus
          })
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
        description: t('task_status_update_error', {
          message: error.message
        }),
        variant: "destructive"
      });
    }
  };
  const handleNewOrderSuccess = () => {
    toast({
      title: t('success'),
      description: t('order_created_successfully')
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
      await projectService.update(projectId, {
        description: editedDescription
      });
      setProject({
        ...project,
        description: editedDescription
      });
      setIsEditingDescription(false);
      toast({
        title: t('success'),
        description: t('project_updated_successfully')
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_update_project', {
          message: error.message
        }),
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
      setOrderItems(prev => ({
        ...prev,
        [orderId]: items
      }));
    } catch (error) {
      console.error('Error loading order items:', error);
    }
  };
  const loadOrderAttachments = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({
        ...prev,
        [orderId]: attachments
      }));
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
        description: t('order_status_updated')
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleChargeInTruck = async (orderId: string) => {
    try {
      // Get all order items
      const items = await orderService.getOrderItems(orderId);
      
      // Clear stock location for all items
      for (const item of items) {
        await orderService.updateOrderItem(item.id, { stock_location: null });
      }
      
      // Update order status to charged
      await orderService.updateOrderStatus(orderId, 'charged' as any);
      
      // Refresh orders
      const updatedOrders = await orderService.getByProject(projectId!);
      setOrders(updatedOrders);
      
      // Reload order items for this order
      loadOrderItems(orderId);
      
      toast({
        title: t('success'),
        description: 'Order charged in truck and locations cleared'
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
        description: t('order_deleted_successfully')
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
    return <div className="flex min-h-screen bg-background">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`w-full flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
          </div>
        </div>
      </div>;
  }
  if (!project) {
    return <div className="flex min-h-screen">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`w-full p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
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
      </div>;
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
    const base = "rounded-lg text-[11px] sm:text-xs font-semibold px-2.5 py-1";
    switch (status.toLowerCase()) {
      case 'planned':
        return <Badge className={cn(base, "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800")}>{t('status_planned')}</Badge>;
      case 'in_progress':
        return <Badge className={cn(base, "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800")}>{t('in_progress')}</Badge>;
      case 'completed':
        return <Badge className={cn(base, "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-800")}>{t('completed')}</Badge>;
      case 'on_hold':
        return <Badge className={cn(base, "bg-muted text-muted-foreground border-border")}>{t('status_on_hold')}</Badge>;
      default:
        return <Badge className={cn(base)}>{status}</Badge>;
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
      case 'charged':
        return 'bg-purple-100 text-purple-800 border-purple-300';
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
      case 'charged':
        return <Package className="h-4 w-4 text-purple-600" />;
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
  
  console.log('Task filtering results:');
  console.log('- Total tasks:', tasks.length);
  console.log('- TODO tasks:', todoTasks.length);
  console.log('- HOLD tasks:', holdTasks.length);
  console.log('- IN_PROGRESS tasks:', inProgressTasks.length);
  console.log('- COMPLETED tasks:', completedTasks.length);
  console.log('- Open tasks:', openTasks.length);
  const openOrdersCount = orders.filter(order => order.status === 'pending').length;
  const undeliveredOrdersCount = orders.filter(order => order.status !== 'delivered').length;
  const allOrdersDelivered = orders.length > 0 && undeliveredOrdersCount === 0;
  const unavailableAccessoriesCount = accessories.filter(acc => acc.status === 'to_order' || acc.status === 'ordered').length;
  const inStockAccessoriesCount = accessories.filter(acc => acc.status === 'in_stock').length;
  const deliveredAccessoriesCount = accessories.filter(acc => acc.status === 'delivered').length;
  const semiFinishedOrders = orders.filter(order => order.order_type === 'semi-finished');
  
  // Calculate count of undelivered items from pending/delayed/partially delivered orders
  const undeliveredItemsCount = orders
    .filter(order => ['pending', 'delayed', 'partially_delivered'].includes(order.status))
    .reduce((total, order) => {
      const items = orderItems[order.id] || [];
      const undeliveredItems = items.filter(item => 
        (item.quantity || 0) > (item.delivered_quantity || 0)
      );
      return total + undeliveredItems.length;
  }, 0);

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(createLocalizedPath('/projects'))} className="mb-3 sm:mb-4 h-8 text-xs sm:text-sm rounded-xl hover:bg-muted/60 -ml-2">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> {t('back_to_projects')}
            </Button>
            
            <div className="flex flex-col gap-3 sm:gap-4">
              <div>
                <h1 className={`font-bold tracking-tight ${isMobile ? 'text-lg leading-tight' : 'text-2xl'}`}>{project?.name}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{t('client_label')}: {project?.client}</p>
              </div>
              
              <div className="flex flex-wrap gap-1 sm:gap-1.5 pb-1.5">
                <Button size="sm" variant={activeTab === 'home' ? 'default' : 'ghost'} onClick={() => setActiveTab('home')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'home' && 'text-muted-foreground hover:text-foreground')}>
                  <Home className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('home')}
                </Button>
                <Button size="sm" variant={activeTab === 'orders' ? 'default' : 'ghost'} onClick={() => setActiveTab('orders')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab === 'orders' ? '' : undeliveredItemsCount > 0 ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400" : allOrdersDelivered ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400" : "text-muted-foreground hover:text-foreground")}>
                  <Package className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> 
                  {t('orders')}
                  {undeliveredItemsCount > 0 && <span className="ml-1 bg-red-500 text-white px-1 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold leading-none min-w-[16px] text-center">
                      {undeliveredItemsCount}
                    </span>}
                </Button>
                <Button size="sm" variant={activeTab === 'parts' ? 'default' : 'ghost'} onClick={() => setActiveTab('parts')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'parts' && 'text-muted-foreground hover:text-foreground')}>
                  <List className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('parts_list')}
                </Button>
                <Button size="sm" variant={activeTab === 'accessories' ? 'default' : 'ghost'} onClick={() => setActiveTab('accessories')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'accessories' && 'text-muted-foreground hover:text-foreground')}>
                  <Settings className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('accessories')}
                </Button>
                <Button size="sm" variant={activeTab === 'chat' ? 'default' : 'ghost'} onClick={() => setActiveTab('chat')} className={cn("relative h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'chat' && 'text-muted-foreground hover:text-foreground')}>
                  <MessageCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> 
                  Chat
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold leading-none">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Button>
                <Button size="sm" variant={activeTab === 'files' ? 'default' : 'ghost'} onClick={() => setActiveTab('files')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'files' && 'text-muted-foreground hover:text-foreground')}>
                  <FileText className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('files')}
                </Button>
                <Button size="sm" variant={activeTab === 'aftersales' ? 'default' : 'ghost'} onClick={() => setActiveTab('aftersales')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'aftersales' && 'text-muted-foreground hover:text-foreground')}>
                  <HeadphonesIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('as_tab_label')}
                </Button>
                <Button size="sm" variant={activeTab === 'onedrive' ? 'default' : 'ghost'} onClick={() => setActiveTab('onedrive')} className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'onedrive' && 'text-muted-foreground hover:text-foreground')}>
                  <Folder className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('onedrive')}
                </Button>
                  {['admin', 'manager', 'measurer'].includes(currentEmployee?.role) && (
                    <Button
                      size="sm"
                      variant={activeTab === 'measurement' ? 'default' : 'ghost'}
                      onClick={() => setActiveTab('measurement')}
                      className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'measurement' && 'text-muted-foreground hover:text-foreground')}
                    >
                      <Calendar className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Measurement
                    </Button>
                  )}
                  {['admin', 'manager', 'calculator'].includes(currentEmployee?.role) && (
                    <Button
                      size="sm"
                      variant={activeTab === 'costing' ? 'default' : 'ghost'}
                      onClick={() => setActiveTab('costing')}
                      className={cn("h-7 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 rounded-full", activeTab !== 'costing' && 'text-muted-foreground hover:text-foreground')}
                    >
                      <DollarSign className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Costing
                    </Button>
                  )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {[
              { value: openTasks.length, label: t('open_tasks'), accent: 'text-orange-600 dark:text-orange-400' },
              { value: getTaskCountByStatus('IN_PROGRESS'), label: t('in_progress'), accent: 'text-blue-600 dark:text-blue-400' },
              { value: getTaskCountByStatus('COMPLETED'), label: t('completed'), accent: 'text-green-600 dark:text-green-400' },
              { value: tasks.length, label: t('total_tasks'), accent: 'text-foreground' },
            ].map((stat, i) => (
              <Card key={i} className="rounded-2xl border-border/60 py-0 overflow-hidden">
                <CardContent className="pt-3 sm:pt-4 pb-2.5 sm:pb-3.5 px-3 sm:px-5">
                  <div className={cn("text-xl sm:text-2xl font-bold tabular-nums", stat.accent)}>{stat.value}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {activeTab === 'files' ? <ProjectFileManager projectId={projectId!} /> : activeTab === 'onedrive' ? <OneDriveIntegration projectId={projectId!} projectName={project?.name || ''} /> : activeTab === 'aftersales' ? <AfterSalesTab projectId={projectId!} projectName={project?.name || ''} /> : activeTab === 'chat' ? <ProjectChatInline projectId={projectId!} projectName={project?.name || ''} onUnreadCountChange={setUnreadChatCount} /> : activeTab === 'parts' ? <div className="space-y-4">
              {partsLists.length > 0 ? <div className="space-y-4">
                  {/* Parts List Management Header */}
                  <Card>
                    <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                          <span className="truncate">{partsLists[0].file_name}</span>
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => handleDeletePartsList(partsLists[0].id)} className="text-destructive hover:text-destructive h-7 sm:h-8 text-xs self-end sm:self-auto">
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5 p-1.5 sm:p-0 rounded-md bg-muted/50 sm:bg-transparent">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-muted border border-border rounded flex-shrink-0"></div>
                          <span className="text-muted-foreground">Unprocessed: <span className="font-semibold text-foreground">{getStatusCounts().none}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1.5 sm:p-0 rounded-md bg-green-500/5 sm:bg-transparent">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-300 rounded flex-shrink-0"></div>
                          <span className="text-muted-foreground">Complete: <span className="font-semibold text-green-700">{getStatusCounts().green}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1.5 sm:p-0 rounded-md bg-orange-500/5 sm:bg-transparent">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-100 border border-orange-300 rounded flex-shrink-0"></div>
                          <span className="text-muted-foreground">In Progress: <span className="font-semibold text-orange-700">{getStatusCounts().orange}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1.5 sm:p-0 rounded-md bg-red-500/5 sm:bg-transparent">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-100 border border-red-300 rounded flex-shrink-0"></div>
                          <span className="text-muted-foreground">Issues: <span className="font-semibold text-red-700">{getStatusCounts().red}</span></span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Parts List Table */}
                  <Card>
                    <CardContent className="p-0">
                      {loadingParts ? <div className="flex justify-center items-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div> : parts.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                          No parts found in this list
                        </div> : <div>
                           {/* Filter Controls */}
                           <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b">
                             <div className="text-xs sm:text-sm text-muted-foreground">
                               {sortedAndFilteredParts.length} / {parts.length} parts
                             </div>
                             <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-7 sm:h-8 text-xs">
                               Clear Filters
                             </Button>
                           </div>

                           {/* Mobile Filter Row */}
                           <div className="sm:hidden px-3 py-2 border-b space-y-2">
                             <div className="grid grid-cols-2 gap-2">
                               <Select value={partsFilters.status} onValueChange={value => updatePartsFilter('status', value)}>
                                 <SelectTrigger className="h-7 text-xs">
                                   <SelectValue placeholder="Status" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="all">All Status</SelectItem>
                                   <SelectItem value="none">Unprocessed</SelectItem>
                                   <SelectItem value="green">Complete</SelectItem>
                                   <SelectItem value="orange">In Progress</SelectItem>
                                   <SelectItem value="red">Issues</SelectItem>
                                 </SelectContent>
                               </Select>
                               <Input placeholder="Materiaal..." value={partsFilters.materiaal} onChange={e => updatePartsFilter('materiaal', e.target.value)} className="h-7 text-xs" />
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               <Input placeholder="Wand Naam..." value={partsFilters.wand_naam} onChange={e => updatePartsFilter('wand_naam', e.target.value)} className="h-7 text-xs" />
                               <Input placeholder="Commentaar..." value={partsFilters.commentaar} onChange={e => updatePartsFilter('commentaar', e.target.value)} className="h-7 text-xs" />
                             </div>
                           </div>

                           {/* Mobile Card Layout */}
                           <div className="sm:hidden">
                             <ScrollArea className="h-[70vh]">
                               <div className="divide-y">
                                 {sortedAndFilteredParts.map(part => (
                                   <div
                                     key={part.id}
                                     className={`p-3 ${getBackgroundColor(part.color_status)} active:bg-muted/60 transition-colors`}
                                     onClick={() => {
                                       setSelectedPart(part);
                                       setShowPartDetailDialog(true);
                                     }}
                                   >
                                     <div className="flex items-start justify-between gap-2 mb-1.5">
                                       <div className="flex-1 min-w-0">
                                         <p className="text-xs font-semibold text-foreground truncate">{part.wand_naam || '-'}</p>
                                         <p className="text-[11px] text-muted-foreground truncate">{part.materiaal || '-'}</p>
                                       </div>
                                       <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                         <ColorButton color="none" isActive={part.color_status === 'none'} onClick={() => updatePartColor(part.id, 'none')} />
                                         <ColorButton color="green" isActive={part.color_status === 'green'} onClick={() => updatePartColor(part.id, 'green')} />
                                         <ColorButton color="orange" isActive={part.color_status === 'orange'} onClick={() => updatePartColor(part.id, 'orange')} />
                                         <ColorButton color="red" isActive={part.color_status === 'red'} onClick={() => updatePartColor(part.id, 'red')} />
                                       </div>
                                     </div>
                                     <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                       <span className="font-medium">{part.dikte || '-'}mm</span>
                                       <span>{part.lengte && part.breedte ? `${part.lengte}×${part.breedte}` : part.lengte || part.breedte || '-'}</span>
                                       <span>×{part.aantal || '-'}</span>
                                       {part.workstation_name_status && <span className="ml-auto truncate max-w-[80px]">{part.workstation_name_status}</span>}
                                     </div>
                                     {(part.commentaar || part.commentaar_2) && (
                                       <p className="text-[10px] text-muted-foreground mt-1 truncate">{part.commentaar || part.commentaar_2}</p>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             </ScrollArea>
                           </div>
                           
                           {/* Desktop Table Layout */}
                           <div className="hidden sm:block">
                           <ScrollArea className="h-[80vh]">
                             <Table>
                               <TableHeader>
                                 <TableRow>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('status')}>
                                     <div className="flex items-center gap-2">
                                       Status
                                       {partsSortConfig?.key === 'status' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('materiaal')}>
                                     <div className="flex items-center gap-2">
                                       Materiaal
                                       {partsSortConfig?.key === 'materiaal' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('dikte')}>
                                     <div className="flex items-center gap-2">
                                       Dikte
                                       {partsSortConfig?.key === 'dikte' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('afmetingen')}>
                                     <div className="flex items-center gap-2">
                                       Afmetingen
                                       {partsSortConfig?.key === 'afmetingen' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('aantal')}>
                                     <div className="flex items-center gap-2">
                                       Aantal
                                       {partsSortConfig?.key === 'aantal' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('wand_naam')}>
                                     <div className="flex items-center gap-2">
                                       Wand Naam
                                       {partsSortConfig?.key === 'wand_naam' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('workstation_name_status')}>
                                      <div className="flex items-center gap-2">
                                        Workstation Status
                                        {partsSortConfig?.key === 'workstation_name_status' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                      </div>
                                    </TableHead>
                                   <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('commentaar')}>
                                     <div className="flex items-center gap-2">
                                       Commentaar
                                       {partsSortConfig?.key === 'commentaar' ? partsSortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                                     </div>
                                   </TableHead>
                                 </TableRow>
                                <TableRow>
                                  <TableHead className="p-2">
                                    <Select value={partsFilters.status} onValueChange={value => updatePartsFilter('status', value)}>
                                      <SelectTrigger className="h-8 w-full">
                                        <SelectValue placeholder="All" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="none">Unprocessed</SelectItem>
                                        <SelectItem value="green">Complete</SelectItem>
                                        <SelectItem value="orange">In Progress</SelectItem>
                                        <SelectItem value="red">Issues</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.materiaal} onChange={e => updatePartsFilter('materiaal', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.dikte} onChange={e => updatePartsFilter('dikte', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.afmetingen} onChange={e => updatePartsFilter('afmetingen', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.aantal} onChange={e => updatePartsFilter('aantal', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.wand_naam} onChange={e => updatePartsFilter('wand_naam', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                   <TableHead className="p-2">
                                     <Input placeholder="Filter..." value={partsFilters.workstation_name_status || ''} onChange={e => updatePartsFilter('workstation_name_status', e.target.value)} className="h-8 w-full" />
                                   </TableHead>
                                  <TableHead className="p-2">
                                    <Input placeholder="Filter..." value={partsFilters.commentaar} onChange={e => updatePartsFilter('commentaar', e.target.value)} className="h-8 w-full" />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                               <TableBody>
                                 {sortedAndFilteredParts.map(part => <TableRow 
                                   key={part.id} 
                                   className={`border ${getBackgroundColor(part.color_status)} cursor-pointer hover:bg-muted/80`}
                                   onClick={() => {
                                     setSelectedPart(part);
                                     setShowPartDetailDialog(true);
                                   }}
                                 >
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1">
                                      <Circle className={`h-4 w-4 ${getColorClass(part.color_status)}`} />
                                      <div className="flex gap-1 ml-2">
                                        <ColorButton color="none" isActive={part.color_status === 'none'} onClick={() => updatePartColor(part.id, 'none')} />
                                        <ColorButton color="green" isActive={part.color_status === 'green'} onClick={() => updatePartColor(part.id, 'green')} />
                                        <ColorButton color="orange" isActive={part.color_status === 'orange'} onClick={() => updatePartColor(part.id, 'orange')} />
                                        <ColorButton color="red" isActive={part.color_status === 'red'} onClick={() => updatePartColor(part.id, 'red')} />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{part.materiaal || '-'}</TableCell>
                                  <TableCell>{part.dikte || '-'}</TableCell>
                                  <TableCell>
                                    {part.lengte && part.breedte ? `${part.lengte} x ${part.breedte}` : part.lengte || part.breedte || '-'}
                                  </TableCell>
                                  <TableCell>{part.aantal || '-'}</TableCell>
                                   <TableCell>{part.wand_naam || '-'}</TableCell>
                                   <TableCell>{part.workstation_name_status || '-'}</TableCell>
                                   <TableCell>
                                    <div className="max-w-32 truncate" title={part.commentaar || part.commentaar_2 || ''}>
                                      {part.commentaar || part.commentaar_2 || '-'}
                                    </div>
                                  </TableCell>
                                </TableRow>)}
                             </TableBody>
                          </Table>
                        </ScrollArea>
                        </div>
                        </div>}
                    </CardContent>
                  </Card>
                </div> : <Card>
                  <CardHeader>
                    <CardTitle>Parts List Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground space-y-4">
                      <FileText className="h-12 w-12 mx-auto opacity-50" />
                      <div>
                        <p>No parts lists found for this project</p>
                        <p className="text-sm">Import a CSV file to get started</p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <PartsListImporter projectId={projectId!} onImportComplete={() => {
                  setRefreshPartsKey(prev => prev + 1);
                  toast({
                    title: t('success'),
                    description: t('parts_list_imported_successfully')
                  });
                }} />
                    </div>
                  </CardContent>
                </Card>}
            </div> : activeTab === 'orders' ? <Card className="overflow-hidden">
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-2xl">{t('orders')}</CardTitle>
                  <Button onClick={() => setShowNewOrderModal(true)} size="sm" className="h-8 text-xs sm:text-sm">
                    <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {t('add_order')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-4">
                  {orders.length === 0 ? <div className="text-center py-8">
                      <p className="text-muted-foreground">{t('no_orders_found')}</p>
                    </div> : <div className="space-y-3">
                      {orders.map(order => {
                  // Load order items and attachments immediately for each order
                  if (!orderItems[order.id]) {
                    loadOrderItems(order.id);
                  }
                  if (!orderAttachments[order.id]) {
                    loadOrderAttachments(order.id);
                  }
                  return <div key={order.id} className={cn("border rounded-lg p-2.5 sm:p-3 transition-all duration-200", order.status === 'delivered' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : order.status === 'delayed' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : order.status === 'pending' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' : order.status === 'charged' ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800' : 'bg-card border-border')}>
                            {/* Compact Order Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 mb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="font-semibold text-sm sm:text-base truncate">{order.supplier}</h4>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {getStatusIcon(order.status)}
                                  <Badge className={cn("text-[10px] sm:text-xs h-5", getStatusColor(order.status))}>
                                    {order.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-1">
                                <Select value={order.status} onValueChange={value => handleStatusChange(order.id, value)}>
                                  <SelectTrigger className="w-24 sm:w-28 h-7 text-[10px] sm:text-xs bg-background border z-50">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50">
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="canceled">Canceled</SelectItem>
                                    <SelectItem value="delayed">Delayed</SelectItem>
                                    <SelectItem value="charged">Charged</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleChargeInTruck(order.id)}
                                  className="h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-purple-50"
                                  title="Charge in truck"
                                >
                                  <Package className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Charged in Truck</span>
                                </Button>

                                <Button size="sm" variant="outline" onClick={() => handleEditOrder(order.id)} className="h-7 w-7 p-0 hover:bg-blue-50" title="Edit order">
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                
                                <Button size="sm" variant="outline" onClick={() => handleDeleteOrder(order.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-red-50" title="Delete order">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Compact Order Info with Enhanced Delivery Date */}
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs mb-2">
                              <div className={cn("flex items-center gap-1 p-2 rounded border", order.status === 'delivered' ? 'bg-green-50 border-green-200' : order.status === 'pending' ? 'bg-orange-50 border-orange-200' : order.status === 'delayed' ? 'bg-red-50 border-red-200' : order.status === 'canceled' ? 'bg-gray-50 border-gray-200' : order.status === 'charged' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200')}>
                                <Calendar className={cn("h-3 w-3", order.status === 'delivered' ? 'text-green-600' : order.status === 'pending' ? 'text-orange-600' : order.status === 'delayed' ? 'text-red-600' : order.status === 'canceled' ? 'text-gray-600' : order.status === 'charged' ? 'text-purple-600' : 'text-blue-600')} />
                                <div>
                                  <div className={cn("font-medium text-xs", order.status === 'delivered' ? 'text-green-600' : order.status === 'pending' ? 'text-orange-600' : order.status === 'delayed' ? 'text-red-600' : order.status === 'canceled' ? 'text-gray-600' : order.status === 'charged' ? 'text-purple-600' : 'text-blue-600')}>Expected</div>
                                  <div className={cn("font-semibold", order.status === 'delivered' ? 'text-green-800' : order.status === 'pending' ? 'text-orange-800' : order.status === 'delayed' ? 'text-red-800' : order.status === 'canceled' ? 'text-gray-800' : order.status === 'charged' ? 'text-purple-800' : 'text-blue-800')}>
                                    {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'No date'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <span className="capitalize">{order.order_type.replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Compact Notes */}
                            {order.notes && <div className="bg-blue-50 border-l-2 border-blue-200 p-2 mb-2 text-xs">
                                <span className="font-medium text-blue-800">Note:</span>
                                <span className="text-blue-700 ml-1">"{order.notes}"</span>
                              </div>}

                            {/* Compact Camera and File Actions */}
                            <div className="flex items-center justify-between mb-2 p-2 bg-muted/20 rounded">
                              <span className="text-xs font-medium">Actions:</span>
                              <OrderAttachmentUploader orderId={order.id} onUploadSuccess={() => loadOrderAttachments(order.id)} compact={true} showDeliveryConfirm={order.status !== 'delivered'} onDeliveryConfirm={() => handleDeliveryConfirm(order.id)} />
                            </div>

                            {/* Always Visible Compact Order Items */}
                            {orderItems[order.id] && orderItems[order.id].length > 0 && <div className="mb-2">
                                <div className="flex items-center gap-1 mb-1">
                                  <Package className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] sm:text-xs font-medium">{t('order_items')} ({orderItems[order.id].length})</span>
                                </div>
                                <div className={cn("border rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2", order.status === 'delivered' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : order.status === 'pending' ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' : order.status === 'delayed' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200' : order.status === 'canceled' ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200')}>
                                  {orderItems[order.id].map((item: any) => <div key={item.id} className={cn("flex justify-between items-start sm:items-center bg-white/80 backdrop-blur-sm rounded-md p-2 shadow-sm border gap-2", order.status === 'delivered' ? 'border-green-100' : order.status === 'pending' ? 'border-orange-100' : order.status === 'delayed' ? 'border-red-100' : order.status === 'canceled' ? 'border-gray-100' : 'border-blue-100')}>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-xs sm:text-sm text-gray-800 line-clamp-2">{item.description}</span>
                                        {item.article_code && <div className={cn("text-[10px] sm:text-xs font-medium mt-0.5", order.status === 'delivered' ? 'text-green-700' : order.status === 'pending' ? 'text-orange-700' : order.status === 'delayed' ? 'text-red-700' : order.status === 'canceled' ? 'text-gray-700' : 'text-blue-700')}>
                                            Article: {item.article_code}
                                          </div>}
                                        {order.status === 'delivered' && item.stock_location && <div className="text-[10px] sm:text-xs font-semibold text-green-800 mt-0.5 flex items-center gap-1">
                                            <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                            Location: {item.stock_location}
                                          </div>}
                                        {item.notes && <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 italic line-clamp-2">
                                            Note: {item.notes}
                                          </div>}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            printItemLabel(item, order);
                                          }}
                                          title="Print label"
                                        >
                                          <Printer className="h-3 w-3" />
                                        </Button>
                                        <span className={cn("text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm whitespace-nowrap", order.status === 'delivered' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : order.status === 'pending' ? 'bg-gradient-to-r from-orange-500 to-amber-500' : order.status === 'delayed' ? 'bg-gradient-to-r from-red-500 to-rose-500' : order.status === 'canceled' ? 'bg-gradient-to-r from-gray-500 to-slate-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500')}>
                                          {item.delivered_quantity || 0}/{item.quantity}
                                        </span>
                                      </div>
                                    </div>)}
                                </div>
                              </div>}

                            {/* Always Visible Compact Attachments */}
                            {orderAttachments[order.id] && orderAttachments[order.id].length > 0 && <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Paperclip className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-medium">{t('attachments')} ({orderAttachments[order.id].length})</span>
                                </div>
                                <div className="space-y-1">
                                  {orderAttachments[order.id].map((attachment: any) => <div key={attachment.id} className="flex items-center justify-between bg-background rounded p-2 border text-xs">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={cn("p-1 rounded", attachment.file_name.includes('DELIVERY_CONFIRMED') ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                                          {attachment.file_name.includes('DELIVERY_CONFIRMED') ? <CheckCircle className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate">{attachment.file_name}</p>
                                          {attachment.file_name.includes('DELIVERY_CONFIRMED') && <p className="text-green-600 font-medium">✓ Delivery Confirmed</p>}
                                        </div>
                                      </div>
                                      <Button size="sm" variant="outline" onClick={() => window.open(orderService.getAttachmentUrl(attachment.file_path), '_blank')} className="h-6 w-12 text-xs p-0">
                                        View
                                      </Button>
                                    </div>)}
                                </div>
                              </div>}
                          </div>;
                })}
                    </div>}
                </div>
              </CardContent>
            </Card> : activeTab === 'accessories' ? <AccessoriesInlineView projectId={projectId!} /> : activeTab === 'costing' ? <ProjectCostingTab projectId={projectId!} /> : <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
              <Card className="lg:col-span-1 overflow-hidden">
                <CardHeader className="py-3 sm:py-[15px] px-3 sm:px-6">
                  <CardTitle className="text-base sm:text-2xl">{t('project_summary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-5">
                  {/* Important Dates - Moved to top */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-medium mb-1.5">{t('important_dates')}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 sm:gap-2">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-muted/40 rounded-lg p-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{t('start_date_label')}</div>
                          <div className="font-medium truncate text-xs sm:text-sm">{project?.start_date && formatDate(project.start_date)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-muted/40 rounded-lg p-2">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{t('installation_date_label')}</div>
                          <div className="font-medium truncate text-xs sm:text-sm">{project?.installation_date && formatDate(project.installation_date)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Installation Team Assignment */}
                  {(() => {
                    // Get the main installation team (non-service ticket)
                    const mainAssignment = projectTeamAssignments?.find((a: any) => !a.is_service_ticket);
                    if (!mainAssignment) return null;
                    const team = mainAssignment.placement_teams;
                    return (
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1.5">{t('installation_team') || 'Installation Team'}</h4>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-muted/40 rounded-lg p-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: team?.color || '#6b7280' }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate text-xs sm:text-sm">{team?.name || t('not_assigned')}</div>
                            {mainAssignment.start_date && (
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {formatDate(mainAssignment.start_date)} • {mainAssignment.duration} {t('days') || 'days'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Service Tickets */}
                  {(() => {
                    const serviceTickets = projectTeamAssignments?.filter((a: any) => a.is_service_ticket) || [];
                    if (serviceTickets.length === 0) return null;
                    return (
                      <div>
                        <h4 className="text-xs sm:text-sm font-medium mb-1.5">
                          {t('service_tickets') || 'Service Tickets'} ({serviceTickets.length})
                        </h4>
                        <div className="space-y-1.5">
                          {serviceTickets.map((ticket: any) => {
                            const team = ticket.placement_teams;
                            return (
                              <div key={ticket.id} className="flex items-center gap-1.5 text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: team?.color || '#f59e0b' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate text-xs sm:text-sm">{team?.name || t('service_team')}</div>
                                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                                    {ticket.start_date ? formatDate(ticket.start_date) : t('no_date')}
                                    {ticket.service_hours && ` • ${ticket.service_hours}h`}
                                    {ticket.fixed_time && ` • ${ticket.fixed_time}`}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Status + Progress inline on mobile */}
                  <div className="flex items-center gap-3 sm:block sm:space-y-4">
                    <div className="flex-shrink-0">
                      <h4 className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{t('status')}</h4>
                      <div>{project && getStatusBadge(project.status)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{t('project_progress')}</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">{t('completion')}</span>
                          <span className="font-medium">{project?.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{
                        width: `${project?.progress}%`
                      }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <h4 className="text-xs sm:text-sm font-medium">{t('description') || 'Description'}</h4>
                      {!isEditingDescription && <Button variant="ghost" size="sm" onClick={handleEditDescription} className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>}
                    </div>
                    {isEditingDescription ? <div className="space-y-2">
                        <Textarea value={editedDescription} onChange={e => setEditedDescription(e.target.value)} placeholder={t('enter_project_description') || 'Enter project description...'} className="min-h-[80px] resize-none text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveDescription} disabled={savingDescription}>
                            <Save className="h-3 w-3 mr-1" />
                            {savingDescription ? t('saving') || 'Saving...' : t('save') || 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEditDescription} disabled={savingDescription}>
                            <X className="h-3 w-3 mr-1" />
                            {t('cancel') || 'Cancel'}
                          </Button>
                        </div>
                      </div> : <div className="text-xs sm:text-sm text-muted-foreground">
                        {project?.description || t('no_description') || 'No description added yet.'}
                      </div>}
                  </div>

                  {projectEfficiency !== null && <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      {projectEfficiency >= 0 ? <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" /> : <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />}
                      <span className={`font-semibold text-sm ${projectEfficiency >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {projectEfficiency >= 0 ? '+' : ''}{projectEfficiency}%
                      </span>
                      <span className="text-[11px] sm:text-xs text-muted-foreground">
                        {projectEfficiency >= 0 ? t('efficiency_faster') || 'faster than planned' : t('efficiency_slower') || 'slower than planned'}
                      </span>
                    </div>}

                  <Button variant="outline" size="sm" onClick={() => setShowBarcodeDialog(true)} className="w-full h-8 text-xs sm:text-sm">
                    <Barcode className="mr-2 h-3.5 w-3.5" />
                    {t('view_barcode')}
                  </Button>

                  <div>
                    <h4 className="text-xs sm:text-sm font-medium mb-1.5">{t('orders_and_accessories')}</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-2 gap-1.5 sm:gap-2 text-center sm:text-left">
                      <div className="bg-orange-50 dark:bg-orange-950/30 p-1.5 sm:p-2 rounded-lg">
                        <div className="font-bold text-sm sm:text-base text-orange-800 dark:text-orange-300">{openOrdersCount}</div>
                        <div className="text-orange-600 dark:text-orange-400 text-[10px] sm:text-xs leading-tight">{t('open_orders')}</div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/30 p-1.5 sm:p-2 rounded-lg">
                        <div className="font-bold text-sm sm:text-base text-red-800 dark:text-red-300">{unavailableAccessoriesCount}</div>
                        <div className="text-red-600 dark:text-red-400 text-[10px] sm:text-xs leading-tight">{t('to_order')}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/30 p-1.5 sm:p-2 rounded-lg">
                        <div className="font-bold text-sm sm:text-base text-green-800 dark:text-green-300">{inStockAccessoriesCount}</div>
                        <div className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs leading-tight">{t('in_stock')}</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 sm:p-2 rounded-lg">
                        <div className="font-bold text-sm sm:text-base text-blue-800 dark:text-blue-300">{deliveredAccessoriesCount}</div>
                        <div className="text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs leading-tight">{t('delivered')}</div>
                      </div>
                    </div>
                  </div>

                  {semiFinishedOrders.length > 0 && <div className="space-y-1.5">
                      <h4 className="text-xs sm:text-sm font-medium">{t('semi_finished_deliveries')}</h4>
                      <div className="space-y-1.5 text-xs sm:text-sm">
                        {semiFinishedOrders.map((order: any) => order.orderSteps && order.orderSteps.length > 0 && <div key={order.id} className="bg-muted/40 p-2 rounded-lg">
                              <p className="font-medium mb-1 text-xs sm:text-sm">{order.supplier}{t('main_order_suffix')}</p>
                              <div className="pl-2 space-y-0.5">
                                {order.orderSteps.filter((step: any) => step.supplier).map((step: any) => <div key={step.id} className="flex justify-between items-center text-[11px] sm:text-sm">
                                      <span className="text-muted-foreground truncate" title={`${step.name} (${step.supplier})`}>
                                        {step.name} ({step.supplier})
                                      </span>
                                      <span className="font-medium whitespace-nowrap ml-2">
                                        {step.end_date ? formatDate(step.end_date) : t('not_applicable')}
                                      </span>
                                    </div>)}
                              </div>
                            </div>)}
                      </div>
                    </div>}
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-2 overflow-hidden rounded-2xl border-border/60">
                <CardHeader className="py-3 sm:py-4 px-3 sm:px-5">
                  <CardTitle className="text-sm sm:text-base font-semibold">{t('project_tasks')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-5">
                  <Tabs defaultValue="todo">
                    <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto rounded-xl bg-muted/60 p-1">
                      <TabsTrigger value="todo" className="text-xs sm:text-sm flex-1 sm:flex-initial">{t('open_tasks_tab', {
                      count: openTasks.length.toString()
                    })}</TabsTrigger>
                      <TabsTrigger value="in_progress" className="text-xs sm:text-sm flex-1 sm:flex-initial">{t('in_progress_tab', {
                      count: inProgressTasks.length.toString()
                    })}</TabsTrigger>
                      <TabsTrigger value="completed" className="text-xs sm:text-sm flex-1 sm:flex-initial">{t('completed_tab', {
                      count: completedTasks.length.toString()
                    })}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="todo">
                      <TaskList tasks={openTasks} title={t('open_tasks_title')} onTaskStatusChange={handleTaskStatusChange} showCompleteButton={true} />
                    </TabsContent>
                    <TabsContent value="in_progress">
                      <TaskList tasks={inProgressTasks} title={t('in_progress_tasks_title')} onTaskStatusChange={handleTaskStatusChange} />
                    </TabsContent>
                    <TabsContent value="completed">
                      <TaskList tasks={completedTasks} title={t('completed_tasks_title')} onTaskStatusChange={handleTaskStatusChange} showEfficiencyData={true} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>}
        </div>
      </div>

      <NewOrderModal open={showNewOrderModal} onOpenChange={setShowNewOrderModal} projectId={projectId!} onSuccess={handleNewOrderSuccess} showAddOrderButton={true} accessories={accessories} installationDate={project?.installation_date} />



      <ProjectBarcodeDialog isOpen={showBarcodeDialog} onClose={() => setShowBarcodeDialog(false)} projectId={projectId!} projectName={project?.name || ''} />

      {selectedOrderId && <OrderEditModal open={showOrderEditModal} onOpenChange={setShowOrderEditModal} orderId={selectedOrderId} onSuccess={handleOrderEditSuccess} />}
      
      <PartDetailDialog 
        part={selectedPart} 
        open={showPartDetailDialog} 
        onOpenChange={setShowPartDetailDialog} 
      />
    </div>
  );
};
export default ProjectDetails;
