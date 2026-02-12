
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { applyTenantFilter } from '@/lib/tenantQuery';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  team: 'production' | 'installation';
  created_at: string;
}

export const holidayService = {
  async getHolidays(tenantId?: string | null): Promise<Holiday[]> {
    let query = supabase.from('holidays').select('*');
    query = applyTenantFilter(query, tenantId);
    const { data, error } = await query;
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
