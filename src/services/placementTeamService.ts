import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface PlacementTeam {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  employee_id: string;
  is_default: boolean;
  created_at: string;
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface DailyTeamAssignment {
  id: string;
  team_id: string;
  employee_id: string;
  date: string;
  is_available: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  team: PlacementTeam;
}

export interface TeamWithMembers extends PlacementTeam {
  members: TeamMember[];
  dailyAssignments?: DailyTeamAssignment[];
}

export const placementTeamService = {
  // Get all placement teams
  async getTeams(): Promise<PlacementTeam[]> {
    const { data, error } = await (supabase as any)
      .from('placement_teams')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return (data || []) as PlacementTeam[];
  },

  // Get team with members
  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
    const { data: team, error: teamError } = await (supabase as any)
      .from('placement_teams')
      .select('*')
      .eq('id', teamId)
      .single();
    
    if (teamError) throw teamError;
    if (!team) return null;

    const { data: members, error: membersError } = await (supabase as any)
      .from('placement_team_members')
      .select(`
        *,
        employee:employees(id, name, email, role)
      `)
      .eq('team_id', teamId)
      .order('is_default', { ascending: false });
    
    if (membersError) throw membersError;

    return {
      ...(team as PlacementTeam),
      members: (members || []) as TeamMember[]
    };
  },

  // Get all teams with their members
  async getTeamsWithMembers(): Promise<TeamWithMembers[]> {
    const { data: teams, error: teamsError } = await (supabase as any)
      .from('placement_teams')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (teamsError) throw teamsError;

    const teamsWithMembers = await Promise.all(
      ((teams || []) as PlacementTeam[]).map(async (team) => {
        const { data: members, error: membersError } = await (supabase as any)
          .from('placement_team_members')
          .select(`
            *,
            employee:employees(id, name, email, role)
          `)
          .eq('team_id', team.id)
          .order('is_default', { ascending: false });
        
        if (membersError) throw membersError;

        return {
          ...team,
          members: (members || []) as TeamMember[]
        };
      })
    );

    return teamsWithMembers;
  },

  // Get daily assignments for a specific date
  async getDailyAssignments(date: Date): Promise<DailyTeamAssignment[]> {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await (supabase as any)
      .from('daily_team_assignments')
      .select(`
        *,
        employee:employees(id, name, email, role),
        team:placement_teams(*)
      `)
      .eq('date', dateStr);
    
    if (error) throw error;
    return (data || []) as DailyTeamAssignment[];
  },

  // Get daily assignments for a date range
  async getDailyAssignmentsRange(startDate: Date, endDate: Date): Promise<DailyTeamAssignment[]> {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    
    const { data, error } = await (supabase as any)
      .from('daily_team_assignments')
      .select(`
        *,
        employee:employees(id, name, email, role),
        team:placement_teams(*)
      `)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date');
    
    if (error) throw error;
    return (data || []) as DailyTeamAssignment[];
  },

  // Create or update daily team assignment
  async upsertDailyAssignment(assignment: {
    team_id: string;
    employee_id: string;
    date: Date;
    is_available: boolean;
    notes?: string;
  }): Promise<DailyTeamAssignment> {
    const dateStr = format(assignment.date, 'yyyy-MM-dd');
    
    const { data, error } = await (supabase as any)
      .from('daily_team_assignments')
      .upsert({
        team_id: assignment.team_id,
        employee_id: assignment.employee_id,
        date: dateStr,
        is_available: assignment.is_available,
        notes: assignment.notes
      }, {
        onConflict: 'team_id,employee_id,date'
      })
      .select(`
        *,
        employee:employees(id, name, email, role),
        team:placement_teams(*)
      `)
      .single();
    
    if (error) throw error;
    return data as DailyTeamAssignment;
  },

  // Remove employee from team for a specific date
  async removeDailyAssignment(teamId: string, employeeId: string, date: Date): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const { error } = await (supabase as any)
      .from('daily_team_assignments')
      .delete()
      .eq('team_id', teamId)
      .eq('employee_id', employeeId)
      .eq('date', dateStr);
    
    if (error) throw error;
  },

  // Add team member
  async addTeamMember(teamId: string, employeeId: string, isDefault: boolean = false): Promise<TeamMember> {
    const { data, error } = await (supabase as any)
      .from('placement_team_members')
      .insert({
        team_id: teamId,
        employee_id: employeeId,
        is_default: isDefault
      })
      .select(`
        *,
        employee:employees(id, name, email, role)
      `)
      .single();
    
    if (error) throw error;
    return data as TeamMember;
  },

  // Remove team member
  async removeTeamMember(teamId: string, employeeId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('placement_team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('employee_id', employeeId);
    
    if (error) throw error;
  },

  // Check if employee is on holiday
  async isEmployeeOnHoliday(employeeId: string, date: Date): Promise<boolean> {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('holiday_requests')
      .select('*')
      .eq('user_id', employeeId)
      .eq('status', 'approved')
      .lte('start_date', dateStr)
      .gte('end_date', dateStr);
    
    if (error) throw error;
    return (data || []).length > 0;
  },

  // Generate default assignments for a date based on team default members
  async generateDefaultAssignments(date: Date): Promise<void> {
    const teams = await this.getTeamsWithMembers();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if assignments already exist for this date
    const { data: existing, error: existingError } = await (supabase as any)
      .from('daily_team_assignments')
      .select('*')
      .eq('date', dateStr);
    
    if (existingError) throw existingError;
    
    // Only generate if no assignments exist yet
    if ((existing || []).length === 0) {
      const assignments = [];
      
      for (const team of teams) {
        const defaultMembers = team.members.filter(member => member.is_default);
        
        for (const member of defaultMembers) {
          // Check if employee is on holiday
          const isOnHoliday = await this.isEmployeeOnHoliday(member.employee_id, date);
          
          assignments.push({
            team_id: team.id,
            employee_id: member.employee_id,
            date: dateStr,
            is_available: !isOnHoliday
          });
        }
      }
      
      if (assignments.length > 0) {
        const { error } = await (supabase as any)
          .from('daily_team_assignments')
          .insert(assignments);
        
        if (error) throw error;
      }
    }
  }
};