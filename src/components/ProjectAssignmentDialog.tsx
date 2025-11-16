import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExternalLink, User, X } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  onHoliday?: boolean;
}

interface PlacementTeam {
  id: string;
  name: string;
  color: string;
}

interface ProjectAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentTeamId: string | null;
  currentStartDate: string;
  currentDuration: number;
  onUpdate: () => void;
}

export const ProjectAssignmentDialog: React.FC<ProjectAssignmentDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentTeamId,
  currentStartDate,
  currentDuration,
  onUpdate,
}) => {
  const [teams, setTeams] = useState<PlacementTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(currentTeamId || '');
  const [startDate, setStartDate] = useState(currentStartDate);
  const [duration, setDuration] = useState(currentDuration);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      fetchAssignedEmployees();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamMembers(selectedTeamId);
    }
  }, [selectedTeamId]);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('placement_teams')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setTeams(data);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data, error } = await supabase
      .from('placement_team_members')
      .select(`
        employee_id,
        employees!inner(id, name)
      `)
      .eq('team_id', teamId);

    if (!error && data) {
      const members = data.map((item: any) => item.employees);
      
      // Check holidays for team members
      const membersWithHolidays = await Promise.all(
        members.map(async (member: Employee) => {
          const { data: holidayData } = await supabase
            .from('holiday_requests')
            .select('*')
            .eq('user_id', member.id)
            .eq('status', 'approved')
            .lte('start_date', format(new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
            .gte('end_date', currentStartDate);
          
          return {
            ...member,
            onHoliday: holidayData && holidayData.length > 0
          };
        })
      );
      
      setTeamMembers(membersWithHolidays);
    }
  };

  const fetchAssignedEmployees = async () => {
    const { data, error } = await supabase
      .from('daily_team_assignments')
      .select(`
        employee_id,
        employees!inner(id, name)
      `)
      .eq('team_id', currentTeamId || '')
      .gte('date', currentStartDate)
      .lte('date', format(new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

    if (!error && data) {
      const uniqueEmployees = Array.from(
        new Map(data.map((item: any) => [item.employees.id, item.employees])).values()
      ) as Employee[];
      
      // Check holidays for assigned employees
      const employeesWithHolidays = await Promise.all(
        uniqueEmployees.map(async (employee) => {
          const { data: holidayData } = await supabase
            .from('holiday_requests')
            .select('*')
            .eq('user_id', employee.id)
            .eq('status', 'approved')
            .lte('start_date', format(new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
            .gte('end_date', currentStartDate);
          
          return {
            ...employee,
            onHoliday: holidayData && holidayData.length > 0
          };
        })
      );
      
      setAssignedEmployees(employeesWithHolidays);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update project team assignment
      const { error: assignmentError } = await supabase
        .from('project_team_assignments')
        .update({
          team_id: selectedTeamId,
          start_date: startDate,
          duration: duration,
        })
        .eq('project_id', projectId);

      if (assignmentError) throw assignmentError;

      // Update installation date based on start date + duration
      const installationDate = format(
        new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000),
        'yyyy-MM-dd'
      );

      const { error: projectError } = await supabase
        .from('projects')
        .update({ installation_date: installationDate })
        .eq('id', projectId);

      if (projectError) throw projectError;

      toast.success('Project updated successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(`Failed to update project: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('daily_team_assignments')
        .delete()
        .eq('employee_id', employeeId)
        .eq('team_id', currentTeamId || '')
        .gte('date', currentStartDate)
        .lte('date', format(new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

      if (error) throw error;

      setAssignedEmployees(prev => prev.filter(e => e.id !== employeeId));
      toast.success('Employee removed from project');
    } catch (error: any) {
      toast.error(`Failed to remove employee: ${error.message}`);
    }
  };

  const endDate = format(
    new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000),
    'yyyy-MM-dd'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit Project Assignment</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/projects/${projectId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{projectName}</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team">Installation Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigned Employees
            </Label>
            {assignedEmployees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                  >
                    <span>{employee.name}</span>
                    <button
                      onClick={() => handleRemoveEmployee(employee.id)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No employees assigned</p>
            )}
          </div>

          {selectedTeamId && teamMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Team Members Available</Label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm"
                  >
                    {member.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
