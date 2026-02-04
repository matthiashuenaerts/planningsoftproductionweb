import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, differenceInMinutes, startOfDay, setHours, setMinutes, getDay, isWeekend, addDays } from 'date-fns';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { ganttScheduleService, GanttScheduleInsert } from '@/services/ganttScheduleService';

export interface SchedulableProject {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  start_date: string;
  status: string;
}

export interface SchedulableTask {
  id: string;
  title: string;
  duration: number;
  status: 'TODO' | 'IN_PROGRESS' | 'HOLD';
  standard_task_id: string | null;
  phase_id: string;
  project_id: string;
  project_name: string;
  installation_date: string;
  task_number: string;
  workstation_ids: string[];
}

export interface EmployeeTaskEligibility {
  employee_id: string;
  employee_name: string;
  standard_task_ids: string[];
}

export interface LimitPhaseLink {
  standard_task_id: string;
  limit_standard_task_id: string;
}

export interface ScheduleResult {
  task_id: string;
  workstation_id: string;
  employee_id: string;
  employee_name: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  worker_index: number;
}

export interface EmployeeTimeBlock {
  employee_id: string;
  start: Date;
  end: Date;
}

export interface ProjectCompletionInfo {
  projectId: string;
  projectName: string;
  client: string;
  installationDate: Date;
  lastProductionStepEnd: Date | null;
  status: 'on_track' | 'at_risk' | 'overdue' | 'pending';
  daysRemaining: number;
}

class AutomaticSchedulingService {
  private workingHours: WorkingHours[] = [];
  private holidays: Holiday[] = [];
  private workingHoursMap: Map<number, WorkingHours> = new Map();
  private holidaySet: Set<string> = new Set();
  
  // Track employee time blocks to prevent double booking
  private employeeTimeBlocks: EmployeeTimeBlock[] = [];
  
  // Track scheduled task end times for limit phase dependencies
  private scheduledTaskEndTimes: Map<string, Date> = new Map();

  async initialize() {
    this.workingHours = await workingHoursService.getWorkingHours();
    this.holidays = await holidayService.getHolidays();
    
    // Build working hours map
    this.workingHoursMap = new Map();
    this.workingHours
      .filter((w) => w.team === 'production' && w.is_active)
      .forEach((w) => this.workingHoursMap.set(w.day_of_week, w));
    
    // Build holiday set
    this.holidaySet = new Set(
      this.holidays.filter((h) => h.team === 'production').map((h) => h.date)
    );
  }

  private isWorkingDay(date: Date): boolean {
    const day = getDay(date);
    return !isWeekend(date) && this.workingHoursMap.has(day) && !this.holidaySet.has(format(date, 'yyyy-MM-dd'));
  }

  private getNextWorkday(date: Date): Date {
    let d = addDays(date, 1);
    while (!this.isWorkingDay(d)) d = addDays(d, 1);
    return d;
  }

