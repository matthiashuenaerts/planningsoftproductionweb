import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import { CalendarDays, Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { placementTeamService, TeamWithMembers, DailyTeamAssignment } from '@/services/placementTeamService';
import { supabase } from '@/integrations/supabase/client';
interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
}
const DailyTasks: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyTeamAssignment[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [memberNotes, setMemberNotes] = useState<string>('');
  const { toast } = useToast();

  // Load data on mount and when date changes
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load teams with members
      const teamsData = await placementTeamService.getTeamsWithMembers();
      setTeams(teamsData);
      
      // Load or generate daily assignments for selected date
      await placementTeamService.generateDefaultAssignments(selectedDate);
      const assignments = await placementTeamService.getDailyAssignments(selectedDate);
      setDailyAssignments(assignments);
      
      // Load available employees (those not assigned to any default team)
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name, email, role')
        .order('name');
      
      if (error) throw error;
      
      // Filter out employees who are already default members of teams
      const defaultMemberIds = new Set();
      teamsData.forEach(team => {
        team.members.filter(m => m.is_default).forEach(m => {
          defaultMemberIds.add(m.employee_id);
        });
      });
      
      const available = (employees || []).filter(emp => !defaultMemberIds.has(emp.id));
      setAvailableEmployees(available);
      
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: `Failed to load placement schedule: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedEmployeeId) return;
    
    try {
      await placementTeamService.upsertDailyAssignment({
        team_id: selectedTeamId,
        employee_id: selectedEmployeeId,
        date: selectedDate,
        is_available: true,
        notes: memberNotes
      });
      
      toast({
        title: "Success",
        description: "Team member added successfully"
      });
      
      setShowAddMemberDialog(false);
      setSelectedTeamId('');
      setSelectedEmployeeId('');
      setMemberNotes('');
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to add team member: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (teamId: string, employeeId: string) => {
    try {
      await placementTeamService.removeDailyAssignment(teamId, employeeId, selectedDate);
      
      toast({
        title: "Success",
        description: "Team member removed successfully"
      });
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to remove team member: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const toggleMemberAvailability = async (assignment: DailyTeamAssignment) => {
    try {
      await placementTeamService.upsertDailyAssignment({
        team_id: assignment.team_id,
        employee_id: assignment.employee_id,
        date: selectedDate,
        is_available: !assignment.is_available,
        notes: assignment.notes
      });
      
      toast({
        title: "Success",
        description: `Member marked as ${!assignment.is_available ? 'available' : 'unavailable'}`
      });
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update availability: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const getTeamAssignments = (teamId: string) => {
    return dailyAssignments.filter(assignment => assignment.team_id === teamId);
  };

  const getTeamColor = (color: string) => {
    const colors: { [key: string]: string } = {
      blue: 'border-blue-200 bg-blue-50',
      green: 'border-green-200 bg-green-50',
      orange: 'border-orange-200 bg-orange-50',
      purple: 'border-purple-200 bg-purple-50',
      red: 'border-red-200 bg-red-50'
    };
    return colors[color] || 'border-gray-200 bg-gray-50';
  };

  const getBadgeColor = (isAvailable: boolean, isOnHoliday: boolean = false) => {
    if (isOnHoliday) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (!isAvailable) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getBadgeText = (isAvailable: boolean, isOnHoliday: boolean = false) => {
    if (isOnHoliday) return 'On Holiday';
    if (!isAvailable) return 'Unavailable';
    return 'Available';
  };
  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6 my-[70px]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Placement Schedule</h1>
              <p className="text-muted-foreground">Manage installation team assignments and availability</p>
            </div>
            
            <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member for {format(selectedDate, 'MMMM d, yyyy')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="team">Team</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="employee">Employee</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEmployees.map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name} ({employee.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={memberNotes}
                      onChange={(e) => setMemberNotes(e.target.value)}
                      placeholder="Add any notes about this assignment..."
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddMember} disabled={!selectedTeamId || !selectedEmployeeId}>
                      Add Member
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="mr-2 h-5 w-5" />
                  Calendar
                </CardTitle>
                <CardDescription>
                  Select a date to manage team assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border w-full"
                />
              </CardContent>
            </Card>
            
            {/* Team Assignments */}
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Team Assignments for {format(selectedDate, 'MMMM d, yyyy')}
                      {isToday(selectedDate) && (
                        <Badge variant="outline" className="ml-2">Today</Badge>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Manage placement team members and their availability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {teams.map(team => {
                        const teamAssignments = getTeamAssignments(team.id);
                        const availableCount = teamAssignments.filter(a => a.is_available).length;
                        const totalCount = teamAssignments.length;
                        
                        return (
                          <div key={team.id} className={cn("rounded-lg border-2 p-4", getTeamColor(team.color))}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={cn("w-4 h-4 rounded-full", `bg-${team.color}-500`)} />
                                <h3 className="text-lg font-semibold">{team.name}</h3>
                                <Badge variant="outline">
                                  {availableCount}/{totalCount} available
                                </Badge>
                              </div>
                            </div>
                            
                            {teamAssignments.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {teamAssignments.map(assignment => {
                                  const isDefaultMember = team.members.some(
                                    m => m.employee_id === assignment.employee_id && m.is_default
                                  );
                                  
                                  return (
                                    <div key={`${assignment.team_id}-${assignment.employee_id}`} 
                                         className="bg-white rounded-lg border p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium">{assignment.employee.name}</span>
                                          {isDefaultMember && (
                                            <Badge variant="secondary" className="text-xs">Default</Badge>
                                          )}
                                        </div>
                                        
                                        {!isDefaultMember && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveMember(team.id, assignment.employee_id)}
                                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                          >
                                            <UserMinus className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      
                                      <div className="text-sm text-muted-foreground">
                                        {assignment.employee.role}
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <Badge 
                                          className={cn("cursor-pointer", getBadgeColor(assignment.is_available))}
                                          onClick={() => toggleMemberAvailability(assignment)}
                                        >
                                          {getBadgeText(assignment.is_available)}
                                        </Badge>
                                        
                                        {!assignment.is_available && (
                                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                                        )}
                                      </div>
                                      
                                      {assignment.notes && (
                                        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                                          {assignment.notes}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                <p>No team members assigned for this date</p>
                                <p className="text-sm">Use "Add Team Member" to assign someone to this team</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {teams.length === 0 && (
                        <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                          <p className="text-lg font-medium text-gray-600 mb-1">No placement teams found</p>
                          <p className="text-muted-foreground max-w-sm mx-auto">
                            Create placement teams in the settings to start managing team assignments.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DailyTasks;