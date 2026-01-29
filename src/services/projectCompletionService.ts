import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { ProjectCompletionInfo } from '@/components/WorkstationGanttChart';

export interface ProjectCompletionData extends ProjectCompletionInfo {
  id?: string;
  lastProductionStepName?: string | null;
  generatedAt?: Date;
}

interface DbProjectCompletionRow {
  id: string;
  project_id: string;
  project_name: string;
  client: string | null;
  installation_date: string;
  last_production_step_end: string | null;
  status: string;
  days_remaining: number;
  last_production_step_name: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export const projectCompletionService = {
  /**
   * Save completion data after planning generation
   * Clears all existing data and inserts new data
   */
  async saveCompletionData(data: ProjectCompletionInfo[], lastProductionStepName: string | null): Promise<void> {
    try {
      // First, clear all existing completion data
      await supabase
        .from('project_production_completion')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      
      if (data.length === 0) return;
      
      // Insert new completion data
      const insertData = data.map(item => ({
        project_id: item.projectId,
        project_name: item.projectName,
        client: item.client,
        installation_date: item.installationDate.toISOString(),
        last_production_step_end: item.lastProductionStepEnd?.toISOString() || null,
        status: item.status,
        days_remaining: item.daysRemaining,
        last_production_step_name: lastProductionStepName,
        generated_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('project_production_completion')
        .insert(insertData);
      
      if (error) {
        console.error('Error saving completion data:', error);
        throw error;
      }
      
      console.log(`✅ Saved ${data.length} project completion records to database`);
    } catch (error) {
      console.error('Error in saveCompletionData:', error);
      throw error;
    }
  },

  /**
   * Get latest completion data for display
   */
  async getCompletionData(): Promise<{ data: ProjectCompletionData[]; lastProductionStepName: string | null }> {
    try {
      const { data, error } = await supabase
        .from('project_production_completion')
        .select('*')
        .order('installation_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching completion data:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return { data: [], lastProductionStepName: null };
      }
      
      const rows = data as DbProjectCompletionRow[];
      const lastProductionStepName = rows[0]?.last_production_step_name || null;
      
      const completionData: ProjectCompletionData[] = rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        client: row.client,
        installationDate: new Date(row.installation_date),
        lastProductionStepEnd: row.last_production_step_end ? new Date(row.last_production_step_end) : null,
        status: row.status as ProjectCompletionData['status'],
        daysRemaining: row.days_remaining,
        lastProductionStepName: row.last_production_step_name,
        generatedAt: new Date(row.generated_at),
      }));
      
      return { data: completionData, lastProductionStepName };
    } catch (error) {
      console.error('Error in getCompletionData:', error);
      return { data: [], lastProductionStepName: null };
    }
  },

  /**
   * Clear all completion data
   */
  async clearCompletionData(): Promise<void> {
    try {
      const { error } = await supabase
        .from('project_production_completion')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.error('Error clearing completion data:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in clearCompletionData:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for completion data
   */
  subscribeToCompletionData(callback: (payload: any) => void): RealtimeChannel {
    const channel = supabase
      .channel('project_production_completion_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_production_completion',
        },
        callback
      )
      .subscribe();
    
    return channel;
  },

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromCompletionData(channel: RealtimeChannel): void {
    supabase.removeChannel(channel);
  },
};
