
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  team: 'production' | 'installation';
  created_at: string;
}

export const holidayService = {
  async getHolidays(): Promise<Holiday[]> {
    const { data, error } = await supabase.from('holidays').select('*');
    if (error) throw error;
    return data as Holiday[];
  },

  async addHoliday(date: Date, team: 'production' | 'installation'): Promise<Holiday> {
    const { data, error } = await supabase
      .from('holidays')
      .insert({ date: format(date, 'yyyy-MM-dd'), team })
      .select()
      .single();
    if (error) throw error;
    return data as Holiday;
  },

  async removeHoliday(date: Date, team: 'production' | 'installation'): Promise<void> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('date', format(date, 'yyyy-MM-dd'))
      .eq('team', team);
    if (error) throw error;
  },
};
