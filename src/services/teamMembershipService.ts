import { supabase } from '@/integrations/supabase/client';
import { Employee } from './dailyTeamAssignmentService';

export interface TeamMembership {
  id: string;
  team_id: string;
  employee_id: string;
  is_default: boolean;
  created_at: string;
}

export class TeamMembershipService {
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

  async addEmployeeToTeam(teamId: string, employeeId: string, isDefault: boolean = false): Promise<TeamMembership> {
    const { data, error } = await supabase
      .from('placement_team_members' as any)
      .insert({
        team_id: teamId,
        employee_id: employeeId,
        is_default: isDefault
      })
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  async removeEmployeeFromTeam(teamId: string, employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('placement_team_members' as any)
      .delete()
      .eq('team_id', teamId)
      .eq('employee_id', employeeId);

    if (error) throw error;
  }

  async getEmployeeTeams(employeeId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('placement_team_members' as any)
      .select('team_id')
      .eq('employee_id', employeeId);

    if (error) throw error;
    return (data as any)?.map((item: any) => item.team_id) || [];
  }

  async isEmployeeOnHoliday(employeeId: string, date: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('holiday_requests' as any)
      .select('id')
      .eq('user_id', employeeId)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
      .limit(1);

    if (error) throw error;
    return ((data as any)?.length || 0) > 0;
  }

  async autoAssignTeamMembersToProject(
    teamId: string, 
    projectStartDate: string, 
    projectDuration: number
  ): Promise<void> {
    const teamMembers = await this.getTeamMembers(teamId);
    
    for (const member of teamMembers) {
      for (let i = 0; i < projectDuration; i++) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Skip weekends
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // Check if employee is on holiday
        const isOnHoliday = await this.isEmployeeOnHoliday(member.id, dateStr);
        if (isOnHoliday) continue;
        
        // Check if assignment already exists
        const { data: existing } = await supabase
          .from('daily_team_assignments' as any)
          .select('id')
          .eq('employee_id', member.id)
          .eq('team_id', teamId)
          .eq('date', dateStr)
          .limit(1);
        
        if ((existing as any) && (existing as any).length > 0) continue;
        
        // Create assignment
        await supabase
          .from('daily_team_assignments' as any)
          .insert({
            employee_id: member.id,
            team_id: teamId,
            date: dateStr,
            is_available: true,
            notes: 'Auto-assigned as permanent team member'
          });
      }
    }
  }
}

export const teamMembershipService = new TeamMembershipService();