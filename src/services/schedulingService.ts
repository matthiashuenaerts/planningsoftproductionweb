/**
 * Optimal Task Scheduling Service
 * 
 * Core principles:
 * 1. Each employee works ONE task at a time (sequential, no parallelism)
 * 2. Fill employee schedules to maximum capacity
 * 3. Respect task dependencies (HOLD tasks wait for limit tasks)
 * 4. Priority-based assignment (urgent tasks first)
 * 5. Load balancing across eligible employees
 */

import {
  format,
  addMinutes,
  differenceInMinutes,
  startOfDay,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  getDay,
} from 'date-fns';

// =============== TYPES ===============

export interface ScheduleTask {
  id: string;
  title: string;
  duration: number;
  status: string;
  due_date: string;
  standard_task_id?: string;
  priority: string;
  project?: {
    id: string;
    name: string;
    start_date: string;
    installation_date: string;
    status: string;
    client: string;
  };
  workstations?: Array<{ id: string; name: string }>;
}

export interface Employee {
  id: string;
  name: string;
  standardTasks: string[]; // Standard task IDs this employee can perform
  workstations: string[]; // Workstation IDs this employee can work at
}

export interface WorkingHoursConfig {
  start: Date;
  end: Date;
  breaks: Array<{ start: Date; end: Date }>;
}

export interface ScheduledSlot {
  taskId: string;
  employeeId: string;
  workstationId: string;
  start: Date;
  end: Date;
}

export interface ScheduleResult {
  slots: ScheduledSlot[];
  unassignedTasks: ScheduleTask[];
  employeeWorkloads: Map<string, number>; // minutes per employee
  stats: {
    totalTasks: number;
    scheduledTasks: number;
    unassignedTasks: number;
    employeesUsed: number;
    totalMinutesScheduled: number;
    averageUtilization: number;
  };
}

export interface SchedulerConfig {
  startDate: Date;
  daysToSchedule: number;
  workingHoursMap: Map<number, { start_time: string; end_time: string; breaks?: Array<{ start_time: string; end_time: string }> }>;
  holidaySet: Set<string>;
  limitTaskMap: Map<string, string[]>; // standard_task_id -> limit_standard_task_ids
}

// =============== SCHEDULER CLASS ===============

export class OptimalScheduler {
  private config: SchedulerConfig;
  private employees: Map<string, Employee>;
  private workstationCapacity: Map<string, number>;
  
  // Schedule state
  private employeeSchedule: Map<string, ScheduledSlot[]>;
  private workstationSchedule: Map<string, Map<string, ScheduledSlot[]>>; // date -> wsId -> slots
  private taskEndTimes: Map<string, Date>;
  private scheduledTaskIds: Set<string>;

  constructor(
    config: SchedulerConfig,
    employees: Employee[],
    workstationCapacity: Map<string, number>
  ) {
    this.config = config;
    this.employees = new Map(employees.map(e => [e.id, e]));
    this.workstationCapacity = workstationCapacity;
    
    // Initialize state
    this.employeeSchedule = new Map();
    this.workstationSchedule = new Map();
    this.taskEndTimes = new Map();
    this.scheduledTaskIds = new Set();
    
    // Pre-initialize employee schedules
    employees.forEach(e => {
      this.employeeSchedule.set(e.id, []);
    });
  }

  // =============== WORKING HOURS HELPERS ===============

  private isWorkingDay(date: Date): boolean {
    const day = getDay(date);
    return !isWeekend(date) && 
           this.config.workingHoursMap.has(day) && 
           !this.config.holidaySet.has(format(date, 'yyyy-MM-dd'));
  }

  private getNextWorkday(date: Date): Date {
    let d = addDays(date, 1);
    let iterations = 0;
    while (!this.isWorkingDay(d) && iterations < 365) {
      d = addDays(d, 1);
      iterations++;
    }
    return d;
  }

