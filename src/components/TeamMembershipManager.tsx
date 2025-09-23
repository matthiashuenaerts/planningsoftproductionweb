import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { teamMembershipService } from '@/services/teamMembershipService';
import { dailyTeamAssignmentService, Employee } from '@/services/dailyTeamAssignmentService';
import { supabase } from '@/integrations/supabase/client';

interface Team {
  id: string;
  name: string;
  color: string;
}

interface TeamMembershipManagerProps {
  teamId?: string;
  onMembershipChange?: () => void;
}

export const TeamMembershipManager: React.FC<TeamMembershipManagerProps> = ({ 
  teamId, 
  onMembershipChange 
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>(teamId || '');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTeamsAndEmployees();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers();
    }
  }, [selectedTeam]);

  const fetchTeamsAndEmployees = async () => {
    try {
        // Fetch teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('placement_teams' as any)
          .select('id, name, color')
          .eq('is_active', true)
          .order('name');

        if (teamsError) throw teamsError;
        setTeams((teamsData as any) || []);

      // Fetch all employees
      const employeesData = await dailyTeamAssignmentService.getAvailableEmployees();
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching teams and employees:', error);
      toast.error('Failed to load teams and employees');
    }
  };

  const fetchTeamMembers = async () => {
    if (!selectedTeam) return;
    
    try {
      const members = await teamMembershipService.getTeamMembers(selectedTeam);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedEmployee) return;
    
    setLoading(true);
    try {
      await teamMembershipService.addEmployeeToTeam(selectedTeam, selectedEmployee);
      await fetchTeamMembers();
      setSelectedEmployee('');
      toast.success('Employee added to team successfully');
      onMembershipChange?.();
    } catch (error: any) {
      console.error('Error adding team member:', error);
      if (error.code === '23505') {
        toast.error('Employee is already a member of this team');
      } else {
        toast.error('Failed to add employee to team');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (employeeId: string) => {
    if (!selectedTeam) return;
    
    setLoading(true);
    try {
      await teamMembershipService.removeEmployeeFromTeam(selectedTeam, employeeId);
      await fetchTeamMembers();
      toast.success('Employee removed from team successfully');
      onMembershipChange?.();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove employee from team');
    } finally {
      setLoading(false);
    }
  };

  const availableEmployees = employees.filter(emp => 
    !teamMembers.some(member => member.id === emp.id)
  );

  const selectedTeamData = teams.find(team => team.id === selectedTeam);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Manage Team Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Team Memberships</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Team Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedTeamData && (
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: selectedTeamData.color }}
                    />
                  )}
                  {selectedTeamData?.name} Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Member Section */}
                <div className="flex gap-2">
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select employee to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} ({employee.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddMember}
                    disabled={!selectedEmployee || loading}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Current Members */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Current Members ({teamMembers.length})</h4>
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No permanent members assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium text-sm">{member.name}</div>
                            <div className="text-xs text-muted-foreground">{member.role}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};