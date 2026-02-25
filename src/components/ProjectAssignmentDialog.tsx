import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, eachDayOfInterval } from 'date-fns';
import { ExternalLink, User, X, Plus, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Employee {
  id: string;
  name: string;
}

interface PlacementTeam {
  id: string;
  name: string;
  color: string;
}

interface TruckOption {
  id: string;
  truck_number: number | string;
  description: string | null;
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
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [employeesOnHoliday, setEmployeesOnHoliday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      console.log('Dialog opened, initializing state...', {
        projectId,
        currentTeamId,
        currentStartDate,
        currentDuration
      });
      
      // Reset state with current values
      setSelectedTeamId(currentTeamId || '');
      setStartDate(currentStartDate);
      setDuration(currentDuration);
      setAssignedEmployees([]);
      setEmployeesOnHoliday(new Set());
      setSelectedTruckId('');
      
      // Fetch all data
      fetchTeams();
      fetchAllEmployees();
      fetchAssignedEmployees();
      checkHolidayRequests();
      fetchTrucks();
      fetchTruckAssignment();
    }
  }, [isOpen, projectId, currentTeamId, currentStartDate, currentDuration]);

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
      setTeamMembers(data.map((item: any) => item.employees));
    }
  };

  const fetchAllEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setAllEmployees(data);
    }
  };

  const fetchAssignedEmployees = async () => {
    if (!currentTeamId) {
      console.log('No current team ID, skipping fetch assigned employees');
      setAssignedEmployees([]);
      return;
    }

    const endDate = format(
      new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    );

    console.log('Fetching assigned employees...', {
      teamId: currentTeamId,
      dateRange: `${currentStartDate} to ${endDate}`
    });

    const { data, error } = await supabase
      .from('daily_team_assignments')
      .select(`
        employee_id,
        employees!inner(id, name)
      `)
      .eq('team_id', currentTeamId)
      .gte('date', currentStartDate)
      .lte('date', endDate);

    if (error) {
      console.error('Error fetching assigned employees:', error);
      toast.error('Failed to load assigned employees');
      return;
    }

    if (data) {
      const uniqueEmployees = Array.from(
        new Map(data.map((item: any) => [item.employees.id, item.employees])).values()
      );
      console.log('Loaded assigned employees:', uniqueEmployees.length);
      setAssignedEmployees(uniqueEmployees as Employee[]);
    }
  };

  const checkHolidayRequests = async () => {
    const endDate = format(
      new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    );

    const { data, error } = await supabase
      .from('holiday_requests')
      .select('user_id')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', currentStartDate);

    if (!error && data) {
      setEmployeesOnHoliday(new Set(data.map(h => h.user_id)));
    }
  };

  const fetchTrucks = async () => {
    const { data, error } = await supabase
      .from('trucks')
      .select('id, truck_number, description')
      .order('truck_number');

    if (!error && data) {
      setTrucks(data as TruckOption[]);
    }
  };

  const fetchTruckAssignment = async () => {
    const { data, error } = await supabase
      .from('project_truck_assignments')
      .select('truck_id')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching truck assignment:', error);
      return;
    }

    if (data) {
      console.log('Loaded truck assignment:', data.truck_id);
      setSelectedTruckId(data.truck_id);
    } else {
      console.log('No truck assignment found');
      setSelectedTruckId('none');
    }
  };

  const handleSave = async () => {
    console.log('Starting save operation...', {
      projectId,
      selectedTeamId,
      startDate,
      duration,
      assignedEmployees: assignedEmployees.length,
      currentTeamId,
      currentStartDate,
      currentDuration
    });

    setLoading(true);
    try {
      // Validation
      if (!selectedTeamId) {
        toast.error('Please select a team');
        setLoading(false);
        return;
      }

      if (!startDate) {
        toast.error('Please select a start date');
        setLoading(false);
        return;
      }

      if (!duration || duration < 1) {
        toast.error('Duration must be at least 1 day');
        setLoading(false);
        return;
      }

      // Get the selected team name
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      if (!selectedTeam) {
        toast.error('Selected team not found');
        setLoading(false);
        return;
      }

      // Check if a team assignment already exists for this project
      const { data: existingAssignment, error: checkError } = await supabase
        .from('project_team_assignments')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (checkError) {
        console.error('Check assignment error:', checkError);
        throw checkError;
      }

      if (existingAssignment) {
        console.log('Updating existing project team assignment...');
        const { error: assignmentError } = await supabase
          .from('project_team_assignments')
          .update({
            team_id: selectedTeamId,
            team: selectedTeam.name,
            start_date: startDate,
            duration: duration,
          })
          .eq('project_id', projectId);

        if (assignmentError) {
          console.error('Assignment update error:', assignmentError);
          throw assignmentError;
        }
      } else {
        console.log('Creating new project team assignment...');
        const { error: insertError } = await supabase
          .from('project_team_assignments')
          .insert({
            project_id: projectId,
            team_id: selectedTeamId,
            team: selectedTeam.name,
            start_date: startDate,
            duration: duration,
          });

        if (insertError) {
          console.error('Assignment insert error:', insertError);
          throw insertError;
        }
      }

      console.log('Updating project installation date...');
      // Update installation date in projects table with start date
      const { error: projectError } = await supabase
        .from('projects')
        .update({ installation_date: startDate })
        .eq('id', projectId);

      if (projectError) {
        console.error('Project error:', projectError);
        throw projectError;
      }

      // Handle daily team assignments synchronization
      console.log('Handling daily team assignments...');
      const oldEndDate = format(
        new Date(new Date(currentStartDate).getTime() + (currentDuration - 1) * 24 * 60 * 60 * 1000),
        'yyyy-MM-dd'
      );

      // Delete old assignments only if there are employees and a valid team ID
      if (assignedEmployees.length > 0 && currentTeamId) {
        console.log('Deleting old assignments...', {
          teamId: currentTeamId,
          dateRange: `${currentStartDate} to ${oldEndDate}`,
          employeeCount: assignedEmployees.length
        });

        const { error: deleteError } = await supabase
          .from('daily_team_assignments')
          .delete()
          .eq('team_id', currentTeamId)
          .gte('date', currentStartDate)
          .lte('date', oldEndDate)
          .in('employee_id', assignedEmployees.map(e => e.id));

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
      }

      // Create new assignments for the updated date range
      if (assignedEmployees.length > 0) {
        console.log('Creating new assignments...');
        const dates = eachDayOfInterval({
          start: new Date(startDate),
          end: new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000)
        });

        const newAssignments = dates.flatMap(date => 
          assignedEmployees.map(employee => ({
            employee_id: employee.id,
            team_id: selectedTeamId,
            date: format(date, 'yyyy-MM-dd'),
            is_available: true
          }))
        );

        console.log(`Inserting ${newAssignments.length} assignments...`);
        const { error: assignmentsError } = await supabase
          .from('daily_team_assignments')
          .insert(newAssignments);

        if (assignmentsError) {
          console.error('Assignments error:', assignmentsError);
          throw assignmentsError;
        }
      }

      // Handle truck assignment
      console.log('Handling truck assignment...', { selectedTruckId });
      if (selectedTruckId && selectedTruckId !== 'none') {
        // Check if truck assignment exists
        const { data: existingAssignment, error: checkError } = await supabase
          .from('project_truck_assignments')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (checkError) {
          console.error('Truck check error:', checkError);
          throw checkError;
        }

        if (existingAssignment) {
          console.log('Updating existing truck assignment...');
          // Update existing assignment
          const { error: truckUpdateError } = await supabase
            .from('project_truck_assignments')
            .update({
              truck_id: selectedTruckId,
              loading_date: startDate,
              installation_date: startDate,
            })
            .eq('project_id', projectId);

          if (truckUpdateError) {
            console.error('Truck update error:', truckUpdateError);
            throw truckUpdateError;
          }
        } else {
          console.log('Creating new truck assignment...');
          // Create new assignment
          const { error: truckInsertError } = await supabase
            .from('project_truck_assignments')
            .insert({
              project_id: projectId,
              truck_id: selectedTruckId,
              loading_date: startDate,
              installation_date: startDate,
            });

          if (truckInsertError) {
            console.error('Truck insert error:', truckInsertError);
            throw truckInsertError;
          }
        }
      } else if (selectedTruckId === 'none') {
        console.log('Removing truck assignment...');
        // Remove truck assignment if none selected
        const { error: truckDeleteError } = await supabase
          .from('project_truck_assignments')
          .delete()
          .eq('project_id', projectId);

        if (truckDeleteError) {
          console.error('Truck delete error:', truckDeleteError);
          // Don't throw here, just log - deletion of non-existent assignment is ok
        }
      }

      console.log('Save completed successfully!');
      toast.success('Project updated successfully');
      
      // Close the dialog first so UI feels responsive
      onClose();
      
      // Call onUpdate to refresh the data
      await onUpdate();
    } catch (error: any) {
      console.error('Save failed:', error);
      toast.error(`Failed to update project: ${error.message || 'Unknown error'}`);
      // Don't close dialog on error so user can try again or cancel
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
        .eq('team_id', selectedTeamId || '')
        .gte('date', startDate)
        .lte('date', format(new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

      if (error) throw error;

      setAssignedEmployees(prev => prev.filter(e => e.id !== employeeId));
      toast.success('Employee removed from project');
    } catch (error: any) {
      toast.error(`Failed to remove employee: ${error.message}`);
    }
  };

  const handleAddEmployee = async (employeeId: string) => {
    if (!selectedTeamId) {
      toast.error('Please select a team first');
      return;
    }

    try {
      // Get all dates in the project duration
      const dates = eachDayOfInterval({
        start: new Date(startDate),
        end: new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000)
      });

      // Create assignments for each day
      const assignments = dates.map(date => ({
        employee_id: employeeId,
        team_id: selectedTeamId,
        date: format(date, 'yyyy-MM-dd'),
        is_available: true
      }));

      const { error } = await supabase
        .from('daily_team_assignments')
        .insert(assignments);

      if (error) throw error;

      // Add to assigned employees
      const employee = allEmployees.find(m => m.id === employeeId);
      if (employee) {
        setAssignedEmployees(prev => [...prev, employee]);
      }
      
      toast.success('Employee added to project');
    } catch (error: any) {
      toast.error(`Failed to add employee: ${error.message}`);
    }
  };

  // Safely compute endDate only if startDate is valid
  const endDate = startDate && !isNaN(new Date(startDate).getTime())
    ? format(
        new Date(new Date(startDate).getTime() + (duration - 1) * 24 * 60 * 60 * 1000),
        'yyyy-MM-dd'
      )
    : '';

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
            <Label htmlFor="truck">Assigned Truck</Label>
            <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
              <SelectTrigger id="truck">
                <SelectValue placeholder="Select truck">
                  {selectedTruckId && trucks.find(t => t.id === selectedTruckId) ? (
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      <Badge variant="secondary">
                        T{trucks.find(t => t.id === selectedTruckId)?.truck_number}
                      </Badge>
                      <span>{trucks.find(t => t.id === selectedTruckId)?.description}</span>
                    </div>
                  ) : "No truck assigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No truck assigned</SelectItem>
                {trucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">T{truck.truck_number}</Badge>
                      <span>{truck.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigned Employees
            </Label>
            {assignedEmployees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedEmployees.map((employee) => {
                  const isOnHoliday = employeesOnHoliday.has(employee.id);
                  return (
                    <div
                      key={employee.id}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                        isOnHoliday 
                          ? 'bg-destructive text-destructive-foreground' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      <span>{employee.name}</span>
                      <button
                        onClick={() => handleRemoveEmployee(employee.id)}
                        className="hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No employees assigned</p>
            )}
          </div>

          {selectedTeamId && (
            <div className="space-y-4">
              {/* Team Members */}
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Team Members (Click to Add)</Label>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers
                      .filter(member => !assignedEmployees.some(e => e.id === member.id))
                      .map((member) => {
                        const isOnHoliday = employeesOnHoliday.has(member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => handleAddEmployee(member.id)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity ${
                              isOnHoliday
                                ? 'bg-destructive/10 text-destructive border border-destructive'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            <span>{member.name}</span>
                            {isOnHoliday && <span className="text-xs">(On Holiday)</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Other Employees */}
              {allEmployees.filter(emp => 
                !teamMembers.some(tm => tm.id === emp.id) && 
                !assignedEmployees.some(ae => ae.id === emp.id)
              ).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Other Employees (Click to Add)</Label>
                  <div className="flex flex-wrap gap-2">
                    {allEmployees
                      .filter(emp => 
                        !teamMembers.some(tm => tm.id === emp.id) && 
                        !assignedEmployees.some(ae => ae.id === emp.id)
                      )
                      .map((employee) => {
                        const isOnHoliday = employeesOnHoliday.has(employee.id);
                        return (
                          <button
                            key={employee.id}
                            onClick={() => handleAddEmployee(employee.id)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity ${
                              isOnHoliday
                                ? 'bg-destructive/10 text-destructive border border-destructive'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            <span>{employee.name}</span>
                            {isOnHoliday && <span className="text-xs">(On Holiday)</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
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
