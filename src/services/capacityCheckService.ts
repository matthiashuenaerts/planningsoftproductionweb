/**
 * Capacity Check Service
 * 
 * Evaluates production capacity based on the "Last Production Step" milestone.
 * Capacity violations are calculated against the completion date of this step only,
 * ignoring any downstream logistics or post-production steps.
 */

import { supabase } from "@/integrations/supabase/client";
import { standardTasksService, StandardTask } from "./standardTasksService";
import { format, differenceInMinutes, addDays, isWeekend, getDay } from 'date-fns';

export interface CapacityWarning {
  projectId: string;
  projectName: string;
  installationDate: Date;
  expectedCompletionDate: Date | null;
  shortfall: number; // minutes of work that exceed capacity
  severity: 'warning' | 'critical';
  message: string;
}

export interface CapacityCheckResult {
  isWithinCapacity: boolean;
  warnings: CapacityWarning[];
  lastProductionStep: StandardTask | null;
  totalProductionMinutes: number;
  availableCapacityMinutes: number;
}

export const capacityCheckService = {
  /**
   * Get the last production step task
   */
  async getLastProductionStep(): Promise<StandardTask | null> {
    return standardTasksService.getLastProductionStep();
  },

  /**
   * Validate that a last production step is configured
   */
  async validateLastProductionStepExists(): Promise<{ valid: boolean; message: string }> {
    const lastStep = await this.getLastProductionStep();
    if (!lastStep) {
      return {
        valid: false,
        message: 'No "Last Production Step" is configured. Please configure one in Settings → Standard Tasks.'
      };
    }
    return { valid: true, message: '' };
  },

  /**
   * Calculate total production minutes for a project up to and including the last production step
   */
  async getProductionMinutesForProject(projectId: string): Promise<number> {
    const lastStep = await this.getLastProductionStep();
    if (!lastStep) return 0;

    // Get all tasks for the project up to the last production step
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        duration,
        standard_task_id,
        status,
        phases!inner (
          project_id
        ),
        standard_tasks (
          task_number
        )
      `)
      .eq('phases.project_id', projectId)
      .neq('status', 'COMPLETED');

    if (error) {
      console.error('Error fetching tasks for capacity check:', error);
      return 0;
    }

    // Get task order from standard tasks
    const { data: standardTasks, error: stdError } = await supabase
      .from('standard_tasks')
      .select('id, task_number')
      .order('task_number', { ascending: true });

    if (stdError) {
      console.error('Error fetching standard tasks:', stdError);
      return 0;
    }

    // Create order map
    const taskOrder = new Map<string, number>();
    standardTasks?.forEach((st, idx) => {
      taskOrder.set(st.id, idx);
    });

    const lastStepOrder = taskOrder.get(lastStep.id) ?? Infinity;

    // Sum durations only for tasks at or before the last production step
    let totalMinutes = 0;
    tasks?.forEach(task => {
      if (task.standard_task_id) {
        const order = taskOrder.get(task.standard_task_id) ?? Infinity;
        if (order <= lastStepOrder) {
          totalMinutes += task.duration || 0;
        }
      }
    });

    return totalMinutes;
  },

  /**
   * Get available capacity minutes for a date range based on working hours
   */
  async getAvailableCapacityMinutes(startDate: Date, endDate: Date): Promise<number> {
    // Fetch working hours configuration
    const { data: workingHours, error } = await supabase
      .from('working_hours')
      .select('*');

    if (error) {
      console.error('Error fetching working hours:', error);
      return 0;
    }

    // Fetch holidays
    const { data: holidays, error: holidayError } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    if (holidayError) {
      console.error('Error fetching holidays:', holidayError);
    }

    const holidaySet = new Set(holidays?.map(h => h.date) || []);

    // Fetch employees count for capacity calculation
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id')
      .neq('role', 'admin');

    if (empError) {
      console.error('Error fetching employees:', empError);
      return 0;
    }

    const workerCount = employees?.length || 1;

    // Calculate working hours map
    const workingHoursMap = new Map<number, { start_time: string; end_time: string }>();
    workingHours?.forEach(wh => {
      workingHoursMap.set(wh.day_of_week, {
        start_time: wh.start_time,
        end_time: wh.end_time
      });
    });

    // Calculate total capacity
    let totalMinutes = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = getDay(currentDate);
      const dateStr = format(currentDate, 'yyyy-MM-dd');

      if (!isWeekend(currentDate) && !holidaySet.has(dateStr)) {
        const dayConfig = workingHoursMap.get(dayOfWeek);
        if (dayConfig) {
          const [startH, startM] = dayConfig.start_time.split(':').map(Number);
          const [endH, endM] = dayConfig.end_time.split(':').map(Number);
          const dayMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          totalMinutes += dayMinutes * workerCount;
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    return totalMinutes;
  },

  /**
   * Perform comprehensive capacity check for all active projects
   */
  async checkCapacity(): Promise<CapacityCheckResult> {
    const lastStep = await this.getLastProductionStep();
    const warnings: CapacityWarning[] = [];

    if (!lastStep) {
      return {
        isWithinCapacity: false,
        warnings: [{
          projectId: '',
          projectName: 'System',
          installationDate: new Date(),
          expectedCompletionDate: null,
          shortfall: 0,
          severity: 'critical',
          message: 'No "Last Production Step" configured. Please set one in Settings → Standard Tasks.'
        }],
        lastProductionStep: null,
        totalProductionMinutes: 0,
        availableCapacityMinutes: 0
      };
    }

    // Fetch active projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, installation_date, status')
      .in('status', ['planned', 'in_progress'])
      .order('installation_date', { ascending: true });

    if (projectsError) {
      console.error('Error fetching projects for capacity check:', projectsError);
      return {
        isWithinCapacity: false,
        warnings: [],
        lastProductionStep: lastStep,
        totalProductionMinutes: 0,
        availableCapacityMinutes: 0
      };
    }

    let totalProductionMinutes = 0;
    const today = new Date();

    for (const project of projects || []) {
      const projectMinutes = await this.getProductionMinutesForProject(project.id);
      totalProductionMinutes += projectMinutes;

      const installDate = new Date(project.installation_date);
      const availableMinutes = await this.getAvailableCapacityMinutes(today, installDate);

      // Check if this specific project exceeds capacity
      if (projectMinutes > availableMinutes) {
        const shortfall = projectMinutes - availableMinutes;
        warnings.push({
          projectId: project.id,
          projectName: project.name,
          installationDate: installDate,
          expectedCompletionDate: null, // Would need scheduling to calculate
          shortfall,
          severity: shortfall > availableMinutes * 0.5 ? 'critical' : 'warning',
          message: `Project "${project.name}" requires ${Math.round(projectMinutes / 60)} hours of production work, but only ${Math.round(availableMinutes / 60)} hours are available before installation date.`
        });
      }
    }

    // Calculate overall available capacity to nearest deadline
    const nearestDeadline = projects?.[0]?.installation_date 
      ? new Date(projects[0].installation_date) 
      : addDays(today, 30);
    const availableCapacityMinutes = await this.getAvailableCapacityMinutes(today, nearestDeadline);

    return {
      isWithinCapacity: warnings.length === 0,
      warnings,
      lastProductionStep: lastStep,
      totalProductionMinutes,
      availableCapacityMinutes
    };
  },

  /**
   * Filter tasks to only include those up to and including the last production step
   * Used by the scheduling algorithm
   */
  async filterTasksForCapacityPlanning(tasks: any[]): Promise<any[]> {
    const lastStep = await this.getLastProductionStep();
    if (!lastStep) return tasks; // No filtering if not configured

    // Get standard task order
    const { data: standardTasks, error } = await supabase
      .from('standard_tasks')
      .select('id, task_number')
      .order('task_number', { ascending: true });

    if (error) {
      console.error('Error fetching standard tasks for filtering:', error);
      return tasks;
    }

    // Create order map
    const taskOrder = new Map<string, number>();
    standardTasks?.forEach((st, idx) => {
      taskOrder.set(st.id, idx);
    });

    const lastStepOrder = taskOrder.get(lastStep.id) ?? Infinity;

    // Filter tasks
    return tasks.filter(task => {
      if (!task.standard_task_id) return true; // Keep tasks without standard_task_id
      const order = taskOrder.get(task.standard_task_id) ?? Infinity;
      return order <= lastStepOrder;
    });
  }
};
