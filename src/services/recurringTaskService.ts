import { supabase } from '@/integrations/supabase/client';

export interface RecurringTaskSchedule {
  id: string;
  standard_task_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // e.g. '08:00'
  end_time: string; // e.g. '09:30'
  employee_ids: string[];
  workstation_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskScheduleInsert {
  standard_task_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  employee_ids: string[];
  workstation_id?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export const recurringTaskService = {
  async getAll(): Promise<RecurringTaskSchedule[]> {
    const { data, error } = await supabase
      .from('recurring_task_schedules')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching recurring task schedules:', error);
      throw error;
    }

    return (data || []) as unknown as RecurringTaskSchedule[];
  },

  async getActiveForDay(dayOfWeek: number): Promise<RecurringTaskSchedule[]> {
    const { data, error } = await supabase
      .from('recurring_task_schedules')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching active recurring tasks for day:', error);
      throw error;
    }

    return (data || []) as unknown as RecurringTaskSchedule[];
  },

  async create(schedule: RecurringTaskScheduleInsert): Promise<RecurringTaskSchedule> {
    const { data, error } = await supabase
      .from('recurring_task_schedules')
      .insert(schedule as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating recurring task schedule:', error);
      throw error;
    }

    return data as unknown as RecurringTaskSchedule;
  },

  async update(id: string, updates: Partial<RecurringTaskScheduleInsert>): Promise<RecurringTaskSchedule> {
    const { data, error } = await supabase
      .from('recurring_task_schedules')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recurring task schedule:', error);
      throw error;
    }

    return data as unknown as RecurringTaskSchedule;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('recurring_task_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting recurring task schedule:', error);
      throw error;
    }
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('recurring_task_schedules')
      .update({ is_active: isActive } as any)
      .eq('id', id);

    if (error) {
      console.error('Error toggling recurring task schedule:', error);
      throw error;
    }
  }
};
