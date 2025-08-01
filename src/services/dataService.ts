import { supabase } from "@/integrations/supabase/client";
import { standardTasksService } from "./standardTasksService";

// Project Types
export interface Project {
  id: string;
  name: string;
  client: string;
  description: string | null;
  start_date: string;
  installation_date: string;
  progress: number;
  status: 'planned' | 'in_progress' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
  project_link_id?: string | null;
}

// Phase Types
export interface Phase {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

// Task Types
export interface Task {
  id: string;
  phase_id: string;
  assignee_id?: string;
  title: string;
  description?: string;
  workstation: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD";
  priority: "Low" | "Medium" | "High" | "Urgent";
  due_date: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  completed_at?: string;
  completed_by?: string;
  status_changed_at?: string;
  is_rush_order?: boolean;
  rush_order_id?: string;
  standard_task_id?: string;
  duration?: number; // Task duration in minutes
}

// Employee Types
export interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: string;
  password?: string;
  created_at: string;
  workstation?: string | null;
}

// Project service functions
export const projectService = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data as Project[] || [];
  },
  
  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as Project;
  },
  
  async getProjectPhases(projectId: string): Promise<Phase[]> {
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data as Phase[] || [];
  },
  
  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();
    
    if (error) throw error;
    return data as Project;
  },
  
  async update(id: string, project: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(project)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Project;
  },
  
  async delete(id: string): Promise<void> {
    try {
      // Get all phases for this project
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('project_id', id);
      
      if (phasesError) throw phasesError;

      // Delete all tasks associated with these phases
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(phase => phase.id);
        
        // Delete task-workstation links first
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id')
          .in('phase_id', phaseIds);
        
        if (tasksError) throw tasksError;
        
        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(task => task.id);
          
          // Delete task_workstation_links
          const { error: linksError } = await supabase
            .from('task_workstation_links')
            .delete()
            .in('task_id', taskIds);
          
          if (linksError) throw linksError;
          
          // Delete schedules associated with tasks
          const { error: schedulesError } = await supabase
            .from('schedules')
            .delete()
            .in('task_id', taskIds);
          
          if (schedulesError && schedulesError.code !== '42P01') throw schedulesError;
          
          // Delete tasks
          const { error: deleteTasksError } = await supabase
            .from('tasks')
            .delete()
            .in('phase_id', phaseIds);
          
          if (deleteTasksError) throw deleteTasksError;
        }
        
        // Delete phases
        const { error: deletePhasesError } = await supabase
          .from('phases')
          .delete()
          .eq('project_id', id);
        
        if (deletePhasesError) throw deletePhasesError;
      }
      
      // Get all orders for this project
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('project_id', id);
      
      if (ordersError) throw ordersError;
      
      // Delete all orders and their associated items and attachments
      if (orders && orders.length > 0) {
        for (const order of orders) {
          // Delete order items
          const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', order.id);
          
          if (itemsError) throw itemsError;
          
          // Get all attachments for this order
          const { data: attachments, error: attachmentsError } = await supabase
            .from('order_attachments')
            .select('id, file_name, order_id')
            .eq('order_id', order.id);
          
          if (attachmentsError && attachmentsError.code !== '42P01') throw attachmentsError;
          
          // Delete all attachment files from storage
          if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
              const filePath = `${attachment.order_id}/${attachment.file_name}`;
              
              const { error: storageError } = await supabase.storage
                .from('order-attachments')
                .remove([filePath]);
              
              if (storageError) console.error("Error removing file from storage:", storageError);
            }
            
            // Delete attachment records
            const { error: deleteAttachmentsError } = await supabase
              .from('order_attachments')
              .delete()
              .eq('order_id', order.id);
            
            if (deleteAttachmentsError && deleteAttachmentsError.code !== '42P01') throw deleteAttachmentsError;
          }
        }
        
        // Delete orders
        const { error: deleteOrdersError } = await supabase
          .from('orders')
          .delete()
          .eq('project_id', id);
        
        if (deleteOrdersError) throw deleteOrdersError;
      }
      
      // Finally delete the project itself
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  }
};

// Phase service functions
export const phaseService = {
  async getByProject(projectId: string): Promise<Phase[]> {
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    
    if (error) throw error;
    return data as Phase[] || [];
  },
  
  async create(phase: Omit<Phase, 'id' | 'created_at' | 'updated_at'>): Promise<Phase> {
    // Ensure the phase name meets any constraints
    const { data, error } = await supabase
      .from('phases')
      .insert([phase])
      .select()
      .single();
    
    if (error) {
      console.error('Phase creation error:', error);
      throw error;
    }
    
    return data as Phase;
  },
  
  async update(id: string, phase: Partial<Phase>): Promise<Phase> {
    const { data, error } = await supabase
      .from('phases')
      .update(phase)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Phase;
  }
};

