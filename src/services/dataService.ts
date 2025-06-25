
import { supabase } from '@/integrations/supabase/client';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD";
  priority: string;
  due_date: string | null;
  phase_id: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  status_changed_at: string | null;
  duration: number | null;
  standard_task_id: string | null;
  project_name?: string;
  project_id?: string;
  assignee_name?: string;
  is_rush_order?: boolean;
  rush_order_id?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "planned" | "in_progress" | "completed" | "on_hold";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export class TaskService {
  async getAll(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getAll:', error);
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data || [];
  }

  async getById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error in getById:', error);
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    return data;
  }

  async create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        ...task,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error in create:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return data;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error in update:', error);
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error in delete:', error);
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  async getByWorkstation(workstationName: string): Promise<Task[]> {
    try {
      console.log('Getting tasks for workstation:', workstationName);
      
      // Get workstation ID by name
      const { data: workstationData, error: workstationError } = await supabase
        .from('workstations')
        .select('id')
        .eq('name', workstationName)
        .single();

      if (workstationError) {
        console.error('Error fetching workstation:', workstationError);
        throw new Error(`Failed to fetch workstation: ${workstationError.message}`);
      }

      if (!workstationData) {
        console.log('No workstation found with name:', workstationName);
        return [];
      }

      return await this.getByWorkstationId(workstationData.id);
    } catch (error) {
      console.error('Error in getByWorkstation:', error);
      throw error;
    }
  }

  async getByWorkstationId(workstationId: string): Promise<Task[]> {
    try {
      console.log('Getting tasks for workstation ID:', workstationId);
      
      // Get standard tasks linked to this workstation
      const { data: standardTaskLinks, error: linksError } = await supabase
        .from('standard_task_workstation_links')
        .select('standard_task_id')
        .eq('workstation_id', workstationId);

      if (linksError) {
        console.error('Error fetching standard task links:', linksError);
        throw new Error(`Failed to fetch standard task links: ${linksError.message}`);
      }

      if (!standardTaskLinks || standardTaskLinks.length === 0) {
        console.log('No standard tasks linked to workstation:', workstationId);
        return [];
      }

      const standardTaskIds = standardTaskLinks.map(link => link.standard_task_id);
      console.log('Found standard task IDs:', standardTaskIds);

      // Get tasks that use these standard tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('standard_task_id', standardTaskIds);

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
      }

      if (!tasksData || tasksData.length === 0) {
        console.log('No tasks found for standard task IDs:', standardTaskIds);
        return [];
      }

      console.log('Found tasks:', tasksData.length);

      // Get project information for each task
      const tasksWithProjectInfo = await Promise.all(
        tasksData.map(async (task) => {
          try {
            // Get phase information
            const { data: phaseData, error: phaseError } = await supabase
              .from('phases')
              .select('project_id, name')
              .eq('id', task.phase_id)
              .maybeSingle();

            if (phaseError) {
              console.error('Error fetching phase for task:', task.id, phaseError);
              return {
                ...task,
                project_name: 'Unknown Project',
                project_id: null
              };
            }

            if (!phaseData) {
              console.log('No phase found for task:', task.id);
              return {
                ...task,
                project_name: 'Unknown Project',
                project_id: null
              };
            }

            // Get project information
            const { data: projectData, error: projectError } = await supabase
              .from('projects')
              .select('name')
              .eq('id', phaseData.project_id)
              .maybeSingle();

            if (projectError) {
              console.error('Error fetching project for phase:', phaseData.project_id, projectError);
              return {
                ...task,
                project_name: 'Unknown Project',
                project_id: phaseData.project_id
              };
            }

            return {
              ...task,
              project_name: projectData?.name || 'Unknown Project',
              project_id: phaseData.project_id
            };
          } catch (error) {
            console.error('Error processing task:', task.id, error);
            return {
              ...task,
              project_name: 'Unknown Project',
              project_id: null
            };
          }
        })
      );

      console.log('Tasks with project info:', tasksWithProjectInfo.length);
      return tasksWithProjectInfo;
    } catch (error) {
      console.error('Error in getByWorkstationId:', error);
      throw error;
    }
  }

  async getByPhase(phaseId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getByPhase:', error);
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data || [];
  }

  async getByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        phases!inner(project_id)
      `)
      .eq('phases.project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getByProject:', error);
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data || [];
  }

  async updateTasksOnHoldToTodo(projectId: string): Promise<void> {
    try {
      console.log('Checking ON HOLD tasks for project:', projectId);
      
      // Get all ON HOLD tasks in the project
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
        console.error('Error fetching ON HOLD tasks:', holdError);
        return;
      }

      if (!holdTasks || holdTasks.length === 0) {
        console.log('No ON HOLD tasks found for project:', projectId);
        return;
      }

      console.log('Found ON HOLD tasks to check:', holdTasks.length);

      // Check each ON HOLD task
      for (const holdTask of holdTasks) {
        if (holdTask.standard_task_id) {
          console.log('Checking limit phases for task:', holdTask.id, 'standard_task_id:', holdTask.standard_task_id);
          
          // Get the standard task to check its limit phases
          const { data: standardTask, error: standardTaskError } = await supabase
            .from('standard_tasks')
            .select('limit_phases')
            .eq('id', holdTask.standard_task_id)
            .single();

          if (standardTaskError) {
            console.error('Error fetching standard task:', standardTaskError);
            continue;
          }

          if (!standardTask || !standardTask.limit_phases || standardTask.limit_phases.length === 0) {
            console.log('No limit phases for standard task:', holdTask.standard_task_id);
            continue;
          }

          console.log('Limit phases to check:', standardTask.limit_phases);

          // Check if all limit phases are completed
          let allLimitPhasesCompleted = true;
          
          for (const limitPhaseId of standardTask.limit_phases) {
            // Get all tasks in this limit phase for the same project
            const { data: limitPhaseTasks, error: limitPhaseError } = await supabase
              .from('tasks')
              .select(`
                *,
                phases!inner(project_id)
              `)
              .eq('phases.project_id', projectId)
              .eq('phase_id', limitPhaseId);

            if (limitPhaseError) {
              console.error('Error fetching limit phase tasks:', limitPhaseError);
              allLimitPhasesCompleted = false;
              break;
            }

            if (!limitPhaseTasks || limitPhaseTasks.length === 0) {
              console.log('No tasks found in limit phase:', limitPhaseId);
              continue;
            }

            // Check if all tasks in this limit phase are completed
            const incompleteTasks = limitPhaseTasks.filter(task => task.status !== 'COMPLETED');
            if (incompleteTasks.length > 0) {
              console.log('Found incomplete tasks in limit phase:', limitPhaseId, 'count:', incompleteTasks.length);
              allLimitPhasesCompleted = false;
              break;
            }
          }

          if (allLimitPhasesCompleted) {
            console.log('All limit phases completed for task:', holdTask.id, 'updating to TODO');
            
            // Update the task status to TODO
            const { error: updateError } = await supabase
              .from('tasks')
              .update({ 
                status: 'TODO',
                updated_at: new Date().toISOString()
              })
              .eq('id', holdTask.id);

            if (updateError) {
              console.error('Error updating task status:', updateError);
            } else {
              console.log('Successfully updated task', holdTask.id, 'from HOLD to TODO');
            }
          } else {
            console.log('Not all limit phases completed for task:', holdTask.id);
          }
        }
      }
    } catch (error) {
      console.error('Error in updateTasksOnHoldToTodo:', error);
    }
  }
}

export const taskService = new TaskService();
