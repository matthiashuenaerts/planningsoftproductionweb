import { supabase } from '@/integrations/supabase/client';

export interface WorkingHours {
  id: string;
  team: 'production' | 'installation' | 'preparation';
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  break_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const workingHoursService = {
  async getWorkingHours(): Promise<WorkingHours[]> {
    const { data, error } = await supabase
      .from('working_hours')
      .select('*')
      .eq('is_active', true)
      .order('team')
      .order('day_of_week');
    if (error) throw error;
    return data as WorkingHours[];
  },

  async upsertWorkingHours(workingHours: Omit<WorkingHours, 'id' | 'created_at' | 'updated_at'>): Promise<WorkingHours> {
    const { data, error } = await supabase
      .from('working_hours')
      .upsert(
        {
          team: workingHours.team,
          day_of_week: workingHours.day_of_week,
          start_time: workingHours.start_time,
          end_time: workingHours.end_time,
          break_minutes: workingHours.break_minutes,
          is_active: workingHours.is_active,
        },
        {
          onConflict: 'team,day_of_week',
        }
      )
      .select()
      .single();
    if (error) throw error;
    return data as WorkingHours;
  },

  async deleteWorkingHours(id: string): Promise<void> {
    const { error } = await supabase.from('working_hours').delete().eq('id', id);
    if (error) throw error;
  },

  // Helper to get working hours for a specific team and day
  getWorkingHoursForDay(
    allWorkingHours: WorkingHours[],
    team: 'production' | 'installation' | 'preparation',
    dayOfWeek: number
  ): WorkingHours | null {
    return allWorkingHours.find((wh) => wh.team === team && wh.day_of_week === dayOfWeek) || null;
  },
};