import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, getWeek, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


interface PlacementTeam {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
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
        const { data: teamsData, error: teamsError } = await supabase
          .from('placement_teams')
          .select('id, name, color, is_active')
          .eq('is_active', true)
          .order('name');

        if (teamsError) throw teamsError;

        // Fetch projects directly from projects table
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
        setProjects(mergedProjects);
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
      
      if (!assignment?.start_date || !assignment?.duration) {
        return false; // Skip projects without proper assignment data
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
  }, []);

  // Calculate project bar position as percentages, aligned to calendar grid
  const getProjectPosition = (project: Project, teamName: string) => {
    const teamAssignments = project.project_team_assignments || [];
    // Prefer assignment that matches the team row
    const matchedAssignment = teamAssignments.find((a) => mapTeamToCategory(a.team, teams) === teamName) || teamAssignments[0];
    if (!matchedAssignment?.start_date || !matchedAssignment?.duration) return null;

    const startDate = parseYMD(matchedAssignment.start_date);
    const duration = Math.max(1, matchedAssignment.duration);

    // Calculate percentages based on dateRange length (same as calendar grid)
    const totalDays = dateRange.length;
    const cellWidthPercent = 100 / totalDays; // width of one day as percentage
    const barWidthPercent = cellWidthPercent * duration; // bar width = cell width × duration

    // Calculate start position relative to first day in dateRange
    const startDayIndex = differenceInDays(startDate, dateRange[0]);
    const leftPercent = startDayIndex * cellWidthPercent;

    // Clip to visible range [0, 100%]
    const visibleLeftPercent = Math.max(0, leftPercent);
    const visibleRightPercent = Math.min(100, leftPercent + barWidthPercent);
    const visibleWidthPercent = Math.max(0, visibleRightPercent - visibleLeftPercent);

    return {
      left: visibleLeftPercent,
      width: visibleWidthPercent,
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

      <div className="overflow-x-auto overflow-y-visible flex-1" ref={timelineRef}>
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
                        <div className="w-64 flex-shrink-0 border-r border-border bg-muted/30" />
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
                            if (!position) return null;

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
                            const labelFitsInside = position.width > 80; // If bar is more than 80px

                            // Calculate drag offset for this project
                            const isDraggingThisProject = draggingProject?.project.id === project.id;
                            const dragLeftOffset = isDraggingThisProject ? dragOffset : 0;

                            // Calculate resize delta for this project
                            const isResizingThisProject = resizingProject?.project.id === project.id;
                            const resizeLeftOffset = isResizingThisProject ? resizeDelta.left : 0;
                            const resizeWidthOffset = isResizingThisProject ? (resizeDelta.left + resizeDelta.right) : 0;

                            return (
                              <div
                                key={project.id}
                                className="absolute flex items-center gap-1"
                                style={{
                                  left: `${position.left}%`,
                                  top: `${8 + idx * 32}px`,
                                  height: '28px',
                                }}

                              >
                                {/* Project bar */}
                                <div
                                  className="relative h-7 hover:opacity-90 transition-opacity rounded flex items-center overflow-hidden shadow-sm group pointer-events-auto"
                                  style={{
                                    width: `${position.width}%`,
                                    backgroundColor: teamColor,
                                    opacity: isDraggingThisProject ? 0.8 : 1,
                                  }}
                                  title={`${projectLabel}\nStart: ${teamAssignment?.start_date || 'N/A'}\nDuration: ${teamAssignment?.duration || 0} days`}
                                >
                                  {/* Left resize handle */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => handleResizeStart(e, project, team.id, 'left')}
                                  />

                                  {/* Draggable center area */}
                                  <div
                                    draggable
                                    onDragStart={() => handleDragStart(project, team.id)}
                                    onMouseDown={(e) => handleMouseDown(e, project, team.id)}
                                    className="flex-1 flex items-center cursor-move px-2"
                                  >
                                    {labelFitsInside && (
                                      <span className="text-xs font-medium text-white truncate">
                                        {projectLabel}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right resize handle */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => handleResizeStart(e, project, team.id, 'right')}
                                  />
                                </div>

                                {/* Label to the right of bar if doesn't fit inside */}
                                {!labelFitsInside && (
                                  <div className="bg-muted px-2 py-1 rounded text-xs font-medium text-muted-foreground whitespace-nowrap shadow-sm">
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
    </div>
  );
};

export default OrdersGanttChart;
