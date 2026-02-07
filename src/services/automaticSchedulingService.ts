import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, differenceInMinutes, startOfDay, setHours, setMinutes, getDay, isWeekend, addDays, isSameDay } from 'date-fns';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { holidayService, Holiday } from '@/services/holidayService';
import { GanttScheduleInsert } from '@/services/ganttScheduleService';
import { recurringTaskService, RecurringTaskSchedule } from '@/services/recurringTaskService';

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

export interface ScheduleSlot {
  task_id: string;
  workstation_id: string;
  employee_id: string;
  employee_name: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  worker_index: number;
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

  // Track employee lane index per workstation: ws_id -> employee_id -> lane_index
  private wsEmployeeLaneMap: Map<string, Map<string, number>> = new Map();

  // Recurring task schedules
  private recurringSchedules: RecurringTaskSchedule[] = [];

  async initialize() {
    this.workingHours = await workingHoursService.getWorkingHours();
    this.holidays = await holidayService.getHolidays();
    
    this.workingHoursMap = new Map();
    this.workingHours
      .filter((w) => w.team === 'production' && w.is_active)
      .forEach((w) => this.workingHoursMap.set(w.day_of_week, w));
    
    this.holidaySet = new Set(
      this.holidays.filter((h) => h.team === 'production').map((h) => h.date)
    );

    // Load recurring task schedules
    try {
      this.recurringSchedules = await recurringTaskService.getAll();
      this.recurringSchedules = this.recurringSchedules.filter(s => s.is_active);
      console.log(`Loaded ${this.recurringSchedules.length} active recurring task schedules`);
    } catch (e) {
      console.warn('Could not load recurring task schedules:', e);
      this.recurringSchedules = [];
    }
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
   * Get the employee's lane index for a workstation, assigning a new one if needed
   */
  private getEmployeeLaneIndex(workstationId: string, employeeId: string): number {
    if (!this.wsEmployeeLaneMap.has(workstationId)) {
      this.wsEmployeeLaneMap.set(workstationId, new Map());
    }
    const laneMap = this.wsEmployeeLaneMap.get(workstationId)!;
    if (!laneMap.has(employeeId)) {
      laneMap.set(employeeId, laneMap.size);
    }
    return laneMap.get(employeeId)!;
  }

  /**
   * Get the N most urgent projects based on installation_date
   */
  async getUrgentProjects(count: number): Promise<SchedulableProject[]> {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Paginate to handle large counts
    const BATCH_SIZE = 1000;
    let allProjects: SchedulableProject[] = [];
    let offset = 0;
    
    while (allProjects.length < count) {
      const limit = Math.min(BATCH_SIZE, count - allProjects.length);
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client, installation_date, start_date, status')
        .in('status', ['planned', 'in_progress'])
        .gte('installation_date', today)
        .order('installation_date', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Error fetching urgent projects:', error);
        throw error;
      }
      
      if (!data || data.length === 0) break;
      allProjects = [...allProjects, ...data];
      offset += limit;
      if (data.length < limit) break;
    }
    
    return allProjects.slice(0, count);
  }

  /**
   * Get all TODO, IN_PROGRESS, and HOLD tasks for the given projects (with pagination)
   */
  async getTasksForProjects(projectIds: string[]): Promise<SchedulableTask[]> {
    // Process in batches of project IDs to avoid query limits
    const BATCH_SIZE = 50;
    const allTasks: SchedulableTask[] = [];
    
    for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
      const batchIds = projectIds.slice(i, i + BATCH_SIZE);
      
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
        .in('phases.project_id', batchIds);
      
      if (error) {
        console.error('Error fetching tasks batch:', error);
        continue;
      }
      
      const mapped = (data || []).map((t: any) => ({
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
      
      allTasks.push(...mapped);
    }
    
    return allTasks;
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
   * Get the last production step standard task (returns id and name)
   */
  async getLastProductionStep(): Promise<{ id: string; name: string } | null> {
    const { data, error } = await supabase
      .from('standard_tasks')
      .select('id, task_name')
      .eq('is_last_production_step', true)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching last production step:', error);
      return null;
    }
    
    return data ? { id: data.id, name: data.task_name } : null;
  }

  /**
   * Split a task into multiple time slots respecting breaks and end of day
   */
  private getTaskSlots(from: Date, duration: number): { start: Date; end: Date }[] {
    const res: { start: Date; end: Date }[] = [];
    let remaining = duration;
    let cur = from;
    let wh = this.getWorkHours(cur);
    
    if (!wh) {
      cur = this.getNextWorkday(cur);
      wh = this.getWorkHours(cur);
    }
    
    if (!wh) return res;
    
    if (cur < wh.start) cur = wh.start;

    let maxIterations = 1000;
    while (remaining > 0 && maxIterations-- > 0) {
      const endToday = wh!.end;
      const breaks = wh!.breaks || [];
      
      if (cur >= endToday) {
        cur = this.getNextWorkday(cur);
        wh = this.getWorkHours(cur);
        if (!wh) break;
        cur = wh.start;
        continue;
      }
      
      const currentBreak = breaks.find(b => cur >= b.start && cur < b.end);
      if (currentBreak) {
        cur = currentBreak.end;
        continue;
      }
      
      const nextBreak = breaks.find(b => b.start > cur);
      
      let availableEnd = endToday;
      if (nextBreak && nextBreak.start < endToday) {
        availableEnd = nextBreak.start;
      }
      
      const availableMinutes = differenceInMinutes(availableEnd, cur);
      
      if (availableMinutes > 0) {
        const used = Math.min(remaining, availableMinutes);
        res.push({ start: cur, end: addMinutes(cur, used) });
        remaining -= used;
        cur = addMinutes(cur, used);
      } else {
        if (nextBreak) {
          cur = nextBreak.end;
        } else {
          cur = this.getNextWorkday(cur);
          wh = this.getWorkHours(cur);
          if (!wh) break;
          cur = wh.start;
        }
      }
    }
    
    return res;
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
    
    const eligibleEmployees = employees.filter(e => 
      e.standard_task_ids.includes(standardTaskId)
    );
    
    if (eligibleEmployees.length === 0) return null;
    
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
   * Find the earliest available slots for a task
   */
  private findEarliestSlots(
    duration: number,
    standardTaskId: string | null,
    employees: EmployeeTaskEligibility[],
    minStartTime: Date,
    workstationId: string
  ): { slots: { start: Date; end: Date }[]; employee: EmployeeTaskEligibility } | null {
    let currentDate = startOfDay(minStartTime);
    let maxDaysToSearch = 365;
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
      
      let slotStart = isSameDay(currentDate, minStartTime)
        ? (minStartTime > workHours.start ? minStartTime : workHours.start)
        : workHours.start;
      
      let maxSlotAttempts = 100;
      while (slotStart < workHours.end && maxSlotAttempts-- > 0) {
        const currentBreak = workHours.breaks.find(b => 
          slotStart >= b.start && slotStart < b.end
        );
        
        if (currentBreak) {
          slotStart = currentBreak.end;
          continue;
        }
        
        const taskSlots = this.getTaskSlots(slotStart, duration);
        if (taskSlots.length === 0) break;
        
        const firstSlotStart = taskSlots[0].start;
        const lastSlotEnd = taskSlots[taskSlots.length - 1].end;
        
        const employee = this.findAvailableEmployee(standardTaskId, firstSlotStart, lastSlotEnd, employees);
        
        if (employee) {
          return { slots: taskSlots, employee };
        }
        
        slotStart = addMinutes(slotStart, 15);
      }
      
      currentDate = this.getNextWorkday(currentDate);
      daysSearched++;
    }
    
    return null;
  }

  /**
   * Schedule a single task - returns slots with consistent employee lane indices
   */
  private scheduleTask(
    task: SchedulableTask,
    employees: EmployeeTaskEligibility[],
    minStartTime: Date
  ): ScheduleSlot[] {
    if (task.workstation_ids.length === 0) {
      console.warn(`Task ${task.id} has no workstation assigned, skipping`);
      return [];
    }
    
    const workstationId = task.workstation_ids[0];
    
    const result = this.findEarliestSlots(
      task.duration,
      task.standard_task_id,
      employees,
      minStartTime,
      workstationId
    );
    
    if (!result || result.slots.length === 0) {
      console.warn(`Could not find slot for task ${task.id}`);
      return [];
    }
    
    const { slots, employee } = result;
    
    // Block the entire time span for the employee
    const firstSlotStart = slots[0].start;
    const lastSlotEnd = slots[slots.length - 1].end;
    
    this.employeeTimeBlocks.push({
      employee_id: employee.employee_id,
      start: firstSlotStart,
      end: lastSlotEnd
    });
    
    // Track task end time for dependency resolution
    this.scheduledTaskEndTimes.set(task.id, lastSlotEnd);
    
    // Get the stable lane index for this employee at this workstation
    const employeeLaneIndex = this.getEmployeeLaneIndex(workstationId, employee.employee_id);
    
    // Create schedule slots - each segment gets a unique worker_index for DB uniqueness
    // but they all share the same employee lane concept
    return slots.map((slot, segmentIndex) => {
      const dateKey = format(slot.start, 'yyyy-MM-dd');
      // worker_index: combine employee lane with segment for uniqueness
      // Use employeeLaneIndex * 100 + segmentIndex to ensure uniqueness
      const workerIndex = employeeLaneIndex * 100 + segmentIndex;
      
      return {
        task_id: task.id,
        workstation_id: workstationId,
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        scheduled_date: dateKey,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        worker_index: workerIndex
      };
    });
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
      const limitTask = allTasks.find(t => 
        t.standard_task_id === lp.limit_standard_task_id &&
        t.project_id === task.project_id
      );
      
      if (!limitTask) continue;
      
      const endTime = this.scheduledTaskEndTimes.get(limitTask.id);
      if (!endTime) {
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
    schedules: ScheduleSlot[];
    completions: ProjectCompletionInfo[];
    lastProductionStepName: string | null;
  }> {
    // Reset state
    this.employeeTimeBlocks = [];
    this.scheduledTaskEndTimes = new Map();
    this.wsEmployeeLaneMap = new Map();
    
    await this.initialize();
    
    // Step 0: Pre-schedule recurring tasks - block their time slots for the assigned employees
    const recurringScheduleSlots: ScheduleResult[] = [];
    if (this.recurringSchedules.length > 0) {
      console.log('📌 Pre-scheduling recurring tasks...');
      
      // Scan the next 365 days for recurring task occurrences
      for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
        const currentDate = addDays(startDate, dayOffset);
        const dayOfWeek = getDay(currentDate);
        
        if (!this.isWorkingDay(currentDate)) continue;
        
        // Find recurring schedules matching this day
        const dayRecurrings = this.recurringSchedules.filter(r => r.day_of_week === dayOfWeek);
        
        for (const recurring of dayRecurrings) {
          const [sh, sm] = recurring.start_time.split(':').map(Number);
          const [eh, em] = recurring.end_time.split(':').map(Number);
          const slotStart = setMinutes(setHours(startOfDay(currentDate), sh), sm);
          const slotEnd = setMinutes(setHours(startOfDay(currentDate), eh), em);
          
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const workstationId = recurring.workstation_id;
          
          // Block time for each assigned employee
          for (const employeeId of recurring.employee_ids) {
            // Block the employee's time
            this.employeeTimeBlocks.push({
              employee_id: employeeId,
              start: slotStart,
              end: slotEnd,
            });
            
            // If a workstation is specified, create a schedule slot for it
            if (workstationId) {
              const employeeLaneIndex = this.getEmployeeLaneIndex(workstationId, employeeId);
              
              recurringScheduleSlots.push({
                // Use a placeholder task_id - the recurring task doesn't have a real task
                task_id: `recurring_${recurring.id}_${dateStr}`,
                workstation_id: workstationId,
                employee_id: employeeId,
                employee_name: '',
                scheduled_date: dateStr,
                start_time: slotStart.toISOString(),
                end_time: slotEnd.toISOString(),
                worker_index: employeeLaneIndex * 100,
              });
            }
          }
        }
      }
      
      console.log(`Pre-blocked ${recurringScheduleSlots.length} recurring task slots`);
    }
    
    // Step 1: Get the most urgent projects
    const projects = await this.getUrgentProjects(projectCount);
    if (projects.length === 0) {
      return { schedules: [], completions: [], lastProductionStepName: null };
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
    const lastProductionStep = await this.getLastProductionStep();
    const lastProductionStepId = lastProductionStep?.id || null;
    const lastProductionStepName = lastProductionStep?.name || null;
    
    // Group tasks by project
    const tasksByProject = new Map<string, SchedulableTask[]>();
    allTasks.forEach(task => {
      const existing = tasksByProject.get(task.project_id) || [];
      existing.push(task);
      tasksByProject.set(task.project_id, existing);
    });
    
    const schedules: ScheduleResult[] = [];
    const projectLastStepEnd = new Map<string, Date>();
    
    // Process projects in order of urgency
    for (const project of projects) {
      const projectTasks = tasksByProject.get(project.id) || [];
      
      if (projectTasks.length === 0) continue;
      
      projectTasks.sort((a, b) => a.task_number.localeCompare(b.task_number));
      
      const todoTasks = projectTasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS');
      const holdTasks = projectTasks.filter(t => t.status === 'HOLD');
      
      console.log(`Project ${project.name}: ${todoTasks.length} TODO/IN_PROGRESS, ${holdTasks.length} HOLD tasks`);
      
      // Schedule TODO/IN_PROGRESS tasks first
      for (const task of todoTasks) {
        const taskSlots = this.scheduleTask(task, employees, startDate);
        schedules.push(...taskSlots);
        
        if (taskSlots.length > 0 && task.standard_task_id === lastProductionStepId) {
          const lastSlotEnd = new Date(taskSlots[taskSlots.length - 1].end_time);
          projectLastStepEnd.set(project.id, lastSlotEnd);
        }
      }
      
      // Schedule HOLD tasks (respecting dependencies)
      let remainingHoldTasks = [...holdTasks];
      let maxPasses = 10;
      let passCount = 0;
      
      while (remainingHoldTasks.length > 0 && passCount < maxPasses) {
        passCount++;
        const stillPending: SchedulableTask[] = [];
        
        for (const task of remainingHoldTasks) {
          const minStartTime = this.areLimitPhasesSatisfied(task, limitPhases, allTasks);
          
          if (minStartTime === null) {
            stillPending.push(task);
            continue;
          }
          
          const effectiveStartTime = minStartTime > startDate ? minStartTime : startDate;
          const taskSlots = this.scheduleTask(task, employees, effectiveStartTime);
          schedules.push(...taskSlots);
          
          if (taskSlots.length > 0 && task.standard_task_id === lastProductionStepId) {
            const lastSlotEnd = new Date(taskSlots[taskSlots.length - 1].end_time);
            projectLastStepEnd.set(project.id, lastSlotEnd);
          }
        }
        
        remainingHoldTasks = stillPending;
      }
      
      if (remainingHoldTasks.length > 0) {
        console.warn(`${remainingHoldTasks.length} HOLD tasks could not be scheduled for project ${project.name}`);
      }
    }
    
    // Step 6: Build completion info
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
    
    return { schedules, completions, lastProductionStepName };
  }

  /**
   * Save schedules to database with batched deletes for large datasets
   */
  async saveSchedulesToDatabase(schedules: ScheduleSlot[]): Promise<void> {
    // Filter out recurring task placeholder slots (they have non-UUID task_ids)
    const validSchedules = schedules.filter(s => !s.task_id.startsWith('recurring_'));
    if (validSchedules.length === 0) return;
    
    // Delete all existing gantt_schedules (full wipe for clean state)
    const { error: deleteError } = await supabase
      .from('gantt_schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('Error clearing gantt_schedules:', deleteError);
      throw deleteError;
    }
    
    // Build insert records (use validSchedules to exclude recurring placeholders)
    const allInserts: GanttScheduleInsert[] = validSchedules.map(s => ({
      task_id: s.task_id,
      workstation_id: s.workstation_id,
      employee_id: s.employee_id,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      end_time: s.end_time,
      worker_index: s.worker_index
    }));
    
    console.log(`Inserting ${allInserts.length} schedule entries`);
    
    // Insert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < allInserts.length; i += BATCH_SIZE) {
      const batch = allInserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('gantt_schedules')
        .insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
        throw error;
      }
    }
    
    console.log('All schedules saved successfully');
  }
}

export const automaticSchedulingService = new AutomaticSchedulingService();
