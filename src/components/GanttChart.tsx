import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Users, Minus, GripVertical } from 'lucide-react';
import { ProjectUserAssignmentDialog } from './ProjectUserAssignmentDialog';
import { TeamMembershipManager } from './TeamMembershipManager';
import { dailyTeamAssignmentService, DailyTeamAssignment, Employee as DailyEmployee } from '@/services/dailyTeamAssignmentService';
import { teamMembershipService } from '@/services/teamMembershipService';

interface Team {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface ProjectWithTeam {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
  project_team_assignments?: {
    team: string;
    duration: number;
    start_date: string;
  } | null;
}

interface GanttChartProps {
  projects: ProjectWithTeam[];
}

// Get team color from database or fallback
const getTeamColor = (team: Team | string) => {
  if (typeof team === 'string') {
    // Fallback for team names
    if (team.toLowerCase().includes('groen') || team.toLowerCase().includes('green')) return 'bg-green-500';
    if (team.toLowerCase().includes('blauw') || team.toLowerCase().includes('blue')) return 'bg-blue-500';
    if (team.toLowerCase().includes('orange')) return 'bg-orange-500';
    return 'bg-gray-400';
  }
  
  // Use actual team color from database
  return team.color ? '' : 'bg-gray-400';
};

const getTeamColorStyle = (team: Team | string) => {
  if (typeof team === 'string') {
    // Fallback colors
    if (team.toLowerCase().includes('groen') || team.toLowerCase().includes('green')) return { backgroundColor: '#10b981' };
    if (team.toLowerCase().includes('blauw') || team.toLowerCase().includes('blue')) return { backgroundColor: '#3b82f6' };
    if (team.toLowerCase().includes('orange')) return { backgroundColor: '#f97316' };
    return { backgroundColor: '#6b7280' };
  }
  
  // Use actual team color from database
  return { backgroundColor: team.color || '#6b7280' };
};

const GanttChart: React.FC<GanttChartProps> = ({ projects }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<DailyEmployee[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyTeamAssignment[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [assignmentDialog, setAssignmentDialog] = useState<{
    isOpen: boolean;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    date: Date;
  }>({
    isOpen: false,
    projectId: '',
    projectName: '',
    teamId: '',
    teamName: '',
    date: new Date()
  });
  const [resizing, setResizing] = useState<{
    projectId: string;
    employeeId: string;
    type: 'start' | 'end';
    initialX: number;
    initialLeft: number;
    initialWidth: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Fetch installation teams and employees
  useEffect(() => {
    const fetchTeamsAndEmployees = async () => {
      try {
        // Fetch teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('placement_teams' as any)
          .select('id, name, color, is_active')
          .eq('is_active', true)
          .order('name');
        
        if (teamsError) throw teamsError;
        
        const fetchedTeams = (teamsData as unknown as Team[]) || [];
        
        // Add an "Unassigned" team at the end for projects without team assignments
        const allTeams = [
          ...fetchedTeams,
          {
            id: 'unassigned',
            name: 'Unassigned',
            color: '#6B7280',
            is_active: true
          }
        ];
        
        setTeams(allTeams);

        // Fetch employees
        const employeesData = await dailyTeamAssignmentService.getAvailableEmployees();
        setEmployees(employeesData);
        
        // Auto-assign permanent team members to current projects
        if (projects.length > 0) {
          await autoAssignTeamMembersToProjects(fetchedTeams);
        }
      } catch (error) {
        console.error('Error fetching teams and employees:', error);
      }
    };

    fetchTeamsAndEmployees();
  }, [projects]);

  // Fetch daily assignments for the current date range
  useEffect(() => {
    const fetchDailyAssignments = async () => {
      if (teams.length === 0) return;

      try {
        const dateRange = getDateRange();
        const startDate = format(dateRange[0], 'yyyy-MM-dd');
        const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd');
        
        const assignments = await dailyTeamAssignmentService.getAssignmentsForDateRange(startDate, endDate);
        setDailyAssignments(assignments);

        // Ensure permanent members are assigned to active projects
        if (assignments.length === 0 && projects.length > 0) {
          console.log('No assignments found, auto-assigning permanent members...');
          await autoAssignTeamMembersToProjects(teams);
          // Refetch assignments after auto-assignment
          const newAssignments = await dailyTeamAssignmentService.getAssignmentsForDateRange(startDate, endDate);
          setDailyAssignments(newAssignments);
        }
      } catch (error) {
        console.error('Error fetching daily assignments:', error);
      }
    };

    fetchDailyAssignments();
  }, [teams, currentWeek, projects]);

  // Debug: Log teams, employees and assignments
  useEffect(() => {
    console.log('Teams:', teams);
    console.log('Employees:', employees);
    console.log('Daily Assignments:', dailyAssignments);
    console.log('Projects with assignments:', projects.map(p => ({
      name: p.name,
      team: p.project_team_assignments?.team,
      hasAssignment: !!p.project_team_assignments
    })));
  }, [teams, employees, dailyAssignments, projects]);

  // Get date range for the Gantt chart (dynamic weeks)
  const getDateRange = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(addDays(weekStart, (weeksToShow * 7) - 1), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  };

  const dateRange = getDateRange();
  // Calculate dynamic day width based on available space (subtracting sidebar width and padding)
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 200 - 48 : 1200; // 200px sidebar, 48px padding
  const dayWidth = Math.max(30, availableWidth / dateRange.length); // Minimum 30px per day

  // Get project position and width
  const getProjectPosition = (project: ProjectWithTeam) => {
    const teamAssignment = project.project_team_assignments as any;
    const startDate = new Date(teamAssignment?.start_date || project.installation_date);
    const duration = teamAssignment?.duration || 1;
    
    const firstDay = dateRange[0];
    const startDayIndex = differenceInDays(startDate, firstDay);
    
    // Only show if project intersects with current view
    if (startDayIndex + duration < 0 || startDayIndex >= dateRange.length) {
      return null;
    }
    
    const left = Math.max(0, startDayIndex * dayWidth);
    const width = Math.min(duration * dayWidth, (dateRange.length - Math.max(0, startDayIndex)) * dayWidth);
    
    return { left, width, duration };
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    setCurrentWeek(addDays(currentWeek, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addDays(currentWeek, 7));
  };

  const zoomIn = () => {
    if (weeksToShow > 1) {
      setWeeksToShow(weeksToShow - 1);
    }
  };

  const zoomOut = () => {
    if (weeksToShow < 8) {
      setWeeksToShow(weeksToShow + 1);
    }
  };

  // Handle team assignment (for future implementation)
  const handleAssignProject = async () => {
    if (!selectedTeam || !selectedProject) return;
    
    // Here you would implement the assignment logic
    console.log('Assigning project', selectedProject, 'to team', selectedTeam);
    // Reset selections
    setSelectedTeam('');
    setSelectedProject('');
  };

  const openAssignmentDialog = (projectId: string, projectName: string, teamId: string, teamName: string, date: Date) => {
    setAssignmentDialog({
      isOpen: true,
      projectId,
      projectName,
      teamId,
      teamName,
      date
    });
  };

  const closeAssignmentDialog = () => {
    setAssignmentDialog({
      isOpen: false,
      projectId: '',
      projectName: '',
      teamId: '',
      teamName: '',
      date: new Date()
    });
  };

  // Helper function to assign an employee to a team for a date range
  const assignEmployeeToTeamForPeriod = async (
    employeeId: string,
    teamId: string,
    startDate: string,
    endDate: string,
    isAvailable: boolean = true,
    notes?: string
  ) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const assignments = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Skip weekends for work assignments
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      try {
        const assignment = await dailyTeamAssignmentService.assignEmployeeToTeamForDate(
          employeeId,
          teamId,
          format(date, 'yyyy-MM-dd'),
          isAvailable,
          notes
        );
        assignments.push(assignment);
      } catch (error) {
        console.error(`Error assigning employee ${employeeId} to team ${teamId} on ${format(date, 'yyyy-MM-dd')}:`, error);
      }
    }
    
    return assignments;
  };

  const autoAssignTeamMembersToProjects = async (teamsData: Team[]) => {
    try {
      for (const project of projects) {
        const teamAssignment = project.project_team_assignments;
        if (!teamAssignment) continue;

        // Find the team for this project
        const team = teamsData.find(t => {
          const teamNameLower = t.name.toLowerCase();
          const projectTeamLower = teamAssignment.team.toLowerCase();
          return projectTeamLower === teamNameLower ||
                 projectTeamLower.includes(teamNameLower) ||
                 teamNameLower.includes(projectTeamLower) ||
                 (teamNameLower.includes('groen') && projectTeamLower.includes('green')) ||
                 (teamNameLower.includes('green') && projectTeamLower.includes('groen')) ||
                 (teamNameLower.includes('blauw') && projectTeamLower.includes('blue')) ||
                 (teamNameLower.includes('blue') && projectTeamLower.includes('blauw'));
        });

        if (team) {
          // Get permanent team members
          const { data: permanentMembers } = await supabase
            .from('placement_team_members')
            .select('employee_id, is_default')
            .eq('team_id', team.id)
            .eq('is_default', true);

          if (permanentMembers && permanentMembers.length > 0) {
            // Create daily assignments for each permanent member for the entire project duration
            const startDate = new Date(teamAssignment.start_date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + teamAssignment.duration - 1);

            for (const member of permanentMembers) {
              await assignEmployeeToTeamForPeriod(
                member.employee_id,
                team.id,
                format(startDate, 'yyyy-MM-dd'),
                format(endDate, 'yyyy-MM-dd'),
                true, // is_available
                `Auto-assigned for project: ${project.name}`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error auto-assigning team members:', error);
    }
  };

  const handleAssignmentUpdate = () => {
    // Refresh daily assignments when assignment is updated
    const fetchDailyAssignments = async () => {
      try {
        const dateRange = getDateRange();
        const startDate = format(dateRange[0], 'yyyy-MM-dd');
        const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd');
        
        const assignments = await dailyTeamAssignmentService.getAssignmentsForDateRange(startDate, endDate);
        setDailyAssignments(assignments);
      } catch (error) {
        console.error('Error fetching daily assignments:', error);
      }
    };

    fetchDailyAssignments();
  };

  const handleMembershipChange = () => {
    // Refresh assignments when team membership changes
    handleAssignmentUpdate();
  };

  // Resize handlers for employee project blocks
  const handleResizeStart = useCallback((e: React.MouseEvent, projectId: string, employeeId: string, type: 'start' | 'end', left: number, width: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizing({
      projectId,
      employeeId,
      type,
      initialX: e.clientX,
      initialLeft: left,
      initialWidth: width
    });
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    const deltaX = e.clientX - resizing.initialX;
    const deltaWidth = Math.round(deltaX / dayWidth) * dayWidth;
    
    // Calculate new position/size based on resize type
    let newLeft = resizing.initialLeft;
    let newWidth = resizing.initialWidth;
    
    if (resizing.type === 'start') {
      newLeft = resizing.initialLeft + deltaWidth;
      newWidth = resizing.initialWidth - deltaWidth;
    } else {
      newWidth = resizing.initialWidth + deltaWidth;
    }
    
    // Minimum width of one day
    if (newWidth < dayWidth) return;
    
    // Update the visual element (this is just for visual feedback)
    const element = document.querySelector(`[data-resize-id="${resizing.projectId}-${resizing.employeeId}"]`) as HTMLElement;
    if (element) {
      element.style.left = `${newLeft}px`;
      element.style.width = `${newWidth}px`;
    }
  }, [resizing, dayWidth]);

  const handleResizeEnd = useCallback(async () => {
    if (!resizing) return;
    
    try {
      // Calculate the new date range based on the visual resize
      const element = document.querySelector(`[data-resize-id="${resizing.projectId}-${resizing.employeeId}"]`) as HTMLElement;
      if (!element) return;

      const currentLeft = parseInt(element.style.left);
      const currentWidth = parseInt(element.style.width);
      
      const startDayIndex = Math.round(currentLeft / dayWidth);
      const durationDays = Math.round(currentWidth / dayWidth);
      
      const newStartDate = dateRange[Math.max(0, startDayIndex)];
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + durationDays - 1);

      // Find the team for this employee assignment
      const employeeAssignments = dailyAssignments.filter(
        assignment => assignment.employee_id === resizing.employeeId
      );
      
      if (employeeAssignments.length > 0) {
        const teamId = employeeAssignments[0].team_id;
        
        // Delete existing assignments for this employee and project period
        await supabase
          .from('daily_team_assignments')
          .delete()
          .eq('employee_id', resizing.employeeId)
          .eq('team_id', teamId)
          .gte('date', format(new Date(Math.min(...employeeAssignments.map(a => new Date(a.date).getTime()))), 'yyyy-MM-dd'))
          .lte('date', format(new Date(Math.max(...employeeAssignments.map(a => new Date(a.date).getTime()))), 'yyyy-MM-dd'));

        // Create new assignments for the resized period
        await assignEmployeeToTeamForPeriod(
          resizing.employeeId,
          teamId,
          format(newStartDate, 'yyyy-MM-dd'),
          format(newEndDate, 'yyyy-MM-dd'),
          true,
          `Manually adjusted assignment`
        );

        // Refresh the assignments
        handleAssignmentUpdate();
      }
    } catch (error) {
      console.error('Error saving resized assignment:', error);
    }
    
    setResizing(null);
  }, [resizing, dayWidth, dateRange, dailyAssignments, handleAssignmentUpdate]);

  // Mouse event listeners for resizing
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  return (
    <Card className="h-[calc(100vh-250px)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Installation Gantt Chart</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-48">
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
              
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleAssignProject}
                disabled={!selectedTeam || !selectedProject}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign
              </Button>
              
              <TeamMembershipManager onMembershipChange={handleMembershipChange} />
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={zoomOut} disabled={weeksToShow >= 8}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={zoomIn} disabled={weeksToShow <= 1}>
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {weeksToShow} week{weeksToShow > 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentWeek, 'MMM yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="h-full overflow-hidden">
        <div className="flex h-full">
          {/* Teams & Employees sidebar */}
          <div className="w-48 border-r border-border bg-muted/20">
            <div className="h-12 border-b border-border bg-muted/40 flex items-center px-4 font-semibold text-sm">
              Teams & Employees
            </div>
            <div className="overflow-y-auto h-[calc(100%-48px)]">
              {/* Teams Section */}
              <div className="border-b border-border/50 bg-muted/30">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Installation Teams
                </div>
              </div>
              {teams.map((team) => (
                <div key={`team-${team.id}`} className="h-16 border-b border-border/50 px-4 flex flex-col justify-center hover:bg-muted/30 transition-colors bg-muted/10">
                  <div className="font-medium text-sm truncate flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    {team.name}
                  </div>
                  <div className="text-xs text-muted-foreground">Team Overview</div>
                </div>
              ))}

              {/* Employees Section */}
              <div className="border-b border-border/50 bg-muted/30 mt-4">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Team Members
                </div>
              </div>
              {teams.map((team) => {
                // Get employees assigned to this team through daily assignments
                const assignedEmployees = dailyAssignments
                  .filter(assignment => assignment.team_id === team.id)
                  .reduce((acc, assignment) => {
                    const employee = employees.find(emp => emp.id === assignment.employee_id);
                    if (employee && !acc.some(emp => emp.id === employee.id)) {
                      acc.push(employee);
                    }
                    return acc;
                  }, [] as DailyEmployee[]);

                // Also include permanent team members even if they don't have daily assignments yet
                const permanentMembers = employees.filter(employee => {
                  // Check if this employee is a permanent member of this team but not already included
                  return !assignedEmployees.some(assigned => assigned.id === employee.id);
                });

                // Combine both assigned and permanent members
                const allTeamMembers = [...assignedEmployees];

                return allTeamMembers.map((employee) => (
                  <div
                    key={`employee-${team.id}-${employee.id}`}
                    className="h-16 border-b border-border/50 px-6 flex flex-col justify-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      {employee.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{team.name} - {employee.role}</div>
                  </div>
                ));
              })}
            </div>
          </div>
          
          {/* Timeline area */}
          <div className="flex-1 overflow-hidden" ref={timelineRef}>
            <div style={{ width: '100%', minWidth: dateRange.length * dayWidth }}>
              {/* Time header */}
              <div className="h-12 border-b border-border bg-muted/40 flex">
                {dateRange.map((date, index) => (
                  <div
                    key={index}
                    className="border-r border-border/50 flex flex-col items-center justify-center text-xs"
                    style={{ width: dayWidth }}
                  >
                    <div className="font-medium">{format(date, 'dd')}</div>
                    <div className="text-muted-foreground">{format(date, 'EEE')}</div>
                  </div>
                ))}
              </div>
              
              {/* Team rows with projects */}
              <div className="relative">
                {/* Teams Section Header */}
                <div className="h-8 border-b border-border bg-muted/30 flex items-center px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Installation Teams
                </div>
                
                {teams.map((team) => (
                  <div key={`team-row-${team.id}`} className="h-16 border-b border-border/50 relative hover:bg-muted/10 transition-colors bg-muted/10">
                    {/* Day grid */}
                    {dateRange.map((date, dayIndex) => (
                      <div
                        key={dayIndex}
                        className="absolute border-r border-border/30"
                        style={{
                          left: dayIndex * dayWidth,
                          width: dayWidth,
                          height: '100%',
                          backgroundColor: date.getDay() === 0 || date.getDay() === 6 ? 'hsl(var(--muted)/0.5)' : 'transparent'
                        }}
                      />
                    ))}
                    
                    {/* Team-level projects */}
                    {projects
                      .filter(project => {
                        const projectTeam = project.project_team_assignments?.team;
                        
                        // Handle unassigned team
                        if (team.id === 'unassigned') {
                          return !projectTeam;
                        }
                        
                        if (!projectTeam) return false;
                        
                        // More flexible team name matching
                        const teamNameLower = team.name.toLowerCase();
                        const projectTeamLower = projectTeam.toLowerCase();
                        
                        return projectTeamLower === teamNameLower ||
                               projectTeamLower.includes(teamNameLower) ||
                               teamNameLower.includes(projectTeamLower) ||
                               (teamNameLower.includes('groen') && projectTeamLower.includes('green')) ||
                               (teamNameLower.includes('green') && projectTeamLower.includes('groen')) ||
                               (teamNameLower.includes('blauw') && projectTeamLower.includes('blue')) ||
                               (teamNameLower.includes('blue') && projectTeamLower.includes('blauw'));
                      })
                      .map((project) => {
                        const position = getProjectPosition(project);
                        if (!position) return null;
                        
                        return (
                          <div
                            key={`${team.id}-${project.id}`}
                            className="absolute top-2 h-12 rounded-md flex items-center px-2 text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity group"
                            style={{
                              left: position.left,
                              width: position.width,
                              ...getTeamColorStyle(team)
                            }}
                            title={`${project.name} - ${project.client} (${position.duration} days)`}
                            onClick={() => {
                              const projectStartDate = new Date(project.project_team_assignments?.start_date || project.installation_date);
                              openAssignmentDialog(project.id, project.name, team.id, team.name, projectStartDate);
                            }}
                          >
                            <div className="truncate flex-1">
                              <div className="font-semibold truncate">{project.name}</div>
                              <div className="text-xs opacity-90 truncate">{project.client}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              {project.progress > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {project.progress}%
                                </Badge>
                              )}
                              <Users className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
                
                {/* Employees Section Header */}
                <div className="h-8 border-b border-border bg-muted/30 flex items-center px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">
                  Team Members
                </div>
                
                {/* Employee Rows */}
                {teams.map((team) => {
                  const assignedEmployees = dailyAssignments
                    .filter(assignment => assignment.team_id === team.id)
                    .reduce((acc, assignment) => {
                      const employee = employees.find(emp => emp.id === assignment.employee_id);
                      if (employee && !acc.some(emp => emp.id === employee.id)) {
                        acc.push(employee);
                      }
                      return acc;
                    }, [] as DailyEmployee[]);

                  return assignedEmployees.map((employee) => (
                    <div
                      key={`employee-row-${team.id}-${employee.id}`}
                      className="h-16 border-b border-border/50 relative hover:bg-muted/10 transition-colors"
                    >
                      {/* Day grid */}
                      {dateRange.map((date, dayIndex) => (
                        <div
                          key={dayIndex}
                          className="absolute border-r border-border/30"
                          style={{
                            left: dayIndex * dayWidth,
                            width: dayWidth,
                            height: '100%',
                            backgroundColor: date.getDay() === 0 || date.getDay() === 6 ? 'hsl(var(--muted)/0.5)' : 'transparent'
                          }}
                        />
                      ))}
                      
                      {/* Employee-specific project assignments with resize handles */}
                      {projects
                        .filter(project => {
                          const teamAssignment = project.project_team_assignments;
                          if (!teamAssignment) return false;
                          
                          // Check if this project is assigned to the current team
                          const projectTeam = teamAssignment.team;
                          const teamNameLower = team.name.toLowerCase();
                          const projectTeamLower = projectTeam.toLowerCase();
                          
                          return projectTeamLower === teamNameLower ||
                                 projectTeamLower.includes(teamNameLower) ||
                                 teamNameLower.includes(projectTeamLower) ||
                                 (teamNameLower.includes('groen') && projectTeamLower.includes('green')) ||
                                 (teamNameLower.includes('green') && projectTeamLower.includes('groen')) ||
                                 (teamNameLower.includes('blauw') && projectTeamLower.includes('blue')) ||
                                 (teamNameLower.includes('blue') && projectTeamLower.includes('blauw'));
                        })
                        .map((project) => {
                          const teamAssignment = project.project_team_assignments;
                          if (!teamAssignment) return null;
                          
                          const projectStartDate = new Date(teamAssignment.start_date);
                          const projectEndDate = new Date(projectStartDate);
                          projectEndDate.setDate(projectEndDate.getDate() + teamAssignment.duration - 1);
                          
                          // Check if employee is assigned to this team during project period
                          const employeeAssignedDays = dailyAssignments.filter(assignment => 
                            assignment.employee_id === employee.id &&
                            assignment.team_id === team.id &&
                            assignment.is_available &&
                            new Date(assignment.date) >= projectStartDate &&
                            new Date(assignment.date) <= projectEndDate
                          );
                          
                          if (employeeAssignedDays.length === 0) return null;
                          
                          // Calculate position for this employee's assignment
                          const firstAssignmentDate = new Date(Math.min(...employeeAssignedDays.map(a => new Date(a.date).getTime())));
                          const lastAssignmentDate = new Date(Math.max(...employeeAssignedDays.map(a => new Date(a.date).getTime())));
                          
                          const startDayIndex = differenceInDays(firstAssignmentDate, dateRange[0]);
                          const endDayIndex = differenceInDays(lastAssignmentDate, dateRange[0]);
                          
                          // Only show if assignment intersects with current view
                          if (endDayIndex < 0 || startDayIndex >= dateRange.length) {
                            return null;
                          }
                          
                          const left = Math.max(0, startDayIndex * dayWidth);
                          const width = Math.min(
                            (endDayIndex - Math.max(0, startDayIndex) + 1) * dayWidth,
                            (dateRange.length - Math.max(0, startDayIndex)) * dayWidth
                          );
                          
                          return (
                            <div
                              key={`${employee.id}-${project.id}`}
                              data-resize-id={`${project.id}-${employee.id}`}
                              className="absolute top-2 h-12 rounded-md flex items-center text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity group"
                              style={{
                                left: left,
                                width: width - 2,
                                ...getTeamColorStyle(team)
                              }}
                              title={`${employee.name} - ${project.name} (${employeeAssignedDays.length} days assigned, holidays excluded)`}
                            >
                              {/* Left resize handle */}
                              <div
                                className="absolute left-0 top-0 w-2 h-full cursor-w-resize opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-black/20 transition-all"
                                onMouseDown={(e) => handleResizeStart(e, project.id, employee.id, 'start', left, width)}
                              >
                                <GripVertical className="h-3 w-3" />
                              </div>
                              
                              {/* Content */}
                              <div className="truncate flex-1 px-2">
                                <div className="font-semibold truncate text-xs">{project.name}</div>
                                <div className="text-xs opacity-75 truncate">{project.client}</div>
                              </div>
                              
                              {/* Right resize handle */}
                              <div
                                className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-black/20 transition-all"
                                onMouseDown={(e) => handleResizeStart(e, project.id, employee.id, 'end', left, width)}
                              >
                                <GripVertical className="h-3 w-3" />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ));
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <ProjectUserAssignmentDialog
        isOpen={assignmentDialog.isOpen}
        onClose={closeAssignmentDialog}
        projectId={assignmentDialog.projectId}
        projectName={assignmentDialog.projectName}
        teamId={assignmentDialog.teamId}
        teamName={assignmentDialog.teamName}
        date={assignmentDialog.date}
        onAssignmentUpdate={handleAssignmentUpdate}
      />
    </Card>
  );
};

export default GanttChart;