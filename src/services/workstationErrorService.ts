import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WorkstationError {
  id: string;
  workstation_id: string;
  error_message: string;
  error_type: string;
  reported_by?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  is_active: boolean;
  notes?: string;
  workstations?: {
    name: string;
  };
  reported_by_employee?: {
    name: string;
  };
  resolved_by_employee?: {
    name: string;
  };
}

export const workstationErrorService = {
  /**
   * Get active errors for a workstation
   */
  async getActiveErrors(workstationId: string): Promise<WorkstationError[]> {
    const { data, error } = await supabase
      .from('workstation_errors')
      .select(`
        *,
        workstations:workstation_id(name),
        reported_by_employee:employees!reported_by(name),
        resolved_by_employee:employees!resolved_by(name)
      `)
      .eq('workstation_id', workstationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active errors:', error);
      toast.error('Fout bij ophalen foutmeldingen');
      return [];
    }

    return data as any;
  },

  /**
   * Get all errors for a workstation (including resolved)
   */
  async getAllErrors(workstationId: string): Promise<WorkstationError[]> {
    const { data, error } = await supabase
      .from('workstation_errors')
      .select(`
        *,
        workstations:workstation_id(name),
        reported_by_employee:employees!reported_by(name),
        resolved_by_employee:employees!resolved_by(name)
      `)
      .eq('workstation_id', workstationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all errors:', error);
      toast.error('Fout bij ophalen foutmeldingen');
      return [];
    }

    return data as any;
  },

  /**
   * Get active errors across all workstations
   */
  async getAllActiveErrors(): Promise<WorkstationError[]> {
    const { data, error } = await supabase
      .from('workstation_errors')
      .select(`
        *,
        workstations:workstation_id(name),
        reported_by_employee:employees!reported_by(name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all active errors:', error);
      return [];
    }

    return data as any;
  },

  /**
   * Create a new error
   */
  async createError(
    workstationId: string,
    errorMessage: string,
    errorType: string,
    reportedBy: string,
    notes?: string
  ): Promise<WorkstationError | null> {
    const { data, error } = await supabase
      .from('workstation_errors')
      .insert({
        workstation_id: workstationId,
        error_message: errorMessage,
        error_type: errorType,
        reported_by: reportedBy,
        notes: notes,
        is_active: true,
      })
      .select(`
        *,
        workstations:workstation_id(name),
        reported_by_employee:employees!reported_by(name)
      `)
      .single();

    if (error) {
      console.error('Error creating error:', error);
      toast.error('Fout bij aanmaken foutmelding');
      return null;
    }

    toast.success('Foutmelding aangemaakt');
    return data as any;
  },

  /**
   * Resolve an error (archive it)
   */
  async resolveError(
    errorId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('workstation_errors')
      .update({
        is_active: false,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        notes: notes,
      })
      .eq('id', errorId);

    if (error) {
      console.error('Error resolving error:', error);
      toast.error('Fout bij resetten foutmelding');
      return false;
    }

    toast.success('Foutmelding gereset');
    return true;
  },

  /**
   * Check if workstation has active errors
   */
  async hasActiveErrors(workstationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('workstation_errors')
      .select('id')
      .eq('workstation_id', workstationId)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error checking for active errors:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  },
};