// Task service functions
export const taskService = {
  async getAll(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data as Task[] || [];
  },

  async getByPhase(phaseId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        phases!inner(project_id)
      `)
      .eq('phase_id', phaseId)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    
    // Process tasks to check limit phases and update status if needed
    const processedTasks = await Promise.all(
      (tasks || []).map(async (task) => {
        if (task.standard_task_id && task.status === 'TODO') {
          const projectId = (task as any).phases.project_id;
          const limitPhasesCompleted = await standardTasksService.checkLimitPhasesCompleted(
            task.standard_task_id, 
            projectId
          );
          
          if (!limitPhasesCompleted) {
            // Update task status to HOLD
            await this.update(task.id, { status: 'HOLD' });
            task.status = 'HOLD';
          }
        }
        
        // Remove the phases object from the returned task
        const { phases, ...cleanTask } = task as any;
        return cleanTask as Task;
      })
    );
    
    return processedTasks;
  },
  
  async getByWorkstation(workstation: string): Promise<Task[]> {
    try {
      // First get the workstation ID
      const { data: workstationData, error: workstationError } = await supabase
        .from('workstations')
        .select('id')
        .eq('name', workstation)
        .maybeSingle();
      
      if (workstationError) throw workstationError;
      
      if (!workstationData) {
        console.warn(`No workstation found with name: ${workstation}`);
        return [];
      }
      
      return await this.getByWorkstationId(workstationData.id);
    } catch (error) {
      console.error('Error in getByWorkstation:', error);
      throw error;
    }
  },

  async getByWorkstationId(workstationId: string): Promise<Task[]> {
    try {
      // Get tasks linked to this workstation
      const { data, error } = await supabase
        .from('task_workstation_links')
        .select(`
          task_id,
          tasks (
            *,
            phases!inner(project_id)
          )
        `)
        .eq('workstation_id', workstationId);
      
      if (error) throw error;
      
      // Check if data exists and has tasks property
      if (!data || data.length === 0) {
        return [];
      }
      
      // Process tasks to check limit phases and update status if needed
      const processedTasks = await Promise.all(
        data
          .filter(item => item.tasks !== null) // Filter out any null tasks
          .map(async (item) => {
            const task = item.tasks as any;
            
            if (task.standard_task_id && task.status === 'TODO') {
              const projectId = (task as any).phases.project_id;
              const limitPhasesCompleted = await standardTasksService.checkLimitPhasesCompleted(
                task.standard_task_id, 
                projectId
              );
              
              if (!limitPhasesCompleted) {
                // Update task status to HOLD
                await this.update(task.id, { status: 'HOLD' });
                task.status = 'HOLD';
              }
            }
            
            // Remove the phases object from the returned task
            const { phases, ...cleanTask } = task;
            return cleanTask as Task;
          })
      );
      
      return processedTasks;
    } catch (error) {
      console.error('Error in getByWorkstationId:', error);
      throw error;
    }
  },
  
  async getTodaysTasks(): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('due_date', today)
      .order('priority', { ascending: false });
    
    if (error) throw error;
    return data as Task[] || [];
  },
  
  async getByDueDate(dueDate: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('due_date', dueDate)
      .order('priority', { ascending: false });
    
    if (error) throw error;
    return data as Task[] || [];
  },
  
  async getOpenTasksByEmployeeOrWorkstation(employeeId: string, workstation: string | null): Promise<Task[]> {
    // Get tasks assigned to an employee
    if (employeeId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assignee_id', employeeId)
        .in('status', ['TODO', 'IN_PROGRESS'])
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as Task[] || [];
    } 
    // Get tasks for a workstation
    else if (workstation) {
      // First get the workstation ID
      const { data: workstationData, error: workstationError } = await supabase
        .from('workstations')
        .select('id')
        .eq('name', workstation)
        .single();
      
      if (workstationError) throw workstationError;
      
      // Get tasks linked to this workstation
      const { data, error } = await supabase
        .from('task_workstation_links')
        .select(`
          task_id,
          tasks (*)
        `)
        .eq('workstation_id', workstationData.id);
      
      if (error) throw error;
      
      // Extract tasks from the joined data and filter for open tasks
      const tasks = data.map(item => item.tasks) as Task[] || [];
      return tasks.filter(task => task.status === 'TODO' || task.status === 'IN_PROGRESS');
    }
    
    return [];
  },
  
  async create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select()
      .single();
    
    if (error) throw error;
    return data as Task;
  },
  
  async update(id: string, task: Partial<Task>): Promise<Task> {
    // Update status_changed_at when status is being changed
    if (task.status) {
      task.status_changed_at = new Date().toISOString();
      
      // If status is being changed from HOLD to TODO, check limit phases first
      if (task.status === 'TODO') {
        const { data: currentTask, error: fetchError } = await supabase
          .from('tasks')
          .select(`
            *,
            phases!inner(project_id)
          `)
          .eq('id', id)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (currentTask.standard_task_id) {
          const limitPhasesCompleted = await standardTasksService.checkLimitPhasesCompleted(
            currentTask.standard_task_id,
            (currentTask as any).phases.project_id
          );
          
          if (!limitPhasesCompleted) {
            task.status = 'HOLD';
          }
        }
      }
      
      // If the status is changed to IN_PROGRESS, make sure assignee_id is set
      if (task.status === 'IN_PROGRESS' && !task.assignee_id) {
        // Check if user info is available (ideally this would be the current user)
        console.warn('Setting task to IN_PROGRESS without specifying an assignee');
      }
      
      // If task is being completed, check if it affects other tasks' limit phases
      if (task.status === 'COMPLETED') {
        task.completed_at = new Date().toISOString();
        
        // Get the current task to find its project and standard_task_id
        const { data: currentTask, error: fetchError } = await supabase
          .from('tasks')
          .select(`
            *,
            phases!inner(project_id)
          `)
          .eq('id', id)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (currentTask.standard_task_id) {
          const projectId = (currentTask as any).phases.project_id;
          
          // After updating this task, check all HOLD tasks in the same project
          // to see if any can be moved to TODO status
          setTimeout(async () => {
            try {
              await this.checkAndUpdateHoldTasks(projectId);
            } catch (error) {
              console.error('Error checking hold tasks:', error);
            }
          }, 1000); // Small delay to ensure the task update is committed
        }
      }
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(task)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Task;
  },
  
  async checkAndUpdateHoldTasks(projectId: string): Promise<void> {
    console.log(`Checking HOLD tasks for project ${projectId}`);
    
    // Get all HOLD tasks in the project that have standard_task_id
    const { data: holdTasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        standard_task_id,
        phases!inner(project_id)
      `)
      .eq('phases.project_id', projectId)
      .eq('status', 'HOLD')
      .not('standard_task_id', 'is', null);
    
    if (error) {
      console.error('Error fetching HOLD tasks:', error);
      return;
    }
    
    if (!holdTasks || holdTasks.length === 0) {
      console.log('No HOLD tasks found');
      return;
    }
    
    console.log(`Found ${holdTasks.length} HOLD tasks to check`);
    
    // Check each HOLD task to see if its limit phases are now completed
    for (const holdTask of holdTasks) {
      try {
        const limitPhasesCompleted = await standardTasksService.checkLimitPhasesCompleted(
          holdTask.standard_task_id!,
          projectId
        );
        
        if (limitPhasesCompleted) {
          console.log(`Updating task ${holdTask.id} from HOLD to TODO`);
          await this.update(holdTask.id, { status: 'TODO' });
        }
      } catch (error) {
        console.error(`Error checking limit phases for task ${holdTask.id}:`, error);
      }
    }
  },
  
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Employee service functions
export const employeeService = {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as Employee[] || [];
  },
  
  async create(employee: { 
    name: string; 
    email?: string | null; 
    password: string; 
    role: string; 
    workstation?: string;
  }): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert([employee])
      .select()
      .single();
    
    if (error) throw error;
    return data as Employee;
  },

  async update(id: string, employee: Partial<Omit<Employee, 'id' | 'created_at'>>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update(employee)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Employee;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Work hours service
export const workHoursService = {
  async getAll(): Promise<any[]> {
    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
  
  async getByDayOfWeek(dayOfWeek: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
  
  async update(id: string, workHours: Partial<any>): Promise<any> {
    const { data, error } = await supabase
      .from('work_hours')
      .update(workHours)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Insert initial employee data if needed
export const seedInitialData = async () => {
  const { data } = await supabase.from('employees').select('id');
  
  // Only seed if no employees exist
  if (data && data.length === 0) {
    await supabase.from('employees').insert([
      {
        name: 'Matthias Huenaerts',
        email: null,
        password: 'mh310801',
        role: 'admin'
      },
      {
        name: 'Manager User',
        email: 'manager@kitchenpro.com',
        password: 'manager123',
        role: 'manager'
      },
      {
        name: 'Worker 1',
        email: 'worker1@kitchenpro.com',
        password: 'worker123',
        role: 'worker'
      },
      {
        name: 'Worker 2',
        email: 'worker2@kitchenpro.com',
        password: 'worker123',
        role: 'worker'
      }
    ]);
  }
};
