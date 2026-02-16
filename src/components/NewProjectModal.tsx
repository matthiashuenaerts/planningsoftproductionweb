import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { projectService, phaseService, taskService, Task } from '@/services/dataService';
import { workstationService } from '@/services/workstationService';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { productionRouteService, ProductionRoute } from '@/services/productionRouteService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from './ui/label';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';

// Add the missing interface
interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const formSchema = z.object({
  project_name: z.string().min(1, { message: 'Project name is required' }),
  client: z.string().min(1, { message: 'Client name is required' }),
  description: z.string().optional(),
  start_date: z.date({ required_error: 'Start date is required' }),
  installation_date: z.date({ required_error: 'Installation date is required' }),
  project_value: z.number()
    .min(1, { message: 'Project value must be at least 1' })
    .max(100, { message: 'Project value must be at most 100' }),
  is_after_sales: z.boolean(),
  project_link_id: z.string().optional()
}).refine(
  (data) => {
    return data.installation_date >= data.start_date;
  },
  {
    message: 'Installation date must be after start date',
    path: ['installation_date'],
  }
);

type FormValues = z.infer<typeof formSchema>;

interface TaskItem {
  id: string;
  name: string;
  workstation: string;
  selected?: boolean;
  task_number?: string;
  standard_task_id?: string;
  time_coefficient?: number;
  duration?: number;
  day_counter?: number;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedData, setSyncedData] = useState<any>(null);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingTeamAssignment, setPendingTeamAssignment] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskWorkstation, setNewTaskWorkstation] = useState('');
  const [workstations, setWorkstations] = useState<{id: string, name: string}[]>([]);
  const [projectCode, setProjectCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: '',
      client: '',
      description: '',
      start_date: new Date(),
      installation_date: new Date(),
      project_value: 50,
      is_after_sales: false,
      project_link_id: '',
    },
  });

  // Generate project code based on project type
  const generateProjectCode = async (isAfterSales: boolean) => {
    setIsGeneratingCode(true);
    try {
      const currentYear = new Date().getFullYear();
      const yearCode = currentYear.toString().slice(-2); // Last 2 digits of year
      const projectType = isAfterSales ? '11' : '10'; // 10 for normal, 11 for after-sales
      
      // Get the next sequential number for this project type
      const { data: existingProjects, error } = await supabase
        .from('projects')
        .select('name')
        .like('name', `${yearCode}${projectType}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching existing projects:', error);
        throw error;
      }

      let nextNumber = 1;
      
      if (existingProjects && existingProjects.length > 0) {
        // Extract the sequential numbers from existing project names
        const existingNumbers = existingProjects
          .map(project => {
            const match = project.name.match(new RegExp(`^${yearCode}${projectType}(\\d{3})`));
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(num => num > 0);
        
        if (existingNumbers.length > 0) {
          nextNumber = Math.max(...existingNumbers) + 1;
        }
      }

      const sequentialCode = nextNumber.toString().padStart(3, '0');
      const generatedCode = `${yearCode}${projectType}${sequentialCode}`;
      setProjectCode(generatedCode);
      
    } catch (error) {
      console.error('Error generating project code:', error);
      toast({
        title: "Error",
        description: "Failed to generate project code",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Generate project code when modal opens or project type changes
  useEffect(() => {
    if (open) {
      const isAfterSales = form.watch('is_after_sales');
      generateProjectCode(isAfterSales);
    }
  }, [open, form.watch('is_after_sales')]);

  // Fetch all workstations, standard tasks, and routes when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get all workstations and routes in parallel
        const [workstationData, routesData] = await Promise.all([
          workstationService.getAll(tenant?.id),
          productionRouteService.getAll(tenant?.id)
        ]);
        setWorkstations(workstationData.map(w => ({ id: w.id, name: w.name })));
        setRoutes(routesData);
        
        // Get all standard tasks with their linked workstations
        const standardTasks = await standardTasksService.getAll(tenant?.id);
        
        const taskItems: TaskItem[] = [];
        
        // For each standard task, get its linked workstations
        for (const task of standardTasks) {
          try {
            const links = await workstationService.getWorkstationsForStandardTask(task.id);
            const workstationName = links && links.length > 0 ? links[0].name : '';
            
            const projectValue = form.getValues('project_value') || 50;
            const duration = task.time_coefficient ? Math.round(task.time_coefficient * projectValue) : 60;
            
            taskItems.push({
              id: task.task_number,
              name: task.task_name,
              workstation: workstationName,
              selected: true,
              task_number: task.task_number,
              standard_task_id: task.id,
              time_coefficient: task.time_coefficient,
              duration: duration,
              day_counter: task.day_counter || 0
            });
          } catch (error) {
            console.error(`Error fetching workstation for task ${task.task_name}:`, error);
          }
        }
        
        setAllTasks(taskItems);
        setTasks(taskItems);
        setSelectedRouteId(''); // Reset route selection
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load standard tasks and workstations",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (open) {
      fetchData();
    }
  }, [open, toast]);

  // Handle route selection change
  const handleRouteChange = async (routeId: string) => {
    setSelectedRouteId(routeId);
    
    if (!routeId || routeId === 'all') {
      // Show all tasks when "All Tasks" is selected
      setTasks(allTasks.map(t => ({ ...t, selected: true })));
      return;
    }
    
    try {
      // Get the tasks for this route
      const routeTasks = await productionRouteService.getRouteTasks(routeId);
      const routeTaskIds = routeTasks.map(t => t.standard_task_id);
      
      // Filter to only show tasks that are in the route, and select them
      const filteredTasks = allTasks
        .filter(t => t.standard_task_id && routeTaskIds.includes(t.standard_task_id))
        .map(t => ({ ...t, selected: true }));
      
      setTasks(filteredTasks);
    } catch (error) {
      console.error('Error loading route tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load route tasks",
        variant: "destructive"
      });
    }
  };
  
  // Calculate task durations whenever project_value changes or when tasks are loaded/modified
  useEffect(() => {
    const projectValue = form.watch('project_value') || 50;
    
    // Update tasks with calculated durations
    setTasks(currentTasks => 
      currentTasks.map(task => ({
        ...task,
        duration: calculateTaskDuration(task, projectValue)
      }))
    );
  }, [form.watch('project_value'), tasks.length]);

  // Calculate task duration based on coefficient and project value
  const calculateTaskDuration = (task: TaskItem, projectValue: number): number => {
    if (!task.time_coefficient) return 60;
    return Math.round(task.time_coefficient * projectValue);
  };

  const handleAddCustomTask = () => {
    if (newTaskName.trim()) {
      const nextId = (tasks.length + 1).toString().padStart(2, '0');
      const projectValue = form.getValues('project_value') || 50;
      
      const newTask: TaskItem = { 
        id: nextId, 
        name: newTaskName.trim(), 
        workstation: newTaskWorkstation.trim(),
        selected: true,
        time_coefficient: 1.0,
        duration: projectValue,
        day_counter: 0
      };
      
      setTasks([...tasks, newTask]);
      setNewTaskName('');
      setNewTaskWorkstation('');
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleToggleTask = (index: number) => {
    setTasks(tasks.map((task, i) => 
      i === index ? { ...task, selected: !task.selected } : task
    ));
  };

  // Helper function to find workstation ID by name
  const findWorkstationIdByName = (name: string): string | undefined => {
    if (!name) return undefined;
    
    // Try exact match first
    const exactMatch = workstations.find(w => 
      w.name.toLowerCase() === name.toLowerCase()
    );
    if (exactMatch) return exactMatch.id;
    
    // Try partial match if exact match fails
    const partialMatch = workstations.find(w => 
      w.name.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(w.name.toLowerCase())
    );
    return partialMatch?.id;
  };

  // Helper to convert week number or dd/MM/yyyy to Date
  const parseExternalDate = (input: string | null | undefined): Date | null => {
    if (!input) return null;
    const trimmed = String(input).trim();
    // Support d/M/yyyy and dd/MM/yyyy
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mth, y] = m;
      return new Date(parseInt(y, 10), parseInt(mth, 10) - 1, parseInt(d, 10));
    }
    // Week number format (202544)
    if (/^\d{6}$/.test(trimmed)) {
      const year = parseInt(trimmed.substring(0, 4));
      const week = parseInt(trimmed.substring(4, 6));
      const jan1 = new Date(year, 0, 1);
      const jan1Day = jan1.getDay();
      const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      return new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    }
    // ISO / other parseable string
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) return date;
    } catch (_) {}
    return null;
  };

  const handleSyncProject = async () => {
    const linkId = form.getValues('project_link_id');
    if (!linkId?.trim()) {
      toast({ title: 'Error', description: 'Please enter a Project Link ID first', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      // Load API configs from database
      let projectsQuery = supabase.from('external_api_configs').select('*');
      projectsQuery = applyTenantFilter(projectsQuery, tenant?.id);
      const { data: configs } = await projectsQuery;

      const projectsConfig = configs?.find((c: any) => c.api_type === 'projects');
      const ordersConfig = configs?.find((c: any) => c.api_type === 'orders');

      // --- 1. Fetch project data from Projects API ---
      if (projectsConfig) {
        try {
          // Authenticate
          const authRes = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/external-db-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
            },
            body: JSON.stringify({
              action: 'authenticate',
              baseUrl: projectsConfig.base_url,
              username: projectsConfig.username,
              password: projectsConfig.password
            })
          });
          const authData = await authRes.json();
          const projToken = authData?.response?.token;

          if (projToken) {
            // Query project data
            const queryRes = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/external-db-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
              },
              body: JSON.stringify({
                action: 'query',
                baseUrl: projectsConfig.base_url,
                token: projToken,
                orderNumber: linkId.trim()
              })
            });
            const queryData = await queryRes.json();

            // Parse script result
            let orderData: any = null;
            try {
              const scriptResult = queryData?.response?.scriptResult;
              if (scriptResult) {
                orderData = JSON.parse(scriptResult);
              }
            } catch (_) {}

            if (orderData?.order) {
              const order = orderData.order;
              setSyncedData(order);

              // Fill client name
              if (order.klant) {
                form.setValue('client', order.klant);
              }

              // Fill project name from order if available
              if (order.projectnaam) {
                form.setValue('project_name', order.projectnaam);
              }

              // Fill start date from order date (besteldatum)
              if (order.besteldatum) {
                const startDate = parseExternalDate(order.besteldatum);
                if (startDate) form.setValue('start_date', startDate);
              }

              // Fill installation date from placement date
              if (order.plaatsingsdatum) {
                const instDate = parseExternalDate(order.plaatsingsdatum);
                if (instDate) form.setValue('installation_date', instDate);
              }

              // Handle planning data (installation team, start/end dates)
              if (Array.isArray(order.planning) && order.planning.length > 0) {
                const planning = order.planning[0];
                const planStart = parseExternalDate(planning.datum_start || planning.start_date);
                const planEnd = parseExternalDate(planning.datum_einde || planning.end_date);

                // Use planning start as installation date (overrides placement date)
                if (planStart) {
                  form.setValue('installation_date', planStart);
                }

                // Extract team info for later save
                let teamNames: string[] = [];
                if (planning.teams) {
                  if (Array.isArray(planning.teams)) teamNames = planning.teams;
                  else if (typeof planning.teams === 'string') teamNames = [planning.teams];
                  else if (typeof planning.teams === 'object') teamNames = Object.values(planning.teams).filter(v => typeof v === 'string') as string[];
                }

                if (planStart && planEnd) {
                  const diffDays = Math.round((planEnd.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  setPendingTeamAssignment({
                    start_date: format(planStart, 'yyyy-MM-dd'),
                    duration: diffDays,
                    teams: teamNames
                  });
                }
              }

              toast({ title: 'Project Synced', description: `Data loaded for "${order.klant || linkId}"` });
            } else {
              toast({ title: 'No Data', description: 'No project data found for this Link ID', variant: 'destructive' });
            }
          }
        } catch (err) {
          console.error('Project sync error:', err);
          toast({ title: 'Project Sync Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        }
      }

      // --- 2. Fetch orders from Orders API ---
      if (ordersConfig) {
        try {
          const authRes = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
            },
            body: JSON.stringify({
              action: 'authenticate',
              baseUrl: ordersConfig.base_url,
              username: ordersConfig.username,
              password: ordersConfig.password
            })
          });
          const authData = await authRes.json();
          const ordToken = authData?.response?.token;

          if (ordToken) {
            const queryRes = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
              },
              body: JSON.stringify({
                action: 'query',
                baseUrl: ordersConfig.base_url,
                token: ordToken,
                projectLinkId: linkId.trim()
              })
            });
            const ordersData = await queryRes.json();

            if (ordersData?.bestellingen && Array.isArray(ordersData.bestellingen)) {
              setPendingOrders(ordersData.bestellingen);
              toast({ title: 'Orders Loaded', description: `${ordersData.bestellingen.length} orders found and will be imported on save` });
            }
          }
        } catch (err) {
          console.error('Orders sync error:', err);
          toast({ title: 'Orders Sync Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        }
      }

      if (!projectsConfig && !ordersConfig) {
        toast({ title: 'No API Configured', description: 'Please configure external database APIs in Settings first', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast({ title: 'Sync Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (submitting) return; // Prevent multiple submissions
    
    setSubmitting(true);
    try {
      // Create the full project name with code prefix
      const fullProjectName = `${projectCode}_${data.project_name}`;
      
      // First create the project
      const newProject = await projectService.create({
        name: fullProjectName,
        client: data.client,
        description: data.description || null,
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        installation_date: format(data.installation_date, 'yyyy-MM-dd'),
        status: 'planned',
        progress: 0,
        project_link_id: data.project_link_id || null,
      });
      
      // Create a generic phase for these tasks
      const phase = await phaseService.create({
        project_id: newProject.id,
        name: 'Project Tasks',
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        end_date: format(data.installation_date, 'yyyy-MM-dd'),
        progress: 0
      });
      
      // Get selected and unselected tasks
      const selectedTasks = tasks.filter(task => task.selected);
      const unselectedTaskStandardIds = tasks
        .filter(task => !task.selected && task.standard_task_id)
        .map(task => task.standard_task_id!);
      
      // Build a map of which standard tasks have limit phases on unselected tasks
      // These tasks should be set to TODO instead of HOLD since their prerequisites won't be met
      const tasksWithUnselectedPrerequisites = new Set<string>();
      
      for (const task of selectedTasks) {
        if (task.standard_task_id) {
          const limitPhases = await standardTasksService.getLimitPhases(task.standard_task_id);
          const hasUnselectedPrerequisite = limitPhases.some(
            lp => unselectedTaskStandardIds.includes(lp.standard_task_id)
          );
          if (hasUnselectedPrerequisite) {
            tasksWithUnselectedPrerequisites.add(task.standard_task_id);
          }
        }
      }
      
      // Create all tasks with proper timing and link to workstations
      const createdTasks: Task[] = [];
      for (let index = 0; index < selectedTasks.length; index++) {
        const task = selectedTasks[index];
        
        // Calculate due date based on installation date and day counter
        const dueDate = standardTasksService.calculateTaskDueDate(data.installation_date, task.day_counter || 0);
        
        // Create a task name with the ID prefix (duration will be shown dynamically from estimated_duration)
        const taskName = `${task.id} - ${task.name}`;
        
        // Simple mapping of workstations to standard categories
        let workstationType: 'CUTTING' | 'WELDING' | 'PAINTING' | 'ASSEMBLY' | 'PACKAGING' | 'SHIPPING' = 'ASSEMBLY';
        
        if (task.workstation.toLowerCase().includes('zaag')) {
          workstationType = 'CUTTING';
        } else if (task.workstation.toLowerCase().includes('cnc')) {
          workstationType = 'CUTTING';
        } else if (task.workstation.toLowerCase().includes('pers')) {
          workstationType = 'ASSEMBLY';
        } else if (task.workstation.toLowerCase().includes('productie')) {
          workstationType = 'ASSEMBLY';
        }
        
        // Create task description with workstation info (duration shown dynamically from estimated_duration)
        const taskDescription = task.workstation ? `Workstation: ${task.workstation}` : '';
        
        // Determine initial task status based on limit phases
        let initialStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD' = 'TODO';
        
        if (task.standard_task_id) {
          // If this task's prerequisite was unchecked, set to TODO (not HOLD)
          if (tasksWithUnselectedPrerequisites.has(task.standard_task_id)) {
            initialStatus = 'TODO';
          } else {
            // Check if this standard task has limit phases that aren't completed yet
            const limitPhases = await standardTasksService.getLimitPhases(task.standard_task_id);
            
            // Only check selected tasks that exist in the project
            const selectedStandardTaskIds = selectedTasks
              .filter(t => t.standard_task_id)
              .map(t => t.standard_task_id!);
            
            // Filter limit phases to only those that are in the selected tasks
            const relevantLimitPhases = limitPhases.filter(
              lp => selectedStandardTaskIds.includes(lp.standard_task_id)
            );
            
            // If there are relevant limit phases, task should be on HOLD
            if (relevantLimitPhases.length > 0) {
              initialStatus = 'HOLD';
            }
          }
        }
        
        // Create the task with duration and calculated due date
        const taskDuration = task.duration || 60;
        const newTask = await taskService.create({
          phase_id: phase.id,
          assignee_id: null,
          title: taskName,
          description: taskDescription,
          workstation: workstationType,
          status: initialStatus,
          priority: index < 5 ? 'High' : index < 15 ? 'Medium' : 'Low',
          due_date: format(dueDate, 'yyyy-MM-dd'),
          standard_task_id: task.standard_task_id || null,
          duration: taskDuration, // Save the calculated duration
          estimated_duration: taskDuration // Save the same value as estimated duration
        } as any);
        
        createdTasks.push(newTask);
        
        // Link task to workstation if we can find a matching workstation
        const workstationId = findWorkstationIdByName(task.workstation);
        if (workstationId && newTask.id) {
          try {
            await workstationService.linkTaskToWorkstation(newTask.id, workstationId);
            console.log(`Linked task ${newTask.id} to workstation ${workstationId}`);
          } catch (error) {
            console.error(`Failed to link task ${newTask.id} to workstation ${workstationId}:`, error);
          }
        }
      }
      
      // --- Save pending orders from sync ---
      if (pendingOrders.length > 0) {
        let importedCount = 0;
        for (const bestelling of pendingOrders) {
          try {
            const orderNumber = bestelling.bestelnummer || bestelling.ordernummer || '';
            const supplier = bestelling.leverancier || 'Unknown';
            const deliveryWeek = bestelling.leverweek;
            const isDelivered = bestelling.isVolledigOntvangen;

            // Convert delivery week to date
            let expectedDeliveryDate = new Date().toISOString();
            if (deliveryWeek && /^\d{6}$/.test(deliveryWeek)) {
              const year = parseInt(deliveryWeek.substring(0, 4));
              const week = parseInt(deliveryWeek.substring(4, 6));
              const jan1 = new Date(year, 0, 1);
              const jan1Day = jan1.getDay();
              const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
              const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
              const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
              expectedDeliveryDate = targetDate.toISOString();
            }

            const orderStatus = isDelivered ? 'delivered' : 'pending';
            const itemsCount = Array.isArray(bestelling.artikelen) ? bestelling.artikelen.length : 0;

            const { data: order, error: orderError } = await supabase
              .from('orders')
              .upsert({
                external_order_number: orderNumber,
                project_id: newProject.id,
                supplier,
                order_date: new Date().toISOString(),
                expected_delivery: expectedDeliveryDate,
                status: orderStatus,
                order_type: 'external',
                notes: `Imported from Orders API | Supplier: ${supplier} | Delivery week: ${deliveryWeek || 'N/A'} | Items: ${itemsCount}`,
              }, { onConflict: 'external_order_number', ignoreDuplicates: false })
              .select()
              .single();

            if (orderError) {
              console.error(`Error importing order ${orderNumber}:`, orderError);
              continue;
            }

            // Process order items
            if (Array.isArray(bestelling.artikelen) && bestelling.artikelen.length > 0 && order) {
              const itemsToInsert = bestelling.artikelen.map((artikel: any) => {
                const qty = parseInt(artikel.aantal) || 1;
                return {
                  order_id: order.id,
                  description: artikel.omschrijving || 'No description',
                  quantity: qty,
                  delivered_quantity: isDelivered ? qty : 0,
                  article_code: artikel.artikel || null,
                  ean: artikel.ean || null,
                  notes: artikel.categorie ? `Category: ${artikel.categorie}` : null,
                };
              });

              await supabase.from('order_items').insert(itemsToInsert);
            }
            importedCount++;
          } catch (err) {
            console.error('Error importing order:', err);
          }
        }
        console.log(`Imported ${importedCount} orders for new project`);
      }

      // --- Save pending team assignment from sync ---
      if (pendingTeamAssignment) {
        try {
          // Try to match team
          const { data: placementTeams } = await supabase
            .from('placement_teams')
            .select('id, name, external_team_names');

          let teamId: string | null = null;
          let teamName = 'unnamed';

          if (pendingTeamAssignment.teams?.length > 0 && placementTeams) {
            for (const teamText of pendingTeamAssignment.teams) {
              const normalized = teamText.trim().toLowerCase();
              const match = placementTeams.find((t: any) =>
                t.external_team_names?.some((extName: string) => {
                  const n = extName.trim().toLowerCase();
                  return n === normalized || normalized.includes(n) || n.includes(normalized);
                })
              );
              if (match) {
                teamId = match.id;
                teamName = match.name;
                break;
              }
            }
            if (!teamId) teamName = pendingTeamAssignment.teams[0];
          }

          await supabase.from('project_team_assignments').upsert({
            project_id: newProject.id,
            team_id: teamId,
            team: teamName,
            start_date: pendingTeamAssignment.start_date,
            duration: pendingTeamAssignment.duration,
          }, { onConflict: 'project_id' });
        } catch (err) {
          console.error('Error saving team assignment:', err);
        }
      }

      toast({
        title: "Success",
        description: `Project created successfully with ${selectedTasks.length} tasks${pendingOrders.length > 0 ? ` and ${pendingOrders.length} orders imported` : ''}`,
      });
      
      form.reset();
      setProjectCode('');
      setSyncedData(null);
      setPendingOrders([]);
      setPendingTeamAssignment(null);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create project: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              
              {/* Project Link ID + Sync Button - at the top */}
              <FormField
                control={form.control}
                name="project_link_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Link ID</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="Enter project link ID (optional)" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSyncProject}
                        disabled={syncing || !field.value?.trim()}
                      >
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync
                      </Button>
                    </div>
                    {syncedData && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ Synced{pendingOrders.length > 0 ? ` — ${pendingOrders.length} orders ready to import` : ''}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Project Type Toggle */}
              <FormField
                control={form.control}
                name="is_after_sales"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Project Type</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        {field.value ? 'After-sales Service (11)' : 'Normal Project (10)'}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isGeneratingCode}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Project Code Display */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Generated Project Code</div>
                <div className="text-lg font-mono font-bold">
                  {isGeneratingCode ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </div>
                  ) : (
                    projectCode || 'Error generating code'
                  )}
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="project_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Kitchen Pro - Client XYZ" {...field} />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">
                      Full name will be: <span className="font-mono">{projectCode}_</span><span className="font-medium">{field.value || 'Project Name'}</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input placeholder="Client Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Project details..." 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Project Link ID is at the top of the form */}
              
              <FormField
                control={form.control}
                name="project_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Value (1-100)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="100" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="installation_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Installation Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => 
                              date < new Date("1900-01-01") ||
                              (form.getValues("start_date") && date < form.getValues("start_date"))
                            }
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Project Tasks</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="route-select" className="text-sm whitespace-nowrap">Production Route:</Label>
                    <Select value={selectedRouteId} onValueChange={handleRouteChange}>
                      <SelectTrigger id="route-select" className="w-[200px]">
                        <SelectValue placeholder="All Tasks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        {routes.map(route => (
                          <SelectItem key={route.id} value={route.id}>
                            {route.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-2">
                    {tasks.map((task, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`task-${index}`} 
                          checked={task.selected} 
                          onCheckedChange={() => handleToggleTask(index)} 
                        />
                        <label htmlFor={`task-${index}`} className="text-sm flex-1 flex flex-wrap items-center">
                          <span className="mr-1">{task.id} - {task.name}</span>
                          {task.workstation && <span className="text-muted-foreground mr-2">({task.workstation})</span>}
                          {task.duration && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full mr-2">
                              {task.duration} min
                            </span>
                          )}
                          {task.day_counter !== undefined && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              -{task.day_counter} days
                            </span>
                          )}
                        </label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveTask(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New task name"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Workstation (optional)"
                      value={newTaskWorkstation}
                      onChange={(e) => setNewTaskWorkstation(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      onClick={handleAddCustomTask}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={submitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isGeneratingCode || submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Project...
                    </>
                  ) : isGeneratingCode ? (
                    'Generating Code...'
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
