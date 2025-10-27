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
        await autoAssignTeamMembersToProjects(fetchedTeams);
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

  const autoAssignTeamMembersToProjects = async (teamsData: Team[]) => {
    try {
      for (const project of projects) {
        const teamAssignment = project.project_team_assignments;
        if (!teamAssignment) continue;

        // Improved team matching logic
        const team = teamsData.find(t => {
          const teamNameLower = t.name.toLowerCase();
          const projectTeamLower = teamAssignment.team.toLowerCase();
          
          // Exact match first
          if (projectTeamLower === teamNameLower) return true;
          
          // Match by color keywords in project team name
          if (teamNameLower.includes('blue') && (projectTeamLower.includes('blauw') || projectTeamLower.includes('blue'))) return true;
          if (teamNameLower.includes('green') && (projectTeamLower.includes('groen') || projectTeamLower.includes('green'))) return true;
          if (teamNameLower.includes('orange') && projectTeamLower.includes('orange')) return true;
          
          // Fallback - check if project team contains team name or vice versa
          return projectTeamLower.includes(teamNameLower) || teamNameLower.includes(projectTeamLower);
        });

        if (team) {
          console.log(`Auto-assigning members of team "${team.name}" (ID: ${team.id}) to project "${project.name}" for ${teamAssignment.duration} days from ${teamAssignment.start_date}`);
          
          // Get team members first to check if there are any
          const teamMembers = await teamMembershipService.getTeamMembers(team.id);
          console.log(`Team "${team.name}" has ${teamMembers.length} permanent members:`, teamMembers.map(m => m.name));
          
          if (teamMembers.length === 0) {
            console.warn(`Team "${team.name}" has no permanent members to auto-assign`);
          } else {
            try {
              await teamMembershipService.autoAssignTeamMembersToProject(
                team.id,
                teamAssignment.start_date,
                teamAssignment.duration
              );
              console.log(`Successfully auto-assigned ${teamMembers.length} members to project "${project.name}"`);
            } catch (error) {
              console.error(`Failed to auto-assign team members to project "${project.name}":`, error);
            }
          }
        } else {
          console.log(`No matching team found for project "${project.name}" with team assignment "${teamAssignment.team}"`);
          console.log(`Available teams:`, teamsData.map(t => ({ id: t.id, name: t.name })));
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

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;
    
    // Here you would implement the actual data update to save the new assignment dates
    console.log('Resize completed for:', resizing);
    
    setResizing(null);
  }, [resizing]);

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

  // Helper function to calculate project lanes to avoid overlaps
  const calculateProjectLanes = (teamProjects: ProjectWithTeam[]) => {
    const lanes: Map<number, { end: number }> = new Map();
    const projectLanes: Map<string, number> = new Map();
    
    // Sort projects by start date
    const sortedProjects = [...teamProjects].sort((a, b) => {
      const dateA = new Date(a.project_team_assignments?.start_date || a.installation_date);
      const dateB = new Date(b.project_team_assignments?.start_date || b.installation_date);
      return dateA.getTime() - dateB.getTime();
    });
    
    sortedProjects.forEach(project => {
      const position = getProjectPosition(project);
      if (!position) return;
      
      const startDate = new Date(project.project_team_assignments?.start_date || project.installation_date);
      const startIndex = differenceInDays(startDate, dateRange[0]);
      const endIndex = startIndex + position.duration;
      
      // Find the first available lane
      let assignedLane = 0;
      while (true) {
        const lane = lanes.get(assignedLane);
        if (!lane || lane.end <= startIndex) {
          lanes.set(assignedLane, { end: endIndex });
          projectLanes.set(project.id, assignedLane);
          break;
        }
        assignedLane++;
      }
    });
    
    return { projectLanes, maxLanes: lanes.size };
  };

  return (
    <Card className="h-[calc(100vh-250px)] shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-background to-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Installation Gantt Chart</CardTitle>
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
      
      <CardContent className="p-0 h-[calc(100%-80px)]">
        <div className="flex h-full">
          {/* Fixed header row */}
          <div className="flex w-full">
            {/* Sidebar header */}
            <div className="w-56 flex-shrink-0 border-r border-border bg-muted/20">
              <div className="h-14 border-b border-border bg-gradient-to-r from-muted/60 to-muted/40 flex items-center px-4 font-semibold text-sm sticky top-0 z-10">
                Teams & Employees
              </div>
            </div>
            
            {/* Timeline header */}
            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="h-14 border-b border-border bg-gradient-to-r from-muted/60 to-muted/40 flex sticky top-0 z-10" style={{ minWidth: dateRange.length * dayWidth }}>
                {dateRange.map((date, index) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = isSameDay(date, new Date());
                  return (
                    <div
                      key={index}
                      className={cn(
                        "border-r border-border/30 flex flex-col items-center justify-center text-xs transition-colors",
                        isWeekend && "bg-muted/40",
                        isToday && "bg-primary/10 border-primary/30"
                      )}
                      style={{ width: dayWidth, minWidth: dayWidth }}
                    >
                      <div className={cn("font-semibold", isToday && "text-primary")}>{format(date, 'dd')}</div>
                      <div className={cn("text-muted-foreground text-[10px]", isToday && "text-primary/70")}>{format(date, 'EEE')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Scrollable content area with synchronized scrolling */}
        <div className="flex h-[calc(100%-56px)] overflow-hidden">
          {/* Sidebar content */}
          <div className="w-56 flex-shrink-0 border-r border-border bg-background overflow-y-auto" id="gantt-sidebar">
            {/* Teams Section */}
            <div className="border-b border-border bg-muted/20 sticky top-0 z-10">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Teams
              </div>
            </div>
            {teams.map((team) => {
              const teamProjects = projects.filter(project => {
                const projectTeam = project.project_team_assignments?.team;
                if (team.id === 'unassigned') return !projectTeam;
                if (!projectTeam) return false;
                const teamNameLower = team.name.toLowerCase();
                const projectTeamLower = projectTeam.toLowerCase();
                return projectTeamLower === teamNameLower ||
                       projectTeamLower.includes(teamNameLower) ||
                       teamNameLower.includes(projectTeamLower) ||
                       (teamNameLower.includes('groen') && projectTeamLower.includes('green')) ||
                       (teamNameLower.includes('green') && projectTeamLower.includes('groen')) ||
                       (teamNameLower.includes('blauw') && projectTeamLower.includes('blue')) ||
                       (teamNameLower.includes('blue') && projectTeamLower.includes('blauw'));
              });
              const { maxLanes } = calculateProjectLanes(teamProjects);
              const rowHeight = Math.max(60, (maxLanes * 28) + 20);
              
              return (
                <div 
                  key={`team-${team.id}`} 
                  className="border-b border-border/50 px-4 flex flex-col justify-center hover:bg-accent/50 transition-all group"
                  style={{ minHeight: `${rowHeight}px` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-3 h-3 rounded-full shadow-sm ring-2 ring-background"
                      style={{ backgroundColor: team.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{teamProjects.length} project{teamProjects.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Employees Section */}
            <div className="border-b border-border bg-muted/20 sticky z-10 mt-6">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Employees
              </div>
            </div>
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
                  key={`employee-${team.id}-${employee.id}`}
                  className="min-h-[60px] border-b border-border/50 px-4 pl-6 flex flex-col justify-center hover:bg-accent/50 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full shadow-sm"
                      style={{ backgroundColor: team.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{employee.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{employee.role}</div>
                    </div>
                  </div>
                </div>
              ));
            })}
          </div>
          
          {/* Timeline area with synchronized scroll */}
          <div 
            className="flex-1 overflow-auto" 
            id="gantt-timeline"
            ref={timelineRef}
            onScroll={(e) => {
              const sidebar = document.getElementById('gantt-sidebar');
              if (sidebar) {
                sidebar.scrollTop = e.currentTarget.scrollTop;
              }
            }}
          >
            <div style={{ minWidth: dateRange.length * dayWidth }}>
              {/* Teams Section */}
              <div className="border-b border-border bg-muted/10 sticky top-0 z-10">
                <div className="h-8 flex items-center px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  &nbsp;
                </div>
              </div>
              
              {teams.map((team) => {
                const teamProjects = projects.filter(project => {
                  const projectTeam = project.project_team_assignments?.team;
                  if (team.id === 'unassigned') return !projectTeam;
                  if (!projectTeam) return false;
                  const teamNameLower = team.name.toLowerCase();
                  const projectTeamLower = projectTeam.toLowerCase();
                  return projectTeamLower === teamNameLower ||
                         projectTeamLower.includes(teamNameLower) ||
                         teamNameLower.includes(projectTeamLower) ||
                         (teamNameLower.includes('groen') && projectTeamLower.includes('green')) ||
                         (teamNameLower.includes('green') && projectTeamLower.includes('groen')) ||
                         (teamNameLower.includes('blauw') && projectTeamLower.includes('blue')) ||
                         (teamNameLower.includes('blue') && projectTeamLower.includes('blauw'));
                });
                
                const { projectLanes, maxLanes } = calculateProjectLanes(teamProjects);
                const rowHeight = Math.max(60, (maxLanes * 28) + 20);
                
                return (
                  <div 
                    key={`team-row-${team.id}`} 
                    className="border-b border-border/50 relative hover:bg-accent/20 transition-all"
                    style={{ minHeight: `${rowHeight}px` }}
                  >
                    {/* Day grid */}
                    {dateRange.map((date, dayIndex) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = isSameDay(date, new Date());
                      return (
                        <div
                          key={dayIndex}
                          className={cn(
                            "absolute border-r transition-colors",
                            isWeekend ? "border-border/20 bg-muted/30" : "border-border/10",
                            isToday && "bg-primary/5 border-primary/20"
                          )}
                          style={{
                            left: dayIndex * dayWidth,
                            width: dayWidth,
                            height: '100%'
                          }}
                        />
                      );
                    })}
                    
                    {/* Team-level projects with lanes */}
                    {teamProjects.map((project) => {
                      const position = getProjectPosition(project);
                      if (!position) return null;
                      
                      const lane = projectLanes.get(project.id) || 0;
                      const topPosition = 10 + (lane * 28);
                      
                      return (
                        <div
                          key={`${team.id}-${project.id}`}
                          className="absolute rounded-lg flex items-center px-3 py-1.5 text-white text-xs font-medium cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] group"
                          style={{
                            left: position.left + 2,
                            width: position.width - 4,
                            top: topPosition,
                            height: '24px',
                            ...getTeamColorStyle(team),
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                          title={`${project.name} - ${project.client} (${position.duration} days)`}
                          onClick={() => {
                            const projectStartDate = new Date(project.project_team_assignments?.start_date || project.installation_date);
                            openAssignmentDialog(project.id, project.name, team.id, team.name, projectStartDate);
                          }}
                        >
                          <div className="truncate flex-1 flex items-center gap-2">
                            <div className="font-semibold truncate">{project.name}</div>
                            {project.progress > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {project.progress}%
                              </Badge>
                            )}
                          </div>
                          <Users className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              
              {/* Employees Section Header */}
              <div className="border-b border-border bg-muted/10 sticky z-10 mt-6">
                <div className="h-8 flex items-center px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  &nbsp;
                </div>
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
                    className="min-h-[60px] border-b border-border/50 relative hover:bg-accent/20 transition-all"
                  >
                    {/* Day grid */}
                    {dateRange.map((date, dayIndex) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = isSameDay(date, new Date());
                      return (
                        <div
                          key={dayIndex}
                          className={cn(
                            "absolute border-r transition-colors",
                            isWeekend ? "border-border/20 bg-muted/30" : "border-border/10",
                            isToday && "bg-primary/5 border-primary/20"
                          )}
                          style={{
                            left: dayIndex * dayWidth,
                            width: dayWidth,
                            height: '100%'
                          }}
                        />
                      );
                    })}
                    
                    {/* Employee-specific project assignments */}
                    {projects
                      .filter(project => {
                        const teamAssignment = project.project_team_assignments;
                        if (!teamAssignment) return false;
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
                        
                        const employeeAssignedDays = dailyAssignments.filter(assignment => 
                          assignment.employee_id === employee.id &&
                          assignment.team_id === team.id &&
                          assignment.is_available &&
                          new Date(assignment.date) >= projectStartDate &&
                          new Date(assignment.date) <= projectEndDate
                        );
                        
                        if (employeeAssignedDays.length === 0) return null;
                        
                        const firstAssignmentDate = new Date(Math.min(...employeeAssignedDays.map(a => new Date(a.date).getTime())));
                        const lastAssignmentDate = new Date(Math.max(...employeeAssignedDays.map(a => new Date(a.date).getTime())));
                        
                        const startDayIndex = differenceInDays(firstAssignmentDate, dateRange[0]);
                        const endDayIndex = differenceInDays(lastAssignmentDate, dateRange[0]);
                        
                        if (endDayIndex < 0 || startDayIndex >= dateRange.length) return null;
                        
                        const left = Math.max(0, startDayIndex * dayWidth);
                        const width = Math.min(
                          (endDayIndex - Math.max(0, startDayIndex) + 1) * dayWidth,
                          (dateRange.length - Math.max(0, startDayIndex)) * dayWidth
                        );
                        
                        return (
                          <div
                            key={`${employee.id}-${project.id}`}
                            data-resize-id={`${project.id}-${employee.id}`}
                            className="absolute rounded-lg flex items-center text-white text-xs font-medium cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] group"
                            style={{
                              left: left + 2,
                              width: width - 4,
                              top: '18px',
                              height: '24px',
                              ...getTeamColorStyle(team),
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            title={`${employee.name} - ${project.name} (${employeeAssignedDays.length} days)`}
                          >
                            <div
                              className="absolute left-0 top-0 w-3 h-full cursor-w-resize opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-black/20 transition-all rounded-l-lg"
                              onMouseDown={(e) => handleResizeStart(e, project.id, employee.id, 'start', left, width)}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                            
                            <div className="truncate flex-1 px-3">
                              <div className="font-semibold truncate">{project.name}</div>
                            </div>
                            
                            <div
                              className="absolute right-0 top-0 w-3 h-full cursor-e-resize opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-black/20 transition-all rounded-r-lg"
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