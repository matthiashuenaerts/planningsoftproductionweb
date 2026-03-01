import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, getWeek, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProjectAssignmentDialog } from './ProjectAssignmentDialog';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';

interface Employee {
  id: string;
  name: string;
}

interface PlacementTeam {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  members?: Employee[];
}

interface Project {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  progress: number;
  project_team_assignments?: Array<{
    team: string;
    team_id: string | null;
    start_date: string;
    duration: number;
  }>;
  employees?: Employee[];
  employeesOnHoliday?: Set<string>;
  truck?: {
    truck_number: number | string;
    description: string | null;
  };
}

interface OrdersGanttChartProps {
  className?: string;
}

// Parse 'YYYY-MM-DD' safely as a local date to avoid timezone shifts
const parseYMD = (s: string) => {
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Dynamic team mapping using database
const mapTeamToCategory = (teamName: string, placementTeams: any[]): string => {
  const normalizedTeam = teamName.trim().toLowerCase();
  
  // Find team that has this external name (case-insensitive matching)
  const matchedTeam = placementTeams.find(team => 
    team.external_team_names?.some((externalName: string) => 
      externalName.toLowerCase() === normalizedTeam || 
      normalizedTeam.includes(externalName.toLowerCase())
    )
  );
  
  return matchedTeam ? matchedTeam.name : 'unnamed';
};

const OrdersGanttChart: React.FC<OrdersGanttChartProps> = ({ className }): React.ReactNode => {
  const { tenant } = useTenant();
  const [teams, setTeams] = useState<PlacementTeam[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draggedProject, setDraggedProject] = useState<{ project: Project; teamId: string } | null>(null);
  const [resizingProject, setResizingProject] = useState<{
    project: Project;
    teamId: string;
    edge: 'left' | 'right';
    originalStartDate: Date;
    originalDuration: number;
    startX: number;
  } | null>(null);
  const [draggingProject, setDraggingProject] = useState<{
    project: Project;
    teamId: string;
    initialX: number;
    initialLeft: number;
    dayWidth: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizeDelta, setResizeDelta] = useState({ left: 0, right: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    name: string;
    teamId: string | null;
    startDate: string;
    duration: number;
  } | null>(null);


  
  const handleResizeStart = (e: React.MouseEvent, project: Project, teamId: string, edge: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    const teamAssignments = project.project_team_assignments;
    const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;
    
    if (assignment?.start_date && assignment?.duration) {
      setResizingProject({
        project,
        teamId,
        edge,
        originalStartDate: new Date(assignment.start_date),
        originalDuration: assignment.duration,
        startX: e.clientX,
      });
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (resizingProject) {
      const { project, edge, originalStartDate, originalDuration, startX } = resizingProject;

      // Calculate days moved based on pixel movement
      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      // Calendar grid is the full width minus the 16rem (256px) team name column
      const calendarGridWidth = rect.width - 256;
      const dayWidth = calendarGridWidth / dateRange.length;
      const pixelsMoved = e.clientX - startX;
      const daysMoved = Math.round(pixelsMoved / dayWidth);

      if (daysMoved === 0) {
        setResizingProject(null);
        setResizeDelta({ left: 0, right: 0 });
        return;
      }

      let newStartDate: Date;
      let newDuration: number;

      if (edge === 'left') {
        // Resizing from left - adjust start date and duration
        newStartDate = addDays(originalStartDate, daysMoved);
        newDuration = Math.max(1, originalDuration - daysMoved);
      } else {
        // Resizing from right - keep start date, adjust duration
        newStartDate = originalStartDate;
        newDuration = Math.max(1, originalDuration + daysMoved);
      }

      try {
        const { error } = await supabase
          .from('project_team_assignments')
          .update({
            start_date: format(newStartDate, 'yyyy-MM-dd'),
            duration: newDuration,
          })
          .eq('project_id', project.id);

        if (error) throw error;

        toast.success('Project duration updated');

        // Optimistically update local state
        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  project_team_assignments: p.project_team_assignments?.map((assignment, idx) =>
                    idx === 0
                      ? { ...assignment, start_date: format(newStartDate, 'yyyy-MM-dd'), duration: newDuration }
                      : assignment
                  ) || []
                }
              : p
          )
        );

        // Refresh data in background
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            client,
            installation_date,
            progress
          `)
          .not('installation_date', 'is', null)
          .order('installation_date');

        if (!projectsError && projectsData) {
          const projectIds = projectsData.map(p => p.id).filter(Boolean);
          let assignmentsByProject: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>> = {};
          if (projectIds.length > 0) {
            const { data: assignments, error: assignError } = await supabase
              .from('project_team_assignments')
              .select('project_id, team, team_id, start_date, duration')
              .in('project_id', projectIds as string[]);
            if (!assignError && assignments) {
              assignmentsByProject = assignments.reduce((acc: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>, a: any) => {
                const pid = a.project_id as string;
                (acc[pid] = acc[pid] || []).push({ team: a.team, team_id: a.team_id, start_date: a.start_date, duration: a.duration });
                return acc;
              }, {} as Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>);
            }
          }
          const mergedProjects = projectsData.map((p: any) => ({
            ...p,
            project_team_assignments: assignmentsByProject[p.id] || [],
          }));
          setProjects(mergedProjects);
        }
      } catch (error) {
        console.error('Error updating project duration:', error);
        toast.error('Failed to update project duration');
        // Reset deltas on error
        setResizeDelta({ left: 0, right: 0 });
      }

      setResizingProject(null);
      setResizeDelta({ left: 0, right: 0 });
    }

    if (draggingProject) {
      const { project, teamId, initialLeft, dayWidth } = draggingProject;
      const daysMoved = Math.round(dragOffset / dayWidth);

      if (daysMoved !== 0) {
        const teamAssignments = project.project_team_assignments;
        const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;

        if (assignment) {
          const newStartDate = addDays(parseYMD(assignment.start_date), daysMoved);

          try {
            const { error } = await supabase
              .from('project_team_assignments')
              .update({
                start_date: format(newStartDate, 'yyyy-MM-dd'),
              })
              .eq('project_id', project.id);

            if (error) throw error;

            toast.success('Project moved successfully');

            // Optimistically update local state
            setProjects(prevProjects =>
              prevProjects.map(p =>
                p.id === project.id
                  ? {
                      ...p,
                      project_team_assignments: p.project_team_assignments?.map((assignment, idx) =>
                        idx === 0
                          ? { ...assignment, start_date: format(newStartDate, 'yyyy-MM-dd') }
                          : assignment
                      ) || []
                    }
                  : p
              )
            );

            // Refresh data in background
            const { data: projectsData, error: projectsError } = await supabase
              .from('projects')
              .select(`
                id,
                name,
                client,
                installation_date,
                progress
              `)
              .not('installation_date', 'is', null)
              .order('installation_date');

            if (!projectsError && projectsData) {
              const projectIds = projectsData.map(p => p.id).filter(Boolean);
              let assignmentsByProject: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>> = {};
              if (projectIds.length > 0) {
                const { data: assignments, error: assignError } = await supabase
                  .from('project_team_assignments')
                  .select('project_id, team, team_id, start_date, duration')
                  .in('project_id', projectIds as string[]);
                if (!assignError && assignments) {
                  assignmentsByProject = assignments.reduce((acc: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>, a: any) => {
                    const pid = a.project_id as string;
                    (acc[pid] = acc[pid] || []).push({ team: a.team, team_id: a.team_id, start_date: a.start_date, duration: a.duration });
                    return acc;
                  }, {} as Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>);
                }
              }
              const mergedProjects = projectsData.map((p: any) => ({
                ...p,
                project_team_assignments: assignmentsByProject[p.id] || [],
              }));
              setProjects(mergedProjects);
            }
          } catch (error) {
            console.error('Error updating project position:', error);
            toast.error('Failed to move project');
            // Reset offset on error
            setDragOffset(0);
          }
        }
      }

      setDraggingProject(null);
      setDragOffset(0);
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch placement teams
        let teamsQuery = supabase
          .from('placement_teams')
          .select('id, name, color, is_active')
          .eq('is_active', true)
          .order('name');
        teamsQuery = applyTenantFilter(teamsQuery, tenant?.id);
        const { data: teamsData, error: teamsError } = await teamsQuery;

        if (teamsError) throw teamsError;

        // Fetch projects directly from projects table
        let projectsQuery = supabase
          .from('projects')
          .select(`
            id,
            name,
            client,
            installation_date,
            progress
          `)
          .not('installation_date', 'is', null)
          .order('installation_date');
        projectsQuery = applyTenantFilter(projectsQuery, tenant?.id);
        const { data: projectsData, error: projectsError } = await projectsQuery;

        if (projectsError) throw projectsError;

        const baseTeams = teamsData || [];
        const hasUnnamed = baseTeams.some(t => (t.name?.toLowerCase?.() === 'unnamed') || t.id === 'unnamed');
        const teamsWithUnnamed = hasUnnamed ? baseTeams : [...baseTeams, { id: 'unnamed', name: 'unnamed', color: 'gray', is_active: true }];
        setTeams(teamsWithUnnamed);

        // Fetch team assignments for all projects and merge locally
        const projectIds = (projectsData || []).map(p => p.id).filter(Boolean);
        let assignmentsByProject: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>> = {};
        if (projectIds.length > 0) {
          const { data: assignments, error: assignError } = await supabase
            .from('project_team_assignments')
            .select('project_id, team, team_id, start_date, duration')
            .in('project_id', projectIds as string[]);
          if (assignError) throw assignError;
          assignmentsByProject = (assignments || []).reduce((acc: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>, a: any) => {
            const pid = a.project_id as string;
            (acc[pid] = acc[pid] || []).push({ team: a.team, team_id: a.team_id, start_date: a.start_date, duration: a.duration });
            return acc;
          }, {} as Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>);
        }

        const mergedProjects = (projectsData || []).map((p: any) => ({
          ...p,
          project_team_assignments: assignmentsByProject[p.id] || [],
        }));
        
        // Fetch team members for all teams
        const teamMembersPromises = teamsWithUnnamed
          .filter(team => team.id !== 'unnamed')
          .map(async (team) => {
            const { data: memberData } = await supabase
              .from('placement_team_members')
              .select(`
                employee_id,
                employees!inner(id, name)
              `)
              .eq('team_id', team.id);
            
            return {
              teamId: team.id,
              members: memberData?.map((m: any) => m.employees) || []
            };
          });
        
        const teamMembersResults = await Promise.all(teamMembersPromises);
        const teamMembersMap: Record<string, Employee[]> = {};
        teamMembersResults.forEach(result => {
          teamMembersMap[result.teamId] = result.members;
        });
        
        // Update teams with members
        const teamsWithMembers = teamsWithUnnamed.map(team => ({
          ...team,
          members: teamMembersMap[team.id] || []
        }));
        setTeams(teamsWithMembers);
        
        // Fetch employees and trucks for each project based on team assignments
        const projectsWithEmployees = await Promise.all(
          mergedProjects.map(async (project) => {
            const assignment = project.project_team_assignments?.[0];
            if (!assignment?.team_id || !assignment?.start_date || !assignment?.duration) {
              return project;
            }
            
            // Fetch all employees assigned via daily_team_assignments for this project
            const endDate = format(
              addDays(parseYMD(assignment.start_date), assignment.duration - 1),
              'yyyy-MM-dd'
            );
            
            const { data: assignedEmployeesData } = await supabase
              .from('daily_team_assignments')
              .select(`
                employee_id,
                employees!inner(id, name)
              `)
              .eq('team_id', assignment.team_id)
              .gte('date', assignment.start_date)
              .lte('date', endDate);
            
            // Get unique employees from assignments
            const employees = Array.from(
              new Map((assignedEmployeesData || []).map((item: any) => [item.employees.id, item.employees])).values()
            ) as Employee[];
            
            // Check holiday requests for employees during project period
            const { data: holidayData } = await supabase
              .from('holiday_requests')
              .select('user_id')
              .eq('status', 'approved')
              .lte('start_date', endDate)
              .gte('end_date', assignment.start_date);
            
            const employeesOnHoliday = new Set(holidayData?.map(h => h.user_id) || []);
            
            // Fetch truck assignment for this project
            const { data: truckAssignment } = await supabase
              .from('project_truck_assignments')
              .select('truck_id')
              .eq('project_id', project.id)
              .single();
            
            let truck = undefined;
            if (truckAssignment?.truck_id) {
              const { data: truckData } = await supabase
                .from('trucks')
                .select('truck_number, description')
                .eq('id', truckAssignment.truck_id)
                .single();
              
              if (truckData) {
                truck = truckData;
              }
            }
            
            return {
              ...project,
              employees,
              employeesOnHoliday,
              truck
            };
          })
        );
        
        setProjects(projectsWithEmployees);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get date range for the timeline
  const dateRange = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(addDays(weekStart, (weeksToShow * 7) - 1), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentWeek, weeksToShow]);

  // Group dates by week
  const weekGroups = useMemo(() => {
    const groups: { weekNumber: number; days: Date[] }[] = [];
    let currentWeekNum = -1;
    let currentGroup: Date[] = [];

    dateRange.forEach((date) => {
      const weekNum = getWeek(date, { weekStartsOn: 1, locale: nl });
      if (weekNum !== currentWeekNum) {
        if (currentGroup.length > 0) {
          groups.push({ weekNumber: currentWeekNum, days: currentGroup });
        }
        currentWeekNum = weekNum;
        currentGroup = [date];
      } else {
        currentGroup.push(date);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ weekNumber: currentWeekNum, days: currentGroup });
    }

    return groups;
  }, [dateRange]);

  // Group projects by team - only include projects visible in current date range
  const projectsByTeam = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    
    // Initialize all teams with empty arrays
    teams.forEach((team) => {
      grouped[team.id] = [];
    });

    // Define exact team category mapping
    const getTeamCategory = mapTeamToCategory;

    // Check if project is visible in current date range
    const isProjectVisible = (project: Project): boolean => {
      const teamAssignments = project.project_team_assignments;
      const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;
      
      // If no assignment, show in "unnamed" team (always visible)
      if (!assignment?.start_date || !assignment?.duration) {
        return true;
      }

      const startDate = parseYMD(assignment.start_date);
      const duration = assignment.duration;
      const endDate = addDays(startDate, duration - 1);

      const firstDay = dateRange[0];
      const lastDay = dateRange[dateRange.length - 1];
      
      // Project is visible if it overlaps with the date range
      return endDate >= firstDay && startDate <= lastDay;
    };

    projects.forEach((project) => {
      // Only include projects that are visible in current date range
      if (!isProjectVisible(project)) {
        return;
      }

      const teamAssignments = project.project_team_assignments;
      let targetTeamId = 'unnamed';
      
      if (teamAssignments && teamAssignments.length > 0) {
        const assignment = teamAssignments[0];
        // Use team_id directly if available, otherwise fall back to team name matching
        if (assignment.team_id) {
          // Verify this team_id exists in our teams list
          const teamExists = teams.find(t => t.id === assignment.team_id);
          targetTeamId = teamExists ? assignment.team_id : 'unnamed';
        } else if (assignment.team) {
          // Fallback to old team name matching
          const targetCategory = getTeamCategory(assignment.team, teams);
          const matchedTeam = teams.find(t => t.name === targetCategory);
          targetTeamId = matchedTeam?.id || 'unnamed';
        }
      }
      
      (grouped[targetTeamId] = grouped[targetTeamId] || []).push(project);
    });

    // Sort projects within each team by installation date (oldest to newest)
    Object.keys(grouped).forEach(teamId => {
      grouped[teamId].sort((a, b) => {
        const dateA = new Date(a.installation_date).getTime();
        const dateB = new Date(b.installation_date).getTime();
        return dateA - dateB;
      });
    });

    return grouped;
  }, [projects, teams, dateRange]);

  // Measure timeline container width
  useLayoutEffect(() => {
    const update = () => {
      const el = timelineRef.current;
      if (el) {
        const total = el.getBoundingClientRect().width;
        setContainerWidth(Math.max(0, total - 256));
      } else {
        setContainerWidth(Math.max(0, window.innerWidth - 1040));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [teams, projects, loading]);

  // Calculate project bar position and width to match calendar grid exactly
  const getProjectPosition = (project: Project, teamName: string) => {
    const teamAssignments = project.project_team_assignments || [];
    // Prefer assignment that matches the team row
    const matchedAssignment = teamAssignments.find((a) => mapTeamToCategory(a.team, teams) === teamName) || teamAssignments[0];
    if (!matchedAssignment?.start_date || !matchedAssignment?.duration) return null;

    const startDate = parseYMD(matchedAssignment.start_date);
    const duration = Math.max(1, matchedAssignment.duration);

    // Calculate using same formula as calendar grid cells
    const totalDays = dateRange.length;
    
    // Start position: index of the first day relative to the range start
    const startDayIndex = differenceInDays(startDate, dateRange[0]);
    const endDayIndex = startDayIndex + duration - 1; // inclusive

    // Clip to visible range [0, totalDays - 1]
    const firstIndex = 0;
    const lastIndex = totalDays - 1;
    const displayStart = Math.max(firstIndex, Math.min(lastIndex, startDayIndex));
    const displayEnd = Math.max(firstIndex, Math.min(lastIndex, endDayIndex));

    // Visible width in whole days (inclusive)
    const visibleWidth = displayEnd >= displayStart ? (displayEnd - displayStart + 1) : 0;

    return {
      left: displayStart,
      width: visibleWidth,
      totalDays,
      startIndex: startDayIndex,
      durationDays: duration,
      assignment: matchedAssignment,
    };
  };


  // Toggle team collapse
  const toggleTeam = (teamId: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Drag and resize handlers
  const handleDragStart = (project: Project, teamId: string) => {
    setDraggedProject({ project, teamId });
  };

  const handleMouseDown = (e: React.MouseEvent, project: Project, teamId: string) => {
    e.preventDefault();
    const container = e.currentTarget.closest('[data-timeline]') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const calendarGridWidth = rect.width - 256;
    const dayWidth = calendarGridWidth / dateRange.length;

    setDraggingProject({
      project,
      teamId,
      initialX: e.clientX,
      initialLeft: 0, // Will be calculated in render
      dayWidth,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingProject) {
      const deltaX = e.clientX - draggingProject.initialX;
      const daysMoved = Math.round(deltaX / draggingProject.dayWidth);
      setDragOffset(daysMoved * draggingProject.dayWidth);
    }

    if (resizingProject) {
      const { edge, startX } = resizingProject;
      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      const calendarGridWidth = rect.width - 256;
      const dayWidth = calendarGridWidth / dateRange.length;
      const pixelsMoved = e.clientX - startX;
      const daysMoved = Math.round(pixelsMoved / dayWidth);

      if (edge === 'left') {
        setResizeDelta({ left: daysMoved * dayWidth, right: 0 });
      } else {
        setResizeDelta({ left: 0, right: daysMoved * dayWidth });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetTeamId: string, targetDate: Date) => {
    if (!draggedProject) return;

    const { project } = draggedProject;
    const teamAssignments = project.project_team_assignments;
    const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;

    if (!assignment) {
      toast.error('No team assignment found for this project');
      setDraggedProject(null);
      return;
    }

    // Find the target team name
    const targetTeam = teams.find(t => t.id === targetTeamId);
    if (!targetTeam) {
      toast.error('Target team not found');
      setDraggedProject(null);
      return;
    }

    try {
      // Update the project team assignment in the database
      const { error } = await supabase
        .from('project_team_assignments')
        .update({
          team: targetTeam.name,
          team_id: targetTeam.id,
          start_date: format(targetDate, 'yyyy-MM-dd'),
        })
        .eq('project_id', project.id);

      if (error) throw error;

      toast.success('Project moved successfully');
      
      // Refresh data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          client,
          installation_date,
          progress
        `)
        .not('installation_date', 'is', null)
        .order('installation_date');

      if (!projectsError && projectsData) {
        // fetch assignments again and merge
        const projectIds = projectsData.map(p => p.id).filter(Boolean);
        let assignmentsByProject: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>> = {};
        if (projectIds.length > 0) {
          const { data: assignments, error: assignError } = await supabase
            .from('project_team_assignments')
            .select('project_id, team, team_id, start_date, duration')
            .in('project_id', projectIds as string[]);
          if (!assignError && assignments) {
            assignmentsByProject = assignments.reduce((acc: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>, a: any) => {
              const pid = a.project_id as string;
              (acc[pid] = acc[pid] || []).push({ team: a.team, team_id: a.team_id, start_date: a.start_date, duration: a.duration });
              return acc;
            }, {} as Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>);
          }
        }
        const mergedProjects = projectsData.map((p: any) => ({
          ...p,
          project_team_assignments: assignmentsByProject[p.id] || [],
        }));
        setProjects(mergedProjects);
      }
    } catch (error) {
      console.error('Error updating project assignment:', error);
      toast.error('Failed to move project');
    }

    setDraggedProject(null);
  };

  // Navigation
  const goToPreviousWeek = () => setCurrentWeek(addDays(currentWeek, -7));
  const goToNextWeek = () => setCurrentWeek(addDays(currentWeek, 7));
  const goToToday = () => setCurrentWeek(new Date());

  // Get column width percentage
  const dayWidth = 100 / dateRange.length;

  // Find today's position for the indicator
  const todayPosition = useMemo(() => {
    const today = new Date();
    const todayIndex = dateRange.findIndex((date) => isSameDay(date, today));
    if (todayIndex === -1) return null;
    return (todayIndex / dateRange.length) * 100;
  }, [dateRange]);

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className={cn('flex flex-col bg-background h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-2xl font-semibold min-w-[250px] text-center">
              {format(dateRange[0], 'd', { locale: nl })} - {format(dateRange[dateRange.length - 1], 'd MMM yyyy', { locale: nl })}
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday}>
            <Calendar className="h-4 w-4 mr-2" />
            Vandaag
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{weeksToShow} weken</span>
          <input
            type="range"
            min="1"
            max="8"
            value={weeksToShow}
            onChange={(e) => setWeeksToShow(Number(e.target.value))}
            className="w-32"
          />
        </div>
      </div>

      {/* Timeline */}
      {/* Timeline Header */}
      <div className="sticky top-0 z-10 bg-background border-b relative">
        {/* Week headers */}
        <div className="flex border-b bg-primary">
          <div className="w-64 flex-shrink-0" /> {/* Spacer for team names */}
          {weekGroups.map((week) => (
            <div
              key={week.weekNumber}
              className="flex-shrink-0 px-2 py-2 text-xs font-semibold text-primary-foreground border-r border-primary-foreground/20"
              style={{ width: `calc((100% - 16rem) * ${week.days.length / dateRange.length})` }}
            >
              Week {week.weekNumber}
            </div>
          ))}
        </div>

        {/* Day headers */}
        <div className="flex bg-accent">
          <div className="w-64 flex-shrink-0" /> {/* Spacer for team names */}
          {dateRange.map((date, idx) => {
            const isWeekStart = date.getDay() === 1;
            return (
              <div
                key={idx}
                className={cn(
                  'flex-shrink-0 text-center border-r border-accent-foreground/20',
                  isWeekStart && 'border-l-2 border-l-accent-foreground/40'
                )}
                style={{ width: `calc((100% - 16rem) / ${dateRange.length})` }}
              >
                <div className="text-xs font-medium text-accent-foreground py-1">
                  {format(date, 'd-MM', { locale: nl })}
                </div>
                <div className="text-xs py-1 text-accent-foreground/80">
                  {format(date, 'EEEEEE', { locale: nl })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today label */}
        {todayPosition !== null && (
          <div
            className="absolute top-0 bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-b whitespace-nowrap z-20"
            style={{ left: `calc(16rem + ${todayPosition}% - 20px)` }}
          >
            Vandaag
          </div>
        )}
      </div>

      <div className="overflow-x-auto overflow-y-visible flex-1 scrollbar-hide" ref={timelineRef}>
        <div className="relative w-full">
          {/* Team rows */}
          <div className="relative">
            {/* Today indicator line */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10 pointer-events-none"
                style={{ left: `calc(16rem + ${todayPosition}%)` }}
              />
            )}

            {teams.map((team) => {
              const teamProjects = projectsByTeam[team.id] || [];
              const isCollapsed = collapsedTeams.has(team.id);

              return (
                <div key={team.id} className="border-b border-border">
                  {/* Team header */}
                  <div
                    className="flex items-center cursor-pointer hover:bg-muted/50 sticky left-0 z-10 bg-card border-t transition-colors"
                    onClick={() => toggleTeam(team.id)}
                  >
                    <div className="w-64 flex-shrink-0 px-4 py-3 font-medium flex items-center gap-2 border-r border-border">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform text-muted-foreground',
                          !isCollapsed && 'rotate-90'
                        )}
                      />
                      <span className="text-sm font-semibold text-foreground">{team.name}</span>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Team projects */}
                  {!isCollapsed && (
                    <div
                      className="relative"
                      style={{ minHeight: teamProjects.length > 0 ? `${teamProjects.length * 36 + 16}px` : '80px' }}
                      onDragOver={handleDragOver}
                      onMouseUp={handleMouseUp}
                      onMouseMove={handleMouseMove}
                      data-timeline
                    >
                      <div className="flex absolute inset-0">
                        <div className="w-64 flex-shrink-0 border-r border-border bg-muted/30 py-2">
                          {/* Team members in left column */}
                          {teamProjects.map((project, idx) => (
                            <div
                              key={project.id}
                              className="px-2 text-xs"
                              style={{ 
                                position: 'absolute',
                                top: `${8 + idx * 32}px`,
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                width: '256px'
                              }}
                            >
                              <div className="truncate">
                                {project.truck && (
                                  <div className="text-xs font-semibold text-foreground mb-0.5 flex items-center gap-1">
                                    <span className="text-primary">🚛 T{project.truck.truck_number}</span>
                                  </div>
                                )}
                                {project.employees && project.employees.length > 0 ? (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {project.employees.map((emp, empIdx) => {
                                      const isOnHoliday = project.employeesOnHoliday?.has(emp.id);
                                      return (
                                        <React.Fragment key={emp.id}>
                                          {empIdx > 0 && ', '}
                                          <span className={isOnHoliday ? 'text-destructive font-semibold' : ''}>
                                            {emp.name}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground/50 italic">No employees assigned</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Day columns */}
                        {dateRange.map((date, idx) => {
                          const isWeekStart = date.getDay() === 1;
                          const isToday = isSameDay(date, new Date());
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'flex-shrink-0 border-r border-border/50',
                                idx % 2 === 0 ? 'bg-muted/20' : 'bg-background',
                                isWeekStart && 'border-l-2 border-l-border',
                                isToday && 'bg-accent/10'
                              )}
                              style={{ width: `calc((100% - 16rem) / ${dateRange.length})` }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDrop(team.id, date);
                              }}
                            />
                          );
                        })}
                      </div>

                      {teamProjects.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                          Geen projecten in deze periode
                        </div>
                      )}

                      {/* Project bars - positioned in calendar grid only */}
                      <div className="absolute left-64 right-0 top-0 z-10 py-2 pointer-events-none">
                          {teamProjects.map((project, idx) => {
                            const position = getProjectPosition(project, team.name);
                            
                            // For unassigned projects, show a placeholder indicator
                            if (!position) {
                              return (
                                <div
                                  key={project.id}
                                  className="absolute pointer-events-auto"
                                  style={{
                                    left: '8px',
                                    top: `${8 + idx * 32}px`,
                                    height: '28px',
                                  }}
                                >
                                  <div
                                    className="h-7 px-3 rounded flex items-center bg-muted border border-border cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => {
                                      setSelectedProject({
                                        id: project.id,
                                        name: project.name,
                                        teamId: null,
                                        startDate: '',
                                        duration: 0,
                                      });
                                    }}
                                    title={`${project.name} - Not scheduled`}
                                  >
                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                      {project.name} - Not scheduled
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            const teamAssignment = position.assignment;
                            const projectLabel = `${project.name} - ${project.progress || 0}%`;

                            // Get team color from placement_teams using team_id
                            let teamColor = team.color || '#ef4444'; // Default to red if no color
                            if (teamAssignment?.team_id) {
                              const assignedTeam = teams.find(t => t.id === teamAssignment.team_id);
                              if (assignedTeam?.color) {
                                teamColor = assignedTeam.color;
                              }
                            }

                            // Estimate if label fits inside bar (approximate)
                            const labelFitsInside = position.width >= 3; // Show inside if 3+ visible days

                            // Calculate drag offset for this project
                            const isDraggingThisProject = draggingProject?.project.id === project.id;
                            const dragLeftOffset = isDraggingThisProject ? dragOffset : 0;

                            // Calculate resize delta for this project
                            const isResizingThisProject = resizingProject?.project.id === project.id;
                            const resizeLeftOffset = isResizingThisProject ? resizeDelta.left : 0;
                            const resizeWidthOffset = isResizingThisProject ? (resizeDelta.left + resizeDelta.right) : 0;

                            // Check if any employee is on holiday
                            const hasEmployeeOnHoliday = project.employees?.some(emp => 
                              project.employeesOnHoliday?.has(emp.id)
                            );

                            // Decide where to place the outside label so it never creates extra horizontal scroll
                            const dayWidthPx = position.totalDays > 0 ? containerWidth / position.totalDays : 0;
                            const barStartPx = dayWidthPx * position.left;
                            const barWidthPx = dayWidthPx * position.width;
                            const barEndPx = barStartPx + barWidthPx;

                            const rightSpacePx = Math.max(0, containerWidth - barEndPx);
                            const leftSpacePx = Math.max(0, barStartPx);

                            // If there isn't enough room on the right, place it on the left (when that helps)
                            const placeOutsideLabelLeft = rightSpacePx < 160 && leftSpacePx > rightSpacePx;
                            const outsideLabelMaxWidth = Math.max(
                              0,
                              (placeOutsideLabelLeft ? leftSpacePx : rightSpacePx) - 12
                            );

                            return (
                              <div
                                key={project.id}
                                className="absolute flex items-center gap-1"
                                style={{
                                  left: `calc(100% / ${position.totalDays} * ${position.left})`,
                                  top: `${8 + idx * 32}px`,
                                  height: '28px',
                                }}

                              >
                                 {/* Label outside bar on the LEFT if needed */}
                                 {!labelFitsInside && placeOutsideLabelLeft && outsideLabelMaxWidth > 0 && (
                                   <div
                                     className="absolute bg-muted px-2 py-1 rounded text-xs font-medium text-muted-foreground shadow-sm truncate"
                                     style={{ 
                                       maxWidth: `${outsideLabelMaxWidth}px`,
                                       right: '100%',
                                       marginRight: '4px',
                                     }}
                                     title={projectLabel}
                                   >
                                     {projectLabel}
                                   </div>
                                 )}

                                 {/* Project bar */}
                                 <div
                                   className="relative h-7 hover:opacity-90 transition-opacity rounded flex items-center overflow-hidden shadow-sm group pointer-events-auto cursor-pointer"
                                   style={{
                                     width: `${(containerWidth / position.totalDays) * position.width}px`,
                                     backgroundColor: hasEmployeeOnHoliday ? '#ef4444' : teamColor,
                                     opacity: isDraggingThisProject ? 0.8 : 1,
                                   }}
                                   title={`${projectLabel}\nStart: ${teamAssignment?.start_date || 'N/A'}\nDuration: ${teamAssignment?.duration || 0} days`}
                                   onClick={() => {
                                     if (teamAssignment) {
                                       setSelectedProject({
                                         id: project.id,
                                         name: project.name,
                                         teamId: teamAssignment.team_id,
                                         startDate: teamAssignment.start_date,
                                         duration: teamAssignment.duration,
                                       });
                                     }
                                   }}
                                 >
                                   {/* Left resize handle */}
                                   <div
                                     className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                                     onMouseDown={(e) => handleResizeStart(e, project, team.id, 'left')}
                                     onClick={(e) => e.stopPropagation()}
                                   >
                                     <GripVertical className="h-4 w-4 text-white/80" />
                                   </div>

                                   {/* Right resize handle */}
                                   <div
                                     className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                                     onMouseDown={(e) => handleResizeStart(e, project, team.id, 'right')}
                                     onClick={(e) => e.stopPropagation()}
                                   >
                                     <GripVertical className="h-4 w-4 text-white/80" />
                                   </div>

                                   {/* Project label */}
                                   <div className="px-2 text-xs text-white font-medium truncate flex-1">
                                     <div className="truncate">{projectLabel}</div>
                                   </div>
                                 </div>

                                 {/* Label outside bar on the RIGHT if needed */}
                                 {!labelFitsInside && !placeOutsideLabelLeft && outsideLabelMaxWidth > 0 && (
                                   <div
                                     className="bg-muted px-2 py-1 rounded text-xs font-medium text-muted-foreground shadow-sm truncate"
                                     style={{ maxWidth: `${outsideLabelMaxWidth}px` }}
                                     title={projectLabel}
                                   >
                                     {projectLabel}
                                   </div>
                                 )}
                               </div>
                             );
                           })}
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Project Assignment Dialog */}
      {selectedProject && (
        <ProjectAssignmentDialog
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          currentTeamId={selectedProject.teamId}
          currentStartDate={selectedProject.startDate}
          currentDuration={selectedProject.duration}
          onUpdate={async () => {
            try {
              // Refresh data after update
              let projectsQuery = supabase
                .from('projects')
                .select(`
                  id,
                  name,
                  client,
                  installation_date,
                  progress
                `)
                .not('installation_date', 'is', null)
                .order('installation_date');
              projectsQuery = applyTenantFilter(projectsQuery, tenant?.id);
              const { data: projectsData, error: projectsError } = await projectsQuery;

              if (projectsError) throw projectsError;
              if (!projectsData) return;

              const projectIds = projectsData.map(p => p.id).filter(Boolean);
              let assignmentsByProject: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>> = {};
              if (projectIds.length > 0) {
                const { data: assignments, error: assignError } = await supabase
                  .from('project_team_assignments')
                  .select('project_id, team, team_id, start_date, duration')
                  .in('project_id', projectIds as string[]);
                if (!assignError && assignments) {
                  assignmentsByProject = assignments.reduce((acc: Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>, a: any) => {
                    const pid = a.project_id as string;
                    (acc[pid] = acc[pid] || []).push({ team: a.team, team_id: a.team_id, start_date: a.start_date, duration: a.duration });
                    return acc;
                  }, {} as Record<string, Array<{ team: string; team_id: string | null; start_date: string; duration: number }>>);
                }
              }
              const mergedProjects = projectsData.map((p: any) => ({
                ...p,
                project_team_assignments: assignmentsByProject[p.id] || [],
              }));
              
              // Fetch truck assignments for all projects
              const { data: truckAssignmentsData } = await supabase
                .from('project_truck_assignments')
                .select(`
                  project_id,
                  trucks!inner(truck_number, description)
                `)
                .in('project_id', projectIds.length > 0 ? projectIds as string[] : ['__none__']);
              
              const trucksByProject = new Map(
                (truckAssignmentsData || []).map(ta => [
                  ta.project_id,
                  { truck_number: ta.trucks.truck_number, description: ta.trucks.description }
                ])
              );

              // Re-fetch employees and holiday data for updated projects
              const projectsWithEmployees = await Promise.all(
                mergedProjects.map(async (project) => {
                  const assignment = project.project_team_assignments?.[0];
                  if (!assignment?.team_id || !assignment?.start_date || !assignment?.duration) {
                    return { ...project, truck: trucksByProject.get(project.id) };
                  }
                  
                  const endDate = format(
                    addDays(parseYMD(assignment.start_date), assignment.duration - 1),
                    'yyyy-MM-dd'
                  );

                  const { data: dailyAssignments } = await supabase
                    .from('daily_team_assignments')
                    .select(`
                      employee_id,
                      employees!inner(id, name)
                    `)
                    .eq('team_id', assignment.team_id)
                    .gte('date', assignment.start_date)
                    .lte('date', endDate);

                  const uniqueEmployees = new Map<string, Employee>();
                  dailyAssignments?.forEach((da: any) => {
                    if (da.employees) {
                      uniqueEmployees.set(da.employees.id, da.employees);
                    }
                  });
                  const employees = Array.from(uniqueEmployees.values());
                  
                  const { data: holidayData } = await supabase
                    .from('holiday_requests')
                    .select('user_id')
                    .eq('status', 'approved')
                    .lte('start_date', endDate)
                    .gte('end_date', assignment.start_date);
                  
                  const employeesOnHoliday = new Set(holidayData?.map(h => h.user_id) || []);
                  
                  return {
                    ...project,
                    employees,
                    employeesOnHoliday,
                    truck: trucksByProject.get(project.id)
                  };
                })
              );
              
              setProjects(projectsWithEmployees);
            } catch (err) {
              console.error('Failed to refresh Gantt data:', err);
            }
          }}
        />
      )}
    </div>
  );
};

export default OrdersGanttChart;
