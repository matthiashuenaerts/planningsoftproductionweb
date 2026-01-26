import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface GanttSchedule {
  id: string;
  task_id: string;
  workstation_id: string;
  employee_id: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  worker_index: number;
  created_at: string;
  updated_at: string;
}

export interface GanttScheduleInsert {
  task_id: string;
  workstation_id: string;
  employee_id: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  worker_index: number;
}

export const ganttScheduleService = {
  // Get schedules for a specific date
  async getSchedulesForDate(date: Date): Promise<GanttSchedule[]> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('gantt_schedules')
      .select('*')
      .eq('scheduled_date', dateStr)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching gantt schedules:', error);
      throw error;
    }

    return data || [];
  },

  // Get schedules with related data for a date
  async getSchedulesWithDetailsForDate(date: Date): Promise<any[]> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('gantt_schedules')
      .select(`
        *,
        tasks (
          id, title, description, duration, status, due_date, phase_id, standard_task_id, priority,
          phases (
            name,
            projects (id, name, start_date, installation_date, status, client)
          )
        ),
        workstations (id, name),
        employees (id, name)
      `)
      .eq('scheduled_date', dateStr)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching gantt schedules with details:', error);
      throw error;
    }

    return data || [];
  },

  // Get all schedules (for multiple days)
  async getSchedulesForDateRange(startDate: Date, endDate: Date): Promise<GanttSchedule[]> {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('gantt_schedules')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching gantt schedules:', error);
      throw error;
    }

    return data || [];
  },

  // Save schedules for a date (replaces existing)
  async saveSchedulesForDate(date: Date, schedules: GanttScheduleInsert[]): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');

    // First, delete existing schedules for this date
    const { error: deleteError } = await supabase
      .from('gantt_schedules')
      .delete()
      .eq('scheduled_date', dateStr);

    if (deleteError) {
      console.error('Error deleting old schedules:', deleteError);
      throw deleteError;
    }

    // Then insert new schedules
    if (schedules.length > 0) {
      const { error: insertError } = await supabase
        .from('gantt_schedules')
        .insert(schedules);

      if (insertError) {
        console.error('Error inserting schedules:', insertError);
        throw insertError;
      }
    }
  },

  // Upsert multiple schedules
  async upsertSchedules(schedules: GanttScheduleInsert[]): Promise<void> {
    if (schedules.length === 0) return;

    // Group by date and save
    const byDate = new Map<string, GanttScheduleInsert[]>();
    schedules.forEach(s => {
      if (!byDate.has(s.scheduled_date)) {
        byDate.set(s.scheduled_date, []);
      }
      byDate.get(s.scheduled_date)!.push(s);
    });

    for (const [dateStr, dateSchedules] of byDate) {
      // Delete existing for this date first
      await supabase
        .from('gantt_schedules')
        .delete()
        .eq('scheduled_date', dateStr);

      // Insert new
      const { error } = await supabase
        .from('gantt_schedules')
        .insert(dateSchedules);

      if (error) {
        console.error('Error upserting schedules:', error);
        throw error;
      }
    }
  },

  // Delete all schedules for a date
  async deleteSchedulesForDate(date: Date): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const { error } = await supabase
      .from('gantt_schedules')
      .delete()
      .eq('scheduled_date', dateStr);

    if (error) {
      console.error('Error deleting schedules:', error);
      throw error;
    }
  },

  // Delete a single schedule
  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('gantt_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  },

  // Update a single schedule
  async updateSchedule(id: string, updates: Partial<GanttScheduleInsert>): Promise<void> {
    const { error } = await supabase
      .from('gantt_schedules')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  },

  // Subscribe to real-time updates
  subscribeToSchedules(date: Date, callback: (payload: any) => void) {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return supabase
      .channel(`gantt_schedules_${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gantt_schedules',
          filter: `scheduled_date=eq.${dateStr}`
        },
        callback
      )
      .subscribe();
  },

  // Unsubscribe from real-time updates
  unsubscribeFromSchedules(channel: any) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }
};