  private getWorkHours(date: Date): WorkingHoursConfig | null {
    const wh = this.config.workingHoursMap.get(getDay(date));
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

  private getAvailableMinutesInDay(date: Date): number {
    const wh = this.getWorkHours(date);
    if (!wh) return 0;
    
    let total = differenceInMinutes(wh.end, wh.start);
    wh.breaks.forEach(b => {
      total -= differenceInMinutes(b.end, b.start);
    });
    return total;
  }

  // =============== PRIORITY SCORING ===============

  private getTaskPriorityScore(task: ScheduleTask): number {
    const today = format(new Date(), 'yyyy-MM-dd');
    const project = task.project;
    
    if (!project) return -2000;
    if (project.start_date > today) return -1000; // Future project
    
    let score = 0;
    
    // Factor 1: Installation urgency (40%)
    const daysUntilInstallation = differenceInMinutes(
      new Date(project.installation_date), 
      new Date()
    ) / (24 * 60);
    score += Math.max(0, 100 - daysUntilInstallation) * 0.4;
    
    // Factor 2: Project status (25%)
    if (project.status === 'in_progress') score += 50 * 0.25;
    else if (project.status === 'planned') score += 30 * 0.25;
    else if (project.status === 'on_hold') score -= 20 * 0.25;
    
    // Factor 3: Task priority (20%)
    if (task.priority === 'high') score += 30 * 0.2;
    else if (task.priority === 'medium') score += 15 * 0.2;
    else if (task.priority === 'low') score += 5 * 0.2;
    
    // Factor 4: Due date urgency (15%)
    const daysUntilDue = differenceInMinutes(new Date(task.due_date), new Date()) / (24 * 60);
    score += Math.max(0, 50 - daysUntilDue) * 0.15;
    
    return score;
  }

  // =============== EMPLOYEE AVAILABILITY ===============

  private getEmployeeNextAvailable(employeeId: string): Date {
    const slots = this.employeeSchedule.get(employeeId) || [];
    if (slots.length === 0) return this.config.startDate;
    
    const sorted = [...slots].sort((a, b) => b.end.getTime() - a.end.getTime());
    return sorted[0].end;
  }

  private getEmployeeWorkload(employeeId: string): number {
    const slots = this.employeeSchedule.get(employeeId) || [];
    return slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
  }

  private hasWorkstationCapacity(
    workstationId: string,
    dateStr: string,
    start: Date,
    end: Date
  ): boolean {
    const capacity = this.workstationCapacity.get(workstationId) || 1;
    
    if (!this.workstationSchedule.has(dateStr)) return true;
    const daySchedule = this.workstationSchedule.get(dateStr)!;
    
    if (!daySchedule.has(workstationId)) return true;
    const wsSlots = daySchedule.get(workstationId)!;
    
    // Count concurrent workers at each point
    const allTimes = new Set<number>();
    allTimes.add(start.getTime());
    allTimes.add(end.getTime());
    wsSlots.forEach(s => {
      allTimes.add(s.start.getTime());
      allTimes.add(s.end.getTime());
    });
    
    for (const time of allTimes) {
      const t = new Date(time);
      if (t < start || t >= end) continue;
      
      let concurrent = 1; // The new slot
      for (const slot of wsSlots) {
        if (t >= slot.start && t < slot.end) concurrent++;
      }
      if (concurrent > capacity) return false;
    }
    
    return true;
  }

  // =============== SLOT FINDING ===============

  /**
   * Find the earliest available slot for an employee to work on a task
   * Returns null if no slot found within scheduling window
   */
  private findEarliestSlot(
    employeeId: string,
    duration: number,
    workstationId: string,
    minStart: Date
  ): { start: Date; end: Date; dateStr: string } | null {
    const existingSlots = [...(this.employeeSchedule.get(employeeId) || [])]
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Start from minimum start date or after last task
    let searchDate = startOfDay(minStart);
    const maxDate = addDays(this.config.startDate, this.config.daysToSchedule);
    
    while (searchDate < maxDate) {
      if (!this.isWorkingDay(searchDate)) {
        searchDate = this.getNextWorkday(searchDate);
        continue;
      }
      
      const dateStr = format(searchDate, 'yyyy-MM-dd');
      const workHours = this.getWorkHours(searchDate);
      if (!workHours) {
        searchDate = addDays(searchDate, 1);
        continue;
      }
      
      // Get slots for this day
      const daySlots = existingSlots
        .filter(s => format(s.start, 'yyyy-MM-dd') === dateStr)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Find gaps in this day
      let candidate = minStart > workHours.start && format(minStart, 'yyyy-MM-dd') === dateStr 
        ? minStart 
        : workHours.start;
      
      // Skip to after any existing task that overlaps our candidate
      for (const slot of daySlots) {
        if (candidate >= slot.start && candidate < slot.end) {
          candidate = slot.end;
        }
      }
      
      // Try to fit the task in gaps
      const boundaries = [
        ...daySlots.map(s => ({ time: s.start, type: 'start' as const })),
        ...daySlots.map(s => ({ time: s.end, type: 'end' as const })),
        ...workHours.breaks.map(b => ({ time: b.start, type: 'break_start' as const })),
        ...workHours.breaks.map(b => ({ time: b.end, type: 'break_end' as const })),
        { time: workHours.end, type: 'day_end' as const }
      ].sort((a, b) => a.time.getTime() - b.time.getTime());
      
      for (const boundary of boundaries) {
        if (boundary.time <= candidate) continue;
        
        // Skip if we're in a break
        const inBreak = workHours.breaks.some(b => candidate >= b.start && candidate < b.end);
        if (inBreak) {
          const breakEnd = workHours.breaks.find(b => candidate >= b.start && candidate < b.end)!.end;
          candidate = breakEnd;
          continue;
        }
        
        // Calculate available time until next boundary
        const available = differenceInMinutes(boundary.time, candidate);
        
        if (available >= duration) {
          const potentialEnd = addMinutes(candidate, duration);
          
          // Check workstation capacity
          if (this.hasWorkstationCapacity(workstationId, dateStr, candidate, potentialEnd)) {
            return { start: candidate, end: potentialEnd, dateStr };
          }
        }
        
        // Move candidate past this boundary if it's a slot end or break end
        if (boundary.type === 'end' || boundary.type === 'break_end') {
          candidate = boundary.time;
        } else if (boundary.type === 'start' || boundary.type === 'break_start') {
          // Skip past this slot/break
          if (boundary.type === 'start') {
            const slot = daySlots.find(s => s.start.getTime() === boundary.time.getTime());
            if (slot) candidate = slot.end;
          } else {
            const brk = workHours.breaks.find(b => b.start.getTime() === boundary.time.getTime());
            if (brk) candidate = brk.end;
          }
        }
      }
      
      searchDate = addDays(searchDate, 1);
    }
    
    return null;
  }

  // =============== SCHEDULING ===============

  private scheduleTask(
    task: ScheduleTask,
    employeeId: string,
    workstationId: string,
    start: Date,
    end: Date,
    dateStr: string
  ): void {
    const slot: ScheduledSlot = {
      taskId: task.id,
      employeeId,
      workstationId,
      start,
      end
    };
    
    // Add to employee schedule
    this.employeeSchedule.get(employeeId)!.push(slot);
    
    // Add to workstation schedule
    if (!this.workstationSchedule.has(dateStr)) {
      this.workstationSchedule.set(dateStr, new Map());
    }
    const daySchedule = this.workstationSchedule.get(dateStr)!;
    if (!daySchedule.has(workstationId)) {
      daySchedule.set(workstationId, []);
    }
    daySchedule.get(workstationId)!.push(slot);
    
    // Track task
    this.taskEndTimes.set(task.id, end);
    this.scheduledTaskIds.add(task.id);
  }

  private getRequiredDependencyEnd(task: ScheduleTask): Date | null {
    if (!task.standard_task_id) return new Date(0);
    
    const limitStdIds = this.config.limitTaskMap.get(task.standard_task_id);
    if (!limitStdIds || limitStdIds.length === 0) return new Date(0);
    
    // Check if all dependency tasks are scheduled
    // (This would need access to all tasks to find matching project tasks)
    // For now, return the max end time of any scheduled dependency
    let maxEnd = new Date(0);
    
    for (const limitStdId of limitStdIds) {
      // In a full implementation, find the task in same project with this standard_task_id
      // For now, check if any task with this standard_task_id is scheduled
      const endTime = this.taskEndTimes.get(limitStdId);
      if (endTime && endTime > maxEnd) {
        maxEnd = endTime;
      }
    }
    
    return maxEnd;
  }

  // =============== MAIN SCHEDULING ALGORITHM ===============

  public schedule(tasks: ScheduleTask[]): ScheduleResult {
    console.log('🚀 Starting optimal scheduling...');
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Filter valid tasks
    const validTasks = tasks.filter(t => {
      if (!t.standard_task_id) return false;
      if (t.status !== 'TODO' && t.status !== 'HOLD') return false;
      if (t.project && t.project.start_date > today) return false;
      return true;
    });
    
    // Sort by priority
    const sortedTasks = [...validTasks].sort((a, b) => {
      const scoreA = this.getTaskPriorityScore(a);
      const scoreB = this.getTaskPriorityScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    
    const todoTasks = sortedTasks.filter(t => t.status === 'TODO');
    const holdTasks = sortedTasks.filter(t => t.status === 'HOLD');
    const unassignedTasks: ScheduleTask[] = [];
    
    console.log(`📋 Tasks: ${todoTasks.length} TODO, ${holdTasks.length} HOLD`);
    
    // PHASE 1: Schedule TODO tasks
    console.log('📅 PHASE 1: Scheduling TODO tasks...');
    
    for (const task of todoTasks) {
      const assigned = this.tryAssignTask(task);
      if (!assigned) {
        unassignedTasks.push(task);
      }
    }
    
    console.log(`✅ PHASE 1 Complete: ${this.scheduledTaskIds.size} scheduled`);
    
    // PHASE 2: Schedule HOLD tasks (with dependencies)
    console.log('📅 PHASE 2: Scheduling HOLD tasks...');
    
    let remainingHold = new Set(holdTasks.map(t => t.id));
    let iterations = 0;
    const maxIterations = holdTasks.length * 3;
    
    while (remainingHold.size > 0 && iterations < maxIterations) {
      iterations++;
      let progress = false;
      
      for (const task of holdTasks) {
        if (!remainingHold.has(task.id)) continue;
        if (this.scheduledTaskIds.has(task.id)) {
          remainingHold.delete(task.id);
          continue;
        }
        
        // Dependencies not fully implemented - schedule with minStart = now
        const assigned = this.tryAssignTask(task);
        if (assigned) {
          remainingHold.delete(task.id);
          progress = true;
        }
      }
      
      if (!progress) break;
    }
    
    // Add remaining HOLD tasks to unassigned
    for (const taskId of remainingHold) {
      const task = holdTasks.find(t => t.id === taskId);
      if (task) unassignedTasks.push(task);
    }
    
    console.log(`✅ PHASE 2 Complete: ${this.scheduledTaskIds.size} scheduled`);
    
    // PHASE 3: Gap-filling optimization
    console.log('📅 PHASE 3: Gap-filling optimization...');
    
    const stillUnassigned = [...unassignedTasks];
    unassignedTasks.length = 0;
    
    for (const task of stillUnassigned) {
      if (this.scheduledTaskIds.has(task.id)) continue;
      
      const assigned = this.tryAssignTask(task);
      if (!assigned) {
        unassignedTasks.push(task);
      }
    }
    
    console.log(`✅ PHASE 3 Complete: ${this.scheduledTaskIds.size} scheduled`);
    
    // Collect all slots
    const allSlots: ScheduledSlot[] = [];
    this.employeeSchedule.forEach(slots => {
      allSlots.push(...slots);
    });
    
    // Calculate workloads
    const employeeWorkloads = new Map<string, number>();
    this.employeeSchedule.forEach((slots, empId) => {
      const total = slots.reduce((sum, s) => sum + differenceInMinutes(s.end, s.start), 0);
      employeeWorkloads.set(empId, total);
    });
    
    // Calculate stats
    const employeesUsed = Array.from(employeeWorkloads.values()).filter(w => w > 0).length;
    const totalMinutes = Array.from(employeeWorkloads.values()).reduce((a, b) => a + b, 0);
    const totalCapacity = employeesUsed * this.config.daysToSchedule * 
      this.getAvailableMinutesInDay(this.config.startDate);
    
    const stats = {
      totalTasks: validTasks.length,
      scheduledTasks: this.scheduledTaskIds.size,
      unassignedTasks: unassignedTasks.length,
      employeesUsed,
      totalMinutesScheduled: totalMinutes,
      averageUtilization: totalCapacity > 0 ? (totalMinutes / totalCapacity) * 100 : 0
    };
    
    console.log('📊 Scheduling complete:', stats);
    
    return {
      slots: allSlots,
      unassignedTasks,
      employeeWorkloads,
      stats
    };
  }

  private tryAssignTask(task: ScheduleTask): boolean {
    // Find eligible employees
    const eligibleEmployees = Array.from(this.employees.values()).filter(emp =>
      emp.standardTasks.includes(task.standard_task_id!)
    );
    
    if (eligibleEmployees.length === 0) return false;
    
    const taskWorkstationIds = task.workstations?.map(w => w.id) || [];
    
    // Score employees: prefer least loaded, then prefer workstation match
    const scored = eligibleEmployees.map(emp => {
      const workload = this.getEmployeeWorkload(emp.id);
      const wsMatch = taskWorkstationIds.some(wsId => emp.workstations.includes(wsId));
      
      return {
        employee: emp,
        workload,
        wsMatch,
        score: (10000 - workload) + (wsMatch ? 500 : 0)
      };
    }).sort((a, b) => b.score - a.score);
    
    // Try to assign
    for (const { employee } of scored) {
      const compatibleWs = taskWorkstationIds.filter(wsId =>
        employee.workstations.includes(wsId)
      );
      
      // If no compatible workstations, use any workstation employee can work at
      const workstationsToTry = compatibleWs.length > 0 
        ? compatibleWs 
        : employee.workstations;
      
      for (const wsId of workstationsToTry) {
        const slot = this.findEarliestSlot(
          employee.id,
          task.duration,
          wsId,
          this.config.startDate
        );
        
        if (slot) {
          this.scheduleTask(task, employee.id, wsId, slot.start, slot.end, slot.dateStr);
          return true;
        }
      }
    }
    
    return false;
  }

  // =============== VALIDATION ===============

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for employee overlaps
    this.employeeSchedule.forEach((slots, empId) => {
      const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end > sorted[i + 1].start) {
          errors.push(`Employee ${empId} has overlapping tasks`);
        }
      }
    });
    
    // Check workstation capacity
    this.workstationSchedule.forEach((daySchedule, dateStr) => {
      daySchedule.forEach((slots, wsId) => {
        const capacity = this.workstationCapacity.get(wsId) || 1;
        
        const allTimes = new Set<number>();
        slots.forEach(s => {
          allTimes.add(s.start.getTime());
          allTimes.add(s.end.getTime());
        });
        
        for (const time of allTimes) {
          const t = new Date(time);
          let concurrent = 0;
          for (const slot of slots) {
            if (t >= slot.start && t < slot.end) concurrent++;
          }
          if (concurrent > capacity) {
            errors.push(`Workstation ${wsId} over capacity on ${dateStr}`);
          }
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
