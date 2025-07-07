import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import type { Task } from './dataService';

// Schedule Type
export interface Schedule {
  id: string;
  employee_id: string;
  task_id?: string;
  phase_id?: string; 
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  employee_id: string;
  task_id?: string;
  phase_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_auto_generated: boolean;
}

// Workstation Schedule Type
export interface WorkstationSchedule {
  id: string;
  workstation_id: string;
  task_id?: string;
  task_title: string;
  user_name: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkstationScheduleInput {
  workstation_id: string;
  task_id?: string;
  task_title: string;
  user_name: string;
  start_time: string;
  end_time: string;
}

export const planningService = {
  // Get schedules for a specific date
  async getSchedulesByDate(date: Date): Promise<Schedule[]> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided:', date);
      throw new Error('Invalid date provided');
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;
    
    console.log('Fetching schedules between:', startOfDay, 'and', endOfDay);
    
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          employee:employees(id, name, role, workstation),
          task:tasks(id, title, description, priority, status),
          phase:phases(id, name, project_id, progress)
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');
      
      if (error) {
        console.error('Supabase error fetching schedules:', error);
        throw error;
      }
      
      console.log('Schedules fetched:', data?.length || 0, 'records');
      return (data || []) as Schedule[];
    } catch (error) {
      console.error('Error in getSchedulesByDate:', error);
      throw error;
    }
  },
  
  // Get schedules for a specific employee on a specific date
  async getSchedulesByEmployeeAndDate(employeeId: string, date: Date): Promise<Schedule[]> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided:', date);
      throw new Error('Invalid date provided');
    }
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;
    
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          employee:employees(id, name, role, workstation),
          task:tasks(id, title, description, priority, status),
          phase:phases(id, name, project_id, progress)
        `)
        .eq('employee_id', employeeId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');
      
      if (error) {
        console.error('Supabase error fetching employee schedules:', error);
        throw error;
      }
      
      return (data || []) as Schedule[];
    } catch (error) {
      console.error('Error in getSchedulesByEmployeeAndDate:', error);
      throw error;
    }
  },

  // Get workstation schedules for a specific date
  async getWorkstationSchedulesByDate(date: Date): Promise<WorkstationSchedule[]> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided:', date);
      throw new Error('Invalid date provided');
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;
    
    console.log('Fetching workstation schedules between:', startOfDay, 'and', endOfDay);
    
    try {
      const { data, error } = await supabase
        .from('workstation_schedules')
        .select(`
          *,
          workstation:workstations(id, name, description),
          task:tasks(id, title, description, priority, status)
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');
      
      if (error) {
        console.error('Supabase error fetching workstation schedules:', error);
        throw error;
      }
      
      console.log('Workstation schedules fetched:', data?.length || 0, 'records');
      return (data || []) as WorkstationSchedule[];
    } catch (error) {
      console.error('Error in getWorkstationSchedulesByDate:', error);
      throw error;
    }
  },
  
  // Create a new schedule
  async createSchedule(schedule: CreateScheduleInput): Promise<Schedule> {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .insert([schedule])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error creating schedule:', error);
        throw error;
      }
      
      return data as Schedule;
    } catch (error) {
      console.error('Error in createSchedule:', error);
      throw error;
    }
  },

  // Create a new workstation schedule
  async createWorkstationSchedule(schedule: CreateWorkstationScheduleInput): Promise<WorkstationSchedule> {
    try {
      const { data, error } = await supabase
        .from('workstation_schedules')
        .insert([schedule])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error creating workstation schedule:', error);
        throw error;
      }
      
      return data as WorkstationSchedule;
    } catch (error) {
      console.error('Error in createWorkstationSchedule:', error);
      throw error;
    }
  },
  
  // Update a schedule
  async updateSchedule(id: string, schedule: Partial<Schedule>): Promise<Schedule> {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .update(schedule)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error updating schedule:', error);
        throw error;
      }
      
      return data as Schedule;
    } catch (error) {
      console.error('Error in updateSchedule:', error);
      throw error;
    }
  },
  
  // Delete a schedule
  async deleteSchedule(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error deleting schedule:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteSchedule:', error);
      throw error;
    }
  },

  // Delete workstation schedules for a specific date
  async deleteWorkstationSchedulesForDate(date: Date): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;
    
    try {
      const { error } = await supabase
        .from('workstation_schedules')
        .delete()
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay);
      
      if (error) {
        console.error('Supabase error deleting workstation schedules:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteWorkstationSchedulesForDate:', error);
      throw error;
    }
  },
  
  // Check if an employee is on holiday for a specific date using the database function
  async isEmployeeOnHoliday(employeeId: string, date: Date): Promise<boolean> {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      console.log(`Checking if employee ${employeeId} is on holiday on ${dateStr}`);
      
      // Use the database function to check for approved holiday requests
      const { data, error } = await supabase
        .rpc('is_employee_on_holiday', {
          emp_id: employeeId,
          check_date: dateStr
        });
      
      if (error) {
        console.error('Error checking employee holiday using database function:', error);
        // Fallback to direct query if function fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('holiday_requests')
          .select('id')
          .eq('user_id', employeeId)
          .lte('start_date', dateStr)
          .gte('end_date', dateStr)
          .eq('status', 'approved')
          .limit(1);
        
        if (fallbackError) {
          console.error('Error in fallback holiday check:', fallbackError);
          return false;
        }
        
        const isOnHoliday = fallbackData && fallbackData.length > 0;
        console.log(`Employee ${employeeId} holiday status (fallback): ${isOnHoliday}`);
        return isOnHoliday;
      }
      
      console.log(`Employee ${employeeId} holiday status: ${data}`);
      return data || false;
    } catch (error) {
      console.error('Error in isEmployeeOnHoliday:', error);
      return false;
    }
  },
  
  // Generate a daily plan based on available tasks and employees
  async generateDailyPlan(date: Date): Promise<void> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided for generating plan:', date);
      throw new Error('Invalid date provided');
    }
    
    // 1. Determine week range (Mon-Fri)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekDates = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    console.log(`Generating weekly plan for: ${format(weekStart, 'yyyy-MM-dd')} to ${format(weekEnd, 'yyyy-MM-dd')}`);

    try {
      // 2. Get all necessary data upfront
      const { data: allNonCompletedTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, phases!inner(project_id)')
        .neq('status', 'COMPLETED');
      if (tasksError) throw tasksError;

      const tasks = allNonCompletedTasks as (Task & { phases: { project_id: string } })[];

      const { data: employees, error: employeesError } = await supabase.from('employees').select('*');
      if (employeesError) throw employeesError;
      if (!employees) throw new Error("No employees found.");

      const { data: workPeriods, error: workPeriodsError } = await supabase.from('work_hours').select('*');
      if (workPeriodsError) throw workPeriodsError;
      if (!workPeriods) throw new Error("No work periods defined.");

      const { data: limitPhaseLinks, error: linksError } = await supabase.from('standard_task_limit_phases').select('*');
      if (linksError) throw linksError;
      if (!limitPhaseLinks) throw new Error("Could not fetch task dependencies.");

      // 3. Clear existing auto-generated schedules for the week
      await supabase
        .from('schedules')
        .delete()
        .gte('start_time', `${format(weekStart, 'yyyy-MM-dd')}T00:00:00`)
        .lte('start_time', `${format(weekEnd, 'yyyy-MM-dd')}T23:59:59`)
        .eq('is_auto_generated', true);

      // 4. In-memory simulation
      const simulatedCompletedTaskIds = new Set<string>();
      const schedulesToInsert: CreateScheduleInput[] = [];

      for (const currentDate of weekDates) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayOfWeek = currentDate.getDay();
        const dailyWorkPeriods = workPeriods.filter(p => p.day_of_week === dayOfWeek).sort((a, b) => a.start_time.localeCompare(b.start_time));

        let schedulableTasks = tasks.filter(task => {
          if (schedulesToInsert.some(s => s.task_id === task.id)) return false;

          if (task.status === 'TODO' || task.status === 'IN_PROGRESS') {
            return true;
          }

          if (task.status === 'HOLD' && task.standard_task_id && task.phases?.project_id) {
            const dependencies = limitPhaseLinks.filter(l => l.standard_task_id === task.standard_task_id);
            if (dependencies.length === 0) return true;

            const projectId = task.phases.project_id;
            const areDependenciesMet = dependencies.every(dep => {
              const dependentTasks = tasks.filter(t => t.standard_task_id === dep.limit_standard_task_id && t.phases?.project_id === projectId);
              if (dependentTasks.length === 0) return true;
              return dependentTasks.every(dt => simulatedCompletedTaskIds.has(dt.id));
            });
            return areDependenciesMet;
          }
          return false;
        });

        const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        schedulableTasks.sort((a, b) => {
          const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
          const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });

        for (const period of dailyWorkPeriods) {
          for (const employee of employees) {
            // CRITICAL: Check if employee is on holiday for this date
            const isOnHoliday = await this.isEmployeeOnHoliday(employee.id, currentDate);
            if (isOnHoliday) {
              console.log(`Employee ${employee.name} is on approved holiday on ${dateStr}, skipping scheduling.`);
              continue;
            }
            
            const startTimeForPeriod = new Date(`${dateStr}T${period.start_time}`);
            const isEmployeeScheduled = schedulesToInsert.some(s =>
              s.employee_id === employee.id &&
              new Date(s.start_time).getTime() === startTimeForPeriod.getTime()
            );
            if (isEmployeeScheduled) continue;

            const taskIndex = schedulableTasks.findIndex(t => {
              const workstationMatch = !t.workstation || !employee.workstation || t.workstation === employee.workstation;
              return workstationMatch;
            });

            if (taskIndex !== -1) {
              const [taskToSchedule] = schedulableTasks.splice(taskIndex, 1);
              const endTimeForPeriod = new Date(`${dateStr}T${period.end_time}`);

              schedulesToInsert.push({
                employee_id: employee.id,
                task_id: taskToSchedule.id,
                title: taskToSchedule.title,
                description: taskToSchedule.description,
                start_time: startTimeForPeriod.toISOString(),
                end_time: endTimeForPeriod.toISOString(),
                is_auto_generated: true
              });

              simulatedCompletedTaskIds.add(taskToSchedule.id);
            }
          }
        }
      }

      if (schedulesToInsert.length > 0) {
        console.log(`Inserting ${schedulesToInsert.length} new schedule entries.`);
        const { error: insertError } = await supabase
          .from('schedules')
          .insert(schedulesToInsert);
        if (insertError) {
          console.error('Error inserting schedules:', insertError);
          throw insertError;
        }
      } else {
        console.log('No schedules to generate for this week.');
      }
    } catch (error: any) {
      console.error('Error in generateWeeklyPlan:', error);
      throw new Error(`Failed to generate plan: ${error.message || 'Unknown error'}`);
    }
  },

  // Generate workstation schedules for a specific date
  async generateWorkstationSchedulesForDate(date: Date): Promise<void> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided for generating workstation schedules:', date);
      throw new Error('Invalid date provided');
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    try {
      // Get work periods for this day
      const { data: workPeriods, error: workPeriodsError } = await supabase
        .from('work_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .order('start_time');

      if (workPeriodsError) throw workPeriodsError;
      if (!workPeriods?.length) {
        throw new Error(`No work periods defined for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
      }

      // Get all workstations
      const { data: workstations, error: workstationsError } = await supabase
        .from('workstations')
        .select('*');

      if (workstationsError) throw workstationsError;
      if (!workstations?.length) {
        throw new Error('No workstations found');
      }

      // Get tasks that need to be scheduled for workstations
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, phases!inner(project_id)')
        .neq('status', 'COMPLETED')
        .in('status', ['TODO', 'IN_PROGRESS']);

      if (tasksError) throw tasksError;

      // Clear existing workstation schedules for this date
      await this.deleteWorkstationSchedulesForDate(date);

      const workstationSchedulesToInsert: CreateWorkstationScheduleInput[] = [];

      // Distribute tasks across workstations and time periods
      let taskIndex = 0;
      for (const period of workPeriods) {
        for (const workstation of workstations) {
          if (taskIndex >= (tasks || []).length) break;

          const task = tasks![taskIndex];
          const startTime = new Date(`${dateStr}T${period.start_time}`);
          const endTime = new Date(`${dateStr}T${period.end_time}`);

          workstationSchedulesToInsert.push({
            workstation_id: workstation.id,
            task_id: task.id,
            task_title: task.title,
            user_name: workstation.name, // Using workstation name as user for now
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
          });

          taskIndex++;
        }
      }

      if (workstationSchedulesToInsert.length > 0) {
        console.log(`Inserting ${workstationSchedulesToInsert.length} workstation schedule entries.`);
        const { error: insertError } = await supabase
          .from('workstation_schedules')
          .insert(workstationSchedulesToInsert);

        if (insertError) {
          console.error('Error inserting workstation schedules:', insertError);
          throw insertError;
        }
      } else {
        console.log('No workstation schedules to generate for this date.');
      }
    } catch (error: any) {
      console.error('Error in generateWorkstationSchedulesForDate:', error);
      throw new Error(`Failed to generate workstation schedules: ${error.message || 'Unknown error'}`);
    }
  },
  
  // New function: Generate a daily plan based on personal tasks
  async generatePlanFromPersonalTasks(employeeId: string, date: Date): Promise<void> {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided for generating plan:', date);
      throw new Error('Invalid date provided');
    }
    
    // CRITICAL: Check if employee is on holiday for this date FIRST
    const isOnHoliday = await this.isEmployeeOnHoliday(employeeId, date);
    if (isOnHoliday) {
      throw new Error('Cannot generate plan for employee on approved holiday');
    }
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    try {
      // First, get the work periods for this day
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      const { data: workPeriods, error: workPeriodsError } = await supabase
        .from('work_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .order('start_time');
      
      if (workPeriodsError) {
        console.error('Error fetching work periods:', workPeriodsError);
        throw workPeriodsError;
      }
      
      if (!workPeriods?.length) {
        throw new Error(`No work periods defined for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
      }
      
      // Get employee data
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
      
      if (employeeError) {
        console.error('Error fetching employee:', employeeError);
        throw employeeError;
      }
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      // Get employee's workstations
      const workstations = await this.getEmployeeWorkstations(employeeId);
      
      if (!workstations.length) {
        throw new Error('No workstations assigned to employee');
      }
      
      // Get personal tasks for the employee's workstations
      const personalTasks = [];
      
      // For each workstation, get the tasks
      for (const workstation of workstations) {
        // First try to get tasks via standard task links
        const { data: standardTaskLinks, error: linksError } = await supabase
          .from('standard_task_workstation_links')
          .select('standard_task_id')
          .eq('workstation_id', workstation);
        
        if (linksError) {
          console.error('Error fetching standard task links:', linksError);
          continue;
        }
        
        if (standardTaskLinks && standardTaskLinks.length > 0) {
          // Get all the standard tasks for this workstation
          const standardTaskIds = standardTaskLinks.map(link => link.standard_task_id);
          const { data: standardTasks, error: standardTasksError } = await supabase
            .from('standard_tasks')
            .select('*')
            .in('id', standardTaskIds);
          
          if (standardTasksError) {
            console.error('Error fetching standard tasks:', standardTasksError);
            continue;
          }
          
          // For each standard task, find actual tasks that match
          for (const standardTask of (standardTasks || [])) {
            const taskNumber = standardTask.task_number;
            const taskName = standardTask.task_name;
            
            // Find tasks that match this standard task
            const { data: matchingTasks, error: tasksError } = await supabase
              .from('tasks')
              .select('*')
              .not('status', 'eq', 'COMPLETED')
              .or(`title.ilike.%${taskNumber}%,title.ilike.%${taskName}%`);
              
            if (tasksError) {
              console.error('Error fetching matching tasks:', tasksError);
              continue;
            }
            
            if (matchingTasks && matchingTasks.length > 0) {
              // Filter for tasks assigned to current user or unassigned
              const relevantTasks = matchingTasks.filter(task => 
                !task.assignee_id || task.assignee_id === employeeId
              );
              
              personalTasks.push(...relevantTasks);
            }
          }
        } else {
          // Fall back to traditional task-workstation links
          const { data: workstationTasks, error: workstationTasksError } = await supabase
            .from('task_workstation_links')
            .select('tasks (*)')
            .eq('workstation_id', workstation);
            
          if (workstationTasksError) {
            console.error('Error fetching workstation tasks:', workstationTasksError);
            continue;
          }
          
          if (workstationTasks && workstationTasks.length > 0) {
            const tasks = workstationTasks
              .filter(item => item.tasks && item.tasks.status !== 'COMPLETED')
              .map(item => item.tasks);
              
            // Filter for tasks assigned to current user or unassigned
            const relevantTasks = tasks.filter(task => 
              !task.assignee_id || task.assignee_id === employeeId
            );
            
            personalTasks.push(...relevantTasks);
          }
        }
      }
      
      // Remove duplicates
      const uniquePersonalTasks = Array.from(
        new Map(personalTasks.map(task => [task.id, task])).values()
      );
      
      // Sort by priority and due date
      const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      uniquePersonalTasks.sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
        
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        // If priority is the same, sort by due date
        const dateA = new Date(a.due_date || '9999-12-31');
        const dateB = new Date(b.due_date || '9999-12-31');
        return dateA.getTime() - dateB.getTime();
      });
      
      // Delete any existing auto-generated schedules for this employee and date
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .eq('employee_id', employeeId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .eq('is_auto_generated', true);
      
      if (deleteError) {
        console.error('Error deleting existing schedules:', deleteError);
        throw deleteError;
      }
      
      const schedulesToInsert: CreateScheduleInput[] = [];
      
      // Distribute tasks across work periods
      let taskIndex = 0;
      
      for (const period of workPeriods) {
        if (taskIndex >= uniquePersonalTasks.length) break;
        
        const startTime = new Date(`${dateStr}T${period.start_time}`);
        const endTime = new Date(`${dateStr}T${period.end_time}`);
        
        // Assign task to this period
        const task = uniquePersonalTasks[taskIndex];
        
        schedulesToInsert.push({
          employee_id: employeeId,
          task_id: task.id,
          title: task.title,
          description: task.description || '',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          is_auto_generated: true
        });
        
        taskIndex++;
      }
      
      console.log('Personal schedules to insert:', schedulesToInsert.length);
      
      // Insert the generated schedules
      if (schedulesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('schedules')
          .insert(schedulesToInsert);
        
        if (insertError) {
          console.error('Error inserting schedules:', insertError);
          throw insertError;
        }
      }
      
      if (schedulesToInsert.length === 0) {
        throw new Error('No tasks available to schedule');
      }
      
      return;
    } catch (error: any) {
      console.error('Error in generatePlanFromPersonalTasks:', error);
      throw new Error(`Failed to generate personal plan: ${error.message || 'Unknown error'}`);
    }
  },
  
  // Get available tasks for planning
  async getAvailableTasksForPlanning(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          phase:phases(name, project:projects(name))
        `)
        .in('status', ['TODO', 'IN_PROGRESS'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching available tasks:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getAvailableTasksForPlanning:', error);
      throw error;
    }
  },
  
  // Get employee workstation assignments
  async getEmployeeWorkstations(employeeId: string): Promise<string[]> {
    try {
      // First check if workstation is directly assigned
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('workstation')
        .eq('id', employeeId)
        .single();
      
      if (employeeError && employeeError.code !== 'PGRST116') {
        console.error('Error fetching employee workstation:', employeeError);
        throw employeeError;
      }
      
      const workstations = [];
      
      if (employeeData?.workstation) {
        // Get workstation ID if it's a legacy workstation name
        const { data: workstationData } = await supabase
          .from('workstations')
          .select('id')
          .eq('name', employeeData.workstation)
          .single();
          
        if (workstationData?.id) {
          workstations.push(workstationData.id);
        }
      }
      
      // Also check for workstation links
      const { data: links, error: linksError } = await supabase
        .from('employee_workstation_links')
        .select('workstation_id')
        .eq('employee_id', employeeId);
      
      if (linksError) {
        console.error('Error fetching workstation links:', linksError);
        throw linksError;
      }
      
      if (links && links.length > 0) {
        links.forEach(link => {
          if (!workstations.includes(link.workstation_id)) {
            workstations.push(link.workstation_id);
          }
        });
      }
      
      return workstations;
    } catch (error) {
      console.error('Error in getEmployeeWorkstations:', error);
      throw error;
    }
  }
};
