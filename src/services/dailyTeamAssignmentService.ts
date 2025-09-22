import { supabase } from '@/integrations/supabase/client';

export interface DailyTeamAssignment {
  id: string;
  employee_id: string;
  team_id: string;
  date: string;
  is_available: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export class DailyTeamAssignmentService {
  async getAssignmentsForDateRange(startDate: string, endDate: string): Promise<DailyTeamAssignment[]> {
    const { data, error } = await supabase
      .from('daily_team_assignments' as any)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) throw error;
    return (data as any) || [];
  }

  async getAssignmentsForProjectDate(projectId: string, date: string): Promise<DailyTeamAssignment[]> {
    // First get the team assigned to this project
    const { data: projectAssignment, error: projectError } = await supabase
      .from('project_team_assignments' as any)
      .select('team')
      .eq('project_id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;

    if (!projectAssignment) {
      return []; // No team assignment found
    }

    // Then get team members assigned for this date
    const { data: teamData, error: teamError } = await supabase
      .from('placement_teams' as any)
      .select('id')
      .eq('name', (projectAssignment as any).team)
      .maybeSingle();

    if (teamError) throw teamError;

    if (!teamData) {
      return []; // Team not found
    }

    const { data, error } = await supabase
      .from('daily_team_assignments' as any)
      .select('*')
      .eq('team_id', (teamData as any).id)
      .eq('date', date);

    if (error) throw error;
    return (data as any) || [];
  }

  async assignEmployeeToTeamForDate(
    employeeId: string, 
    teamId: string, 
    date: string,
    isAvailable: boolean = true,
    notes?: string
  ): Promise<DailyTeamAssignment> {
    // Check if assignment already exists
    const { data: existing, error: checkError } = await supabase
      .from('daily_team_assignments' as any)
      .select('*')
      .eq('employee_id', employeeId)
      .eq('team_id', teamId)
      .eq('date', date)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw checkError;
    }

    if (existing) {
      // Update existing assignment
      const { data, error } = await supabase
        .from('daily_team_assignments' as any)
        .update({ 
          is_available: isAvailable,
          notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', (existing as any).id)
        .select()
        .single();

      if (error) throw error;
      return data as any;
    } else {
      // Create new assignment
      const { data, error } = await supabase
        .from('daily_team_assignments' as any)
        .insert({
          employee_id: employeeId,
          team_id: teamId,
          date: date,
          is_available: isAvailable,
          notes: notes
        })
        .select()
        .single();

      if (error) throw error;
      return data as any;
    }
  }

  async removeEmployeeFromTeamForDate(employeeId: string, teamId: string, date: string): Promise<void> {
    const { error } = await supabase
      .from('daily_team_assignments' as any)
      .delete()
      .eq('employee_id', employeeId)
      .eq('team_id', teamId)
      .eq('date', date);

    if (error) throw error;
  }

  async getAvailableEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role, email')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async getTeamMembers(teamId: string): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('placement_team_members' as any)
      .select(`
        employee_id,
        employees!inner(id, name, role, email)
      `)
      .eq('team_id', teamId);

    if (error) throw error;
    return (data as any)?.map((item: any) => item.employees) || [];
  }
}

export const dailyTeamAssignmentService = new DailyTeamAssignmentService();