  private getWorkHours(date: Date): { start: Date; end: Date; breaks: { start: Date; end: Date }[] } | null {
    const wh = this.workingHoursMap.get(getDay(date));
    if (!wh) return null;
    
    const [sh, sm] = wh.start_time.split(':').map(Number);
    const [eh, em] = wh.end_time.split(':').map(Number);
    const s = setMinutes(setHours(startOfDay(date), sh), sm);
    const e = setMinutes(setHours(startOfDay(date), eh), em);
    
    const breaks = (wh.breaks || [])
      .map(b => {
        const [bsh, bsm] = b.start_time.split(':').map(Number);
        const [beh, bem] = b.end_time.split(':').map(Number);
        return {
          start: setMinutes(setHours(startOfDay(date), bsh), bsm),
          end: setMinutes(setHours(startOfDay(date), beh), bem)
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    return { start: s, end: e, breaks };
  }

  /**
   * Get the N most urgent projects based on installation_date
   */
  async getUrgentProjects(count: number): Promise<SchedulableProject[]> {
    const today = format(new Date(), 'yyyy-MM-dd'); // Get today's date in YYYY-MM-DD format
    
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client, installation_date, start_date, status')
      .in('status', ['planned', 'in_progress'])
      .gte('installation_date', today) // Only include projects with installation_date >= today
      .order('installation_date', { ascending: true })
      .limit(count);
    
    if (error) {
      console.error('Error fetching urgent projects:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get all TODO, IN_PROGRESS, and HOLD tasks for the given projects
   */
  async getTasksForProjects(projectIds: string[]): Promise<SchedulableTask[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, duration, status, standard_task_id, phase_id,
        phases!inner (
          project_id,
          projects!inner (id, name, installation_date)
        ),
        standard_tasks (task_number),
        task_workstation_links (workstation_id)
      `)
      .in('status', ['TODO', 'IN_PROGRESS', 'HOLD'])
      .in('phases.project_id', projectIds);
    
    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
    
    return (data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      duration: t.duration || 60,
      status: t.status as 'TODO' | 'IN_PROGRESS' | 'HOLD',
      standard_task_id: t.standard_task_id,
      phase_id: t.phase_id,
      project_id: t.phases?.projects?.id || '',
      project_name: t.phases?.projects?.name || '',
      installation_date: t.phases?.projects?.installation_date || '',
      task_number: t.standard_tasks?.task_number || '999',
      workstation_ids: (t.task_workstation_links || []).map((l: any) => l.workstation_id).filter(Boolean)
    }));
  }

  /**
   * Get employee-task eligibility mappings
   */
  async getEmployeeTaskEligibility(): Promise<EmployeeTaskEligibility[]> {
    const { data, error } = await supabase
      .from('employee_standard_task_links')
      .select(`
        employee_id,
        standard_task_id,
        employees (id, name)
      `);
    
    if (error) {
      console.error('Error fetching employee task links:', error);
      throw error;
    }
    
    // Group by employee
    const employeeMap = new Map<string, EmployeeTaskEligibility>();
    (data || []).forEach((link: any) => {
      if (!link.employees) return;
      
      const existing = employeeMap.get(link.employee_id);
      if (existing) {
        existing.standard_task_ids.push(link.standard_task_id);
      } else {
        employeeMap.set(link.employee_id, {
          employee_id: link.employees.id,
          employee_name: link.employees.name,
          standard_task_ids: [link.standard_task_id]
        });
      }
    });
    
    return Array.from(employeeMap.values());
  }

  /**
   * Get limit phases for dependency checking
   */
  async getLimitPhases(): Promise<LimitPhaseLink[]> {
    const { data, error } = await supabase
      .from('standard_task_limit_phases')
      .select('standard_task_id, limit_standard_task_id');
    
    if (error) {
      console.error('Error fetching limit phases:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get the last production step standard task
   */
  async getLastProductionStep(): Promise<string | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('id')
      .eq('is_last_production_step', true)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching last production step:', error);
      return null;
    }
    
    return data?.id || null;
  }

  /**
   * Find an available employee for a task at a given time
   */
  private findAvailableEmployee(
    standardTaskId: string | null,
    startTime: Date,
    endTime: Date,
    employees: EmployeeTaskEligibility[]
  ): EmployeeTaskEligibility | null {
    if (!standardTaskId) return null;
    
    // Find employees who can do this task
    const eligibleEmployees = employees.filter(e => 
      e.standard_task_ids.includes(standardTaskId)
    );
    
    if (eligibleEmployees.length === 0) return null;
    
    // Find the first employee who is available during this time
    for (const employee of eligibleEmployees) {
      const hasConflict = this.employeeTimeBlocks.some(block => 
        block.employee_id === employee.employee_id &&
        startTime < block.end &&
        endTime > block.start
      );
      
      if (!hasConflict) {
        return employee;
      }
    }
    
    return null;
  }

  /**
   * Find the earliest available slot for a task
   */
  private findEarliestSlot(
    duration: number,
    standardTaskId: string | null,
    employees: EmployeeTaskEligibility[],
    minStartTime: Date,
    workstationId: string
  ): { start: Date; end: Date; employee: EmployeeTaskEligibility } | null {
    let currentDate = startOfDay(minStartTime);
    let maxDaysToSearch = 365; // Safety limit
    let daysSearched = 0;
    
    while (daysSearched < maxDaysToSearch) {
      if (!this.isWorkingDay(currentDate)) {
        currentDate = this.getNextWorkday(currentDate);
        daysSearched++;
        continue;
      }
      
      const workHours = this.getWorkHours(currentDate);
      if (!workHours) {
        currentDate = this.getNextWorkday(currentDate);
        daysSearched++;
        continue;
      }
      
      // Start from minStartTime if it's on this day, otherwise from work start
      let slotStart = currentDate.getTime() === startOfDay(minStartTime).getTime()
        ? (minStartTime > workHours.start ? minStartTime : workHours.start)
        : workHours.start;
      
      // Try to find a slot in this day
      while (slotStart < workHours.end) {
        // Check if we're in a break
        const currentBreak = workHours.breaks.find(b => 
          slotStart >= b.start && slotStart < b.end
        );
        
        if (currentBreak) {
          slotStart = currentBreak.end;
          continue;
        }
        
        // Calculate end time
        let slotEnd = addMinutes(slotStart, duration);
        
        // Check if end goes past work hours
        if (slotEnd > workHours.end) {
          // Can't fit in this day
          break;
        }
        
        // Check if slot crosses a break
        const breakDuringSlot = workHours.breaks.find(b =>
          slotStart < b.start && slotEnd > b.start
        );
        
        if (breakDuringSlot) {
          // Adjust: use time before break if enough, otherwise skip to after break
          const timeBeforeBreak = differenceInMinutes(breakDuringSlot.start, slotStart);
          if (timeBeforeBreak >= duration) {
            slotEnd = addMinutes(slotStart, duration);
          } else {
            slotStart = breakDuringSlot.end;
            continue;
          }
        }
        
        // Try to find an available employee for this slot
        const employee = this.findAvailableEmployee(standardTaskId, slotStart, slotEnd, employees);
        
        if (employee) {
          return { start: slotStart, end: slotEnd, employee };
        }
        
        // Move to next slot (try every 15 minutes)
        slotStart = addMinutes(slotStart, 15);
      }
      
      currentDate = this.getNextWorkday(currentDate);
      daysSearched++;
    }
    
    return null;
  }

  /**
   * Schedule a single task
   */
  private scheduleTask(
    task: SchedulableTask,
    employees: EmployeeTaskEligibility[],
    minStartTime: Date,
    workerIndexMap: Map<string, number>
  ): ScheduleResult | null {
    if (task.workstation_ids.length === 0) {
      console.warn(`Task ${task.id} has no workstation assigned, skipping`);
      return null;
    }
    
    const workstationId = task.workstation_ids[0]; // Use first workstation
    
    const slot = this.findEarliestSlot(
      task.duration,
      task.standard_task_id,
      employees,
      minStartTime,
      workstationId
    );
    
    if (!slot) {
      console.warn(`Could not find slot for task ${task.id}`);
      return null;
    }
    
    // Block this time for the employee
    this.employeeTimeBlocks.push({
      employee_id: slot.employee.employee_id,
      start: slot.start,
      end: slot.end
    });
    
    // Track task end time for dependency resolution
    this.scheduledTaskEndTimes.set(task.id, slot.end);
    
    // Get worker index for this workstation
    const currentIndex = workerIndexMap.get(workstationId) || 0;
    workerIndexMap.set(workstationId, (currentIndex + 1) % 10); // Cycle through workers
    
    return {
      task_id: task.id,
      workstation_id: workstationId,
      employee_id: slot.employee.employee_id,
      employee_name: slot.employee.employee_name,
      scheduled_date: format(slot.start, 'yyyy-MM-dd'),
      start_time: slot.start.toISOString(),
      end_time: slot.end.toISOString(),
      worker_index: currentIndex
    };
  }

  /**
   * Check if all limit phases for a HOLD task are completed
   */
  private areLimitPhasesSatisfied(
    task: SchedulableTask,
    limitPhases: LimitPhaseLink[],
    allTasks: SchedulableTask[]
  ): Date | null {
    if (!task.standard_task_id) return new Date(0);
    
    const taskLimitPhases = limitPhases.filter(
      lp => lp.standard_task_id === task.standard_task_id
    );
    
    if (taskLimitPhases.length === 0) return new Date(0);
    
    let maxEndTime: Date | null = new Date(0);
    
    for (const lp of taskLimitPhases) {
      // Find the limit task in the same project
      const limitTask = allTasks.find(t => 
        t.standard_task_id === lp.limit_standard_task_id &&
        t.project_id === task.project_id
      );
      
      // If no such task exists in the project, it doesn't block scheduling
      if (!limitTask) continue;
      
      const endTime = this.scheduledTaskEndTimes.get(limitTask.id);
      if (!endTime) {
        // Limit task exists but hasn't been scheduled yet
        return null;
      }
      
      if (!maxEndTime || endTime > maxEndTime) {
        maxEndTime = endTime;
      }
    }
    
    return maxEndTime || new Date(0);
  }

  /**
   * Main scheduling algorithm
   */
  async generateSchedule(projectCount: number, startDate: Date): Promise<{
    schedules: ScheduleResult[];
    completions: ProjectCompletionInfo[];
  }> {
    // Reset state
    this.employeeTimeBlocks = [];
    this.scheduledTaskEndTimes = new Map();
    
    await this.initialize();
    
    // Step 1: Get the most urgent projects
    const projects = await this.getUrgentProjects(projectCount);
    if (projects.length === 0) {
      return { schedules: [], completions: [] };
    }
    
    console.log(`Scheduling ${projects.length} projects:`, projects.map(p => p.name));
    
    // Step 2: Get all tasks for these projects
    const projectIds = projects.map(p => p.id);
    const allTasks = await this.getTasksForProjects(projectIds);
    
    console.log(`Found ${allTasks.length} tasks to schedule`);
    
    // Step 3: Get employee eligibility
    const employees = await this.getEmployeeTaskEligibility();
    
    console.log(`Found ${employees.length} employees with task assignments`);
    
    // Step 4: Get limit phases
    const limitPhases = await this.getLimitPhases();
    
    // Step 5: Get last production step for deadline tracking
    const lastProductionStepId = await this.getLastProductionStep();
    
    // Group tasks by project
    const tasksByProject = new Map<string, SchedulableTask[]>();
    allTasks.forEach(task => {
      const existing = tasksByProject.get(task.project_id) || [];
      existing.push(task);
      tasksByProject.set(task.project_id, existing);
    });
    
    const schedules: ScheduleResult[] = [];
    const workerIndexMap = new Map<string, number>();
    const projectLastStepEnd = new Map<string, Date>();
    
    // Process projects in order of urgency (installation date)
    for (const project of projects) {
      const projectTasks = tasksByProject.get(project.id) || [];
      
      if (projectTasks.length === 0) continue;
      
      // Sort tasks by task_number for proper ordering
      projectTasks.sort((a, b) => a.task_number.localeCompare(b.task_number));
      
      // Separate TODO/IN_PROGRESS and HOLD tasks
      const todoTasks = projectTasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS');
      const holdTasks = projectTasks.filter(t => t.status === 'HOLD');
      
      console.log(`Project ${project.name}: ${todoTasks.length} TODO/IN_PROGRESS, ${holdTasks.length} HOLD tasks`);
      
      // Step 3: Schedule TODO/IN_PROGRESS tasks first (in order)
      for (const task of todoTasks) {
        const result = this.scheduleTask(task, employees, startDate, workerIndexMap);
        if (result) {
          schedules.push(result);
          
          // Track last production step end time
          if (task.standard_task_id === lastProductionStepId) {
            projectLastStepEnd.set(project.id, new Date(result.end_time));
          }
                  }
      }
      
      // Step 4: Schedule HOLD tasks (respecting dependencies)
      // We may need multiple passes as dependencies get resolved
      let remainingHoldTasks = [...holdTasks];
      let maxPasses = 10;
      let passCount = 0;
      
      while (remainingHoldTasks.length > 0 && passCount < maxPasses) {
        passCount++;
        const stillPending: SchedulableTask[] = [];
        
        for (const task of remainingHoldTasks) {
          const minStartTime = this.areLimitPhasesSatisfied(task, limitPhases, allTasks);
          
          if (minStartTime === null) {
            // Dependencies not yet satisfied
            stillPending.push(task);
            continue;
          }
          
          // Schedule after dependencies
          const effectiveStartTime = minStartTime > startDate ? minStartTime : startDate;
          const result = this.scheduleTask(task, employees, effectiveStartTime, workerIndexMap);
          
          if (result) {
            schedules.push(result);
            
            // Track last production step end time
            if (task.standard_task_id === lastProductionStepId) {
              projectLastStepEnd.set(project.id, new Date(result.end_time));
            }
          }
        }
        
        remainingHoldTasks = stillPending;
      }
      
      if (remainingHoldTasks.length > 0) {
        console.warn(`${remainingHoldTasks.length} HOLD tasks could not be scheduled for project ${project.name}`);
      }
    }
    
    // Step 6: Build completion info for deadline timeline
    const completions: ProjectCompletionInfo[] = projects.map(project => {
      const installationDate = new Date(project.installation_date);
      const lastStepEnd = projectLastStepEnd.get(project.id) || null;
      const today = new Date();
      
      let status: 'on_track' | 'at_risk' | 'overdue' | 'pending' = 'pending';
      let daysRemaining = differenceInMinutes(installationDate, today) / (24 * 60);
      
      if (lastStepEnd) {
        const daysBeforeInstallation = differenceInMinutes(installationDate, lastStepEnd) / (24 * 60);
        
        if (daysBeforeInstallation < 0) {
          status = 'overdue';
        } else if (daysBeforeInstallation < 3) {
          status = 'at_risk';
        } else {
          status = 'on_track';
        }
      }
      
      return {
        projectId: project.id,
        projectName: project.name,
        client: project.client,
        installationDate,
        lastProductionStepEnd: lastStepEnd,
        status,
        daysRemaining: Math.floor(daysRemaining)
      };
    });
    
    console.log(`Generated ${schedules.length} schedule entries`);
    
    return { schedules, completions };
  }

  /**
   * Save schedules to database
   */
  async saveSchedulesToDatabase(schedules: ScheduleResult[]): Promise<void> {
    if (schedules.length === 0) return;
    
    // Group by date
    const byDate = new Map<string, GanttScheduleInsert[]>();
    
    schedules.forEach(s => {
      const dateStr = s.scheduled_date;
      const existing = byDate.get(dateStr) || [];
      existing.push({
        task_id: s.task_id,
        workstation_id: s.workstation_id,
        employee_id: s.employee_id,
        scheduled_date: dateStr,
        start_time: s.start_time,
        end_time: s.end_time,
        worker_index: s.worker_index
      });
      byDate.set(dateStr, existing);
    });
    
    // Save each date's schedules
    for (const [dateStr, dateSchedules] of byDate) {
      const date = new Date(dateStr);
      await ganttScheduleService.saveSchedulesForDate(date, dateSchedules);
    }
  }
}

export const automaticSchedulingService = new AutomaticSchedulingService();
