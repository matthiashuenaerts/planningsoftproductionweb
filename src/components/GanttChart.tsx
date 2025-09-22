import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import { ProjectUserAssignmentDialog } from './ProjectUserAssignmentDialog';
import { dailyTeamAssignmentService, DailyTeamAssignment, Employee as DailyEmployee } from '@/services/dailyTeamAssignmentService';

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

// Team colors
const teamColors = {
  green: 'bg-green-500',
  blue: 'bg-blue-500', 
  orange: 'bg-orange-500',
  unassigned: 'bg-gray-400'
};

const getTeamColor = (teamName: string | null | undefined) => {
  if (!teamName) return teamColors.unassigned;
  
  if (teamName.toLowerCase().includes('groen')) return teamColors.green;
  if (teamName.toLowerCase().includes('blauw')) return teamColors.blue;
  if (teamName.toLowerCase().includes('orange')) return teamColors.orange;
  
  return teamColors.unassigned;
};

const GanttChart: React.FC<GanttChartProps> = ({ projects }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<DailyEmployee[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyTeamAssignment[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
      } catch (error) {
        console.error('Error fetching teams and employees:', error);
      }
    };

    fetchTeamsAndEmployees();
  }, []);

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
      } catch (error) {
        console.error('Error fetching daily assignments:', error);
      }
    };

    fetchDailyAssignments();
  }, [teams, currentWeek]);

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

  // Get date range for the Gantt chart (4 weeks)
  const getDateRange = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(addDays(weekStart, 27), { weekStartsOn: 1 }); // 4 weeks
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  };

  const dateRange = getDateRange();
  const dayWidth = 40; // Width per day in pixels

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
          {/* Teams sidebar */}
          <div className="w-48 border-r border-border bg-muted/20">
            <div className="h-12 border-b border-border bg-muted/40 flex items-center px-4 font-semibold text-sm">
              Teams & Employees
            </div>
            <div className="overflow-y-auto h-[calc(100%-48px)]">
              {teams.map((team) => {
                // Get employees assigned to this team for any day in the date range
                const teamEmployees = dailyAssignments
                  .filter(assignment => assignment.team_id === team.id)
                  .reduce((acc, assignment) => {
                    const employee = employees.find(emp => emp.id === assignment.employee_id);
                    if (employee && !acc.some(emp => emp.id === employee.id)) {
                      acc.push(employee);
                    }
                    return acc;
                  }, [] as DailyEmployee[]);

                return (
                  <div key={team.id}>
                    {/* Team Header */}
                    <div className="h-16 border-b border-border/50 px-4 flex flex-col justify-center hover:bg-muted/30 transition-colors bg-muted/10">
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </div>
                      <div className="text-xs text-muted-foreground">Installation Team</div>
                    </div>
                    
                    {/* Employee Rows */}
                    {teamEmployees.map((employee) => (
                      <div
                        key={`${team.id}-${employee.id}`}
                        className="h-16 border-b border-border/50 px-6 flex flex-col justify-center hover:bg-muted/30 transition-colors"
                      >
                        <div className="font-medium text-sm truncate">
                          {employee.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Timeline area */}
          <div className="flex-1 overflow-x-auto" ref={scrollRef}>
            <div style={{ width: dateRange.length * dayWidth }}>
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
                {teams.map((team) => {
                  // Get employees assigned to this team for any day in the date range
                  const teamEmployees = dailyAssignments
                    .filter(assignment => assignment.team_id === team.id)
                    .reduce((acc, assignment) => {
                      const employee = employees.find(emp => emp.id === assignment.employee_id);
                      if (employee && !acc.some(emp => emp.id === employee.id)) {
                        acc.push(employee);
                      }
                      return acc;
                    }, [] as DailyEmployee[]);

                  return (
                    <div key={team.id}>
                      {/* Team Row */}
                      <div className="h-16 border-b border-border/50 relative hover:bg-muted/10 transition-colors bg-muted/10">
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
                            
                            const teamColor = getTeamColor(team.name);
                            
                            return (
                              <div
                                key={`${team.id}-${project.id}`}
                                className={cn(
                                  "absolute top-2 h-12 rounded-md flex items-center px-2 text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity group",
                                  teamColor
                                )}
                                style={{
                                  left: position.left,
                                  width: position.width
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
                      
                      {/* Employee Rows */}
                      {teamEmployees.map((employee) => {
                        return (
                          <div
                            key={`${team.id}-${employee.id}`}
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
                            
                            {/* Employee-specific project assignments */}
                            {dateRange.map((date, dayIndex) => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              
                              // Find assignment for this employee on this date
                              const assignment = dailyAssignments.find(
                                a => a.employee_id === employee.id && 
                                     a.team_id === team.id && 
                                     a.date === dateStr && 
                                     a.is_available
                              );
                              
                              if (!assignment) return null;
                              
                              // Find the project assigned to this team for this date
                              const assignedProject = projects.find(project => {
                                const teamAssignment = project.project_team_assignments;
                                if (!teamAssignment) return false;
                                
                                const startDate = new Date(teamAssignment.start_date);
                                const endDate = new Date(startDate);
                                endDate.setDate(endDate.getDate() + teamAssignment.duration - 1);
                                
                                return date >= startDate && date <= endDate &&
                                       teamAssignment.team === team.name;
                              });
                              
                              if (!assignedProject) return null;
                              
                              const teamColor = getTeamColor(team.name);
                              
                              return (
                                <div
                                  key={`${employee.id}-${dateStr}-${assignedProject.id}`}
                                  className={cn(
                                    "absolute top-2 h-12 rounded-md flex items-center px-2 text-white text-xs font-medium",
                                    teamColor
                                  )}
                                  style={{
                                    left: dayIndex * dayWidth,
                                    width: dayWidth - 2
                                  }}
                                  title={`${employee.name} - ${assignedProject.name}`}
                                >
                                  <div className="truncate flex-1">
                                    <div className="font-semibold truncate text-xs">{assignedProject.name}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
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