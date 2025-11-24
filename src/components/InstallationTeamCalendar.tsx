import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarDays, Truck, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/context/LanguageContext';

// Define project type
interface Project {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
  [key: string]: any;
}

// Define assignment type
interface Assignment {
  id: string;
  project_id: string;
  team: string;
  team_id?: string;
  start_date: string;
  duration: number;
  created_at?: string;
  updated_at?: string;
}

// Define truck assignment type
interface TruckAssignment {
  id: string;
  project_id: string;
  truck_id: string;
  loading_date: string;
  installation_date: string;
  truck?: {
    truck_number: string;
  };
}

// Define truck type
interface Truck {
  id: string;
  truck_number: string;
  description?: string;
}

// Define item type for drag and drop
interface DragItem {
  type: string;
  id: string;
  team: string;
  teamId?: string;
  assignment?: Assignment;
}

// Helper function to skip weekends
const addBusinessDays = (date: Date, days: number): Date => {
  let result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result = addDays(result, 1);
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result;
};

// Helper function to calculate business days between dates
const getBusinessDaysArray = (startDate: Date, duration: number): Date[] => {
  const days: Date[] = [];
  let currentDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < duration) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      days.push(new Date(currentDate));
      addedDays++;
    }
    currentDate = addDays(currentDate, 1);
  }
  return days;
};

// Define team colors with flexible color mapping
const getColorClasses = (colorName: string) => {
  const colorMap: Record<string, { bg: string; text: string; border: string; header: string; project: string }> = {
    green: {
      bg: 'bg-green-100 hover:bg-green-200',
      border: 'border-green-300',
      text: 'text-green-800',
      header: 'bg-green-500 text-white',
      project: 'bg-green-200 border-green-400'
    },
    blue: {
      bg: 'bg-blue-100 hover:bg-blue-200',
      border: 'border-blue-300',
      text: 'text-blue-800',
      header: 'bg-blue-500 text-white',
      project: 'bg-blue-200 border-blue-400'
    },
    orange: {
      bg: 'bg-orange-100 hover:bg-orange-200',
      border: 'border-orange-300',
      text: 'text-orange-800',
      header: 'bg-orange-500 text-white',
      project: 'bg-orange-200 border-orange-400'
    },
    red: {
      bg: 'bg-red-100 hover:bg-red-200',
      border: 'border-red-300',
      text: 'text-red-800',
      header: 'bg-red-500 text-white',
      project: 'bg-red-200 border-red-400'
    },
    yellow: {
      bg: 'bg-yellow-100 hover:bg-yellow-200',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      header: 'bg-yellow-500 text-white',
      project: 'bg-yellow-200 border-yellow-400'
    },
    purple: {
      bg: 'bg-purple-100 hover:bg-purple-200',
      border: 'border-purple-300',
      text: 'text-purple-800',
      header: 'bg-purple-500 text-white',
      project: 'bg-purple-200 border-purple-400'
    },
    unassigned: {
      bg: 'bg-gray-100 hover:bg-gray-200',
      border: 'border-gray-300',
      text: 'text-gray-800',
      header: 'bg-gray-500 text-white',
      project: 'bg-gray-200 border-gray-400'
    }
  };
  
  return colorMap[colorName] || colorMap.unassigned;
};

// Get truck color for visual distinction
const getTruckColor = (truckNumber: string) => {
  switch (truckNumber) {
    case '01':
      return 'bg-blue-500 text-white';
    case '02':
      return 'bg-green-500 text-white';
    case '03':
      return 'bg-orange-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

// Duration selector component
const DurationSelector = ({
  value,
  onChange,
  disabled = false
}) => {
  return <div className="flex items-center gap-1">
      <span className="text-xs">Days:</span>
      <Input type="number" min="1" max="30" value={value} onChange={e => onChange(parseInt(e.target.value) || 1)} disabled={disabled} className="h-6 w-16 text-xs" />
    </div>;
};

// Enhanced project item component with navigation button
const ProjectItem = ({
  project,
  team,
  teamId,
  assignment,
  onExtendProject,
  onDurationChange,
  truckAssignment,
  onTruckAssign,
  isStart = true,
  isContinuation = false,
  dayPosition = 0,
  totalDays = 1
}) => {
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const [{
    isDragging
  }, drag] = useDrag(() => ({
    type: 'PROJECT',
    item: {
      id: project.id,
      team: team,
      teamId: teamId,
      assignment: assignment
    },
    collect: monitor => ({
      isDragging: !!monitor.isDragging()
    })
  }));
  // Map team names to colors based on content  
  const getTeamColor = (teamName: string) => {
    if (teamName?.toLowerCase().includes('groen') || teamName?.toLowerCase().includes('green')) return getColorClasses('green');
    if (teamName?.toLowerCase().includes('blauw') || teamName?.toLowerCase().includes('blue')) return getColorClasses('blue');
    if (teamName?.toLowerCase().includes('orange') || teamName?.toLowerCase().includes('oranje')) return getColorClasses('orange');
    if (teamName?.toLowerCase().includes('red') || teamName?.toLowerCase().includes('rood')) return getColorClasses('red');
    if (teamName?.toLowerCase().includes('yellow') || teamName?.toLowerCase().includes('geel')) return getColorClasses('yellow');
    if (teamName?.toLowerCase().includes('purple') || teamName?.toLowerCase().includes('paars')) return getColorClasses('purple');
    return getColorClasses('blue'); // default
  };
  const teamColor = team ? getTeamColor(team) : getColorClasses('unassigned');
  const handleDurationChange = (newDuration: number) => {
    if (assignment && onDurationChange) {
      onDurationChange(assignment.id, newDuration);
    }
  };
  const handleTruckChange = async (truckId: string) => {
    await onTruckAssign(project.id, truckId);
  };
  const handleNavigateToProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(createLocalizedPath(`/projects/${project.id}`));
  };

  // Show full content only on the start day
  const showFullContent = isStart;
  return <div ref={drag} className={cn("relative cursor-move border-2 rounded-lg mb-1", teamColor.project, isDragging ? "opacity-50 z-50" : "opacity-100", isContinuation ? "border-l-0 rounded-l-none" : "", dayPosition === totalDays - 1 && totalDays > 1 ? "border-r-0 rounded-r-none" : "", totalDays > 1 && dayPosition > 0 && dayPosition < totalDays - 1 ? "border-x-0 rounded-none" : "")} style={{
    opacity: isDragging ? 0.5 : 1
  }}>
      <div className="p-2">
        {showFullContent ? <>
            <div className="flex flex-col mb-2">
              <div className="flex justify-between items-start mb-1">
                <div className={cn("font-medium text-sm truncate flex-1", teamColor.text)}>
                  {project.name}
                </div>
              </div>
              
              <div className="text-xs text-gray-600 truncate mb-1">{project.client}</div>
              
              <Button size="sm" variant="ghost" onClick={handleNavigateToProject} className="h-6 w-full justify-start p-1 text-xs hover:bg-white/50">
                <ExternalLink className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </div>
            
            {/* Duration Selector */}
            {team && assignment && <div className="mb-2">
                <DurationSelector value={assignment.duration} onChange={handleDurationChange} />
              </div>}
            
            {/* Truck Assignment */}
            {team && <div className="mb-2">
                <TruckSelector value={truckAssignment?.truck_id || ''} onValueChange={handleTruckChange} truckNumber={truckAssignment?.truck?.truck_number} />
              </div>}
            
            {assignment && <div className="text-xs text-gray-600 mt-1">
                {format(new Date(assignment.start_date), 'MMM d')}
                {assignment.duration > 1 && <span> - {format(addBusinessDays(new Date(assignment.start_date), assignment.duration - 1), 'MMM d')}</span>}
                {truckAssignment && <div className="text-xs text-blue-600">
                    Load: {format(new Date(truckAssignment.loading_date), 'MMM d')}
                  </div>}
              </div>}
          </> :
      // Continuation indicator - show only project name
      <div className="h-8 flex items-center justify-center">
            <div className={cn("text-xs font-medium truncate", teamColor.text)}>
              {project.name}
            </div>
          </div>}
      </div>
    </div>;
};

// Truck selector component
const TruckSelector = ({
  value,
  onValueChange,
  truckNumber
}) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  useEffect(() => {
    const fetchTrucks = async () => {
      const {
        data
      } = await supabase.from('trucks').select('*').order('truck_number');
      setTrucks(data || []);
    };
    fetchTrucks();
  }, []);
  return <div className="flex items-center gap-2">
      <Truck className="h-3 w-3" />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-6 text-xs flex-1">
          <SelectValue placeholder="Assign truck">
            {truckNumber ? <Badge className={getTruckColor(truckNumber)}>
                T{truckNumber}
              </Badge> : "No truck"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No truck assigned</SelectItem>
          {trucks.map(truck => <SelectItem key={truck.id} value={truck.id}>
              <div className="flex items-center gap-2">
                <Badge className={getTruckColor(truck.truck_number)}>
                  {truck.truck_number}
                </Badge>
                <span>{truck.description}</span>
              </div>
            </SelectItem>)}
        </SelectContent>
      </Select>
    </div>;
};

// Enhanced day cell component with current day highlighting
const DayCell = ({
  date,
  team,
  teamId,
  projects,
  assignments,
  truckAssignments,
  onDropProject,
  handleExtendProject,
  handleDurationChange,
  onTruckAssign,
  currentMonth,
  onRefreshData
}) => {
  const [{
    isOver
  }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      const dropDate = format(date, 'yyyy-MM-dd');
      console.log(`Dropping project ${item.id} on date: ${dropDate}, team: ${team}, teamId: ${teamId}`);
      
      if (item.teamId === teamId && item.assignment) {
        // Moving within same team - just update start date
        handleDateChange(item.assignment.id, dropDate);
      } else {
        // Moving to different team or from unassigned
        onDropProject(item.id, team, teamId, dropDate);
      }
    },
    collect: monitor => ({
      isOver: !!monitor.isOver()
    })
  }), [date, team, teamId]);
  
  const handleDateChange = async (assignmentId: string, newStartDate: string) => {
    try {
      console.log(`Updating assignment ${assignmentId} to start date: ${newStartDate}`);
      const {
        error
      } = await supabase.from('project_team_assignments').update({
        start_date: newStartDate
      }).eq('id', assignmentId);
      if (error) throw error;

      // Refresh data while maintaining scroll position
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (error) {
      console.error('Error updating assignment date:', error);
    }
  };
  
  const dateStr = format(date, 'yyyy-MM-dd');
  const isCurrentMonthDay = isSameMonth(date, currentMonth);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isToday = isSameDay(date, new Date());

  // Get projects that should be displayed on this day
  const projectsForDay = assignments.filter(assignment => assignment.team === team).map(assignment => {
    const project = projects.find(p => p.id === assignment.project_id);
    if (!project) return null;
    const startDate = new Date(assignment.start_date);
    const businessDays = getBusinessDaysArray(startDate, assignment.duration);

    // Check if this date is one of the business days for this project
    const dayIndex = businessDays.findIndex(businessDay => format(businessDay, 'yyyy-MM-dd') === dateStr);
    if (dayIndex === -1) return null;
    const isStart = dayIndex === 0;
    const isContinuation = dayIndex > 0;
    return {
      project,
      assignment,
      isStart,
      isContinuation,
      dayPosition: dayIndex,
      totalDays: assignment.duration
    };
  }).filter(Boolean);
  
  return <div ref={drop} className={cn(
      "min-h-[120px] border border-gray-200 p-1",
      !isCurrentMonthDay && "bg-gray-50 text-gray-400",
      isWeekend && isCurrentMonthDay && "bg-blue-50",
      isToday && isCurrentMonthDay && "bg-yellow-100 border-yellow-400 border-2",
      isOver && isCurrentMonthDay ? "bg-green-50 border-green-300" : "",
      isCurrentMonthDay ? "bg-white" : ""
    )}>
      <div className={cn("text-center text-sm font-medium mb-1", !isCurrentMonthDay && "text-gray-400", isToday && "text-yellow-800 font-bold")}>
        <div className="text-xs">{format(date, 'EEE')}</div>
        <div className="text-lg">{format(date, 'd')}</div>
        {isToday && <div className="text-xs font-bold">Today</div>}
      </div>
      
      <div className="space-y-1">
        {projectsForDay.map(({
        project,
        assignment,
        isStart,
        isContinuation,
        dayPosition,
        totalDays
      }) => {
        const truckAssignment = truckAssignments.find(ta => ta.project_id === project.id);
        return <ProjectItem key={`${project.id}-${dayPosition}`} project={project} team={team} teamId={teamId} assignment={assignment} truckAssignment={truckAssignment} onExtendProject={handleExtendProject} onDurationChange={handleDurationChange} onTruckAssign={onTruckAssign} isStart={isStart} isContinuation={isContinuation} dayPosition={dayPosition} totalDays={totalDays} />;
      })}
      </div>
    </div>;
};

// Enhanced team calendar component with collapsible functionality - starts collapsed
const TeamCalendar = ({
  team,
  teamId,
  currentMonth,
  projects,
  assignments,
  truckAssignments,
  onDropProject,
  handleExtendProject,
  handleDurationChange,
  onTruckAssign,
  onRefreshData,
  scrollPositions,
  setScrollPositions,
  isCollapsed,
  setIsCollapsed
}) => {
  // Get team color - look up from database teams or fallback to color detection
  const getTeamColor = (teamName: string) => {
    // Try to find color from team name keywords
    if (teamName?.toLowerCase().includes('groen') || teamName?.toLowerCase().includes('green')) return getColorClasses('green');
    if (teamName?.toLowerCase().includes('blauw') || teamName?.toLowerCase().includes('blue')) return getColorClasses('blue');
    if (teamName?.toLowerCase().includes('orange') || teamName?.toLowerCase().includes('oranje')) return getColorClasses('orange');
    if (teamName?.toLowerCase().includes('red') || teamName?.toLowerCase().includes('rood')) return getColorClasses('red');
    if (teamName?.toLowerCase().includes('yellow') || teamName?.toLowerCase().includes('geel')) return getColorClasses('yellow');
    if (teamName?.toLowerCase().includes('purple') || teamName?.toLowerCase().includes('paars')) return getColorClasses('purple');
    return getColorClasses('blue'); // default
  };
  const teamColor = getTeamColor(team);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Generate multiple months for scrolling (current month in the middle)
  const generateCalendarMonths = () => {
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const month = addMonths(currentMonth, i);
      months.push(month);
    }
    return months;
  };

  const calendarMonths = generateCalendarMonths();

  // Auto-scroll to current month on initial load
  useEffect(() => {
    if (scrollAreaRef.current && !scrollPositions[team]) {
      const currentMonthElement = scrollAreaRef.current.querySelector('[data-current-month="true"]');
      if (currentMonthElement) {
        currentMonthElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [team, scrollPositions]);

  // Restore scroll position when it exists
  useEffect(() => {
    if (scrollAreaRef.current && scrollPositions[team] !== undefined) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = scrollPositions[team];
      }
    }
  }, [scrollPositions, team]);

  // Save scroll position on scroll
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target) {
      setScrollPositions(prev => ({
        ...prev,
        [team]: target.scrollTop
      }));
    }
  };

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [team, setScrollPositions]);

  // Generate calendar days for a specific month, starting on Monday
  const generateMonthDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    // Start calendar on the Monday of the week containing the first day of the month
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    // End calendar on the Sunday of the week containing the last day of the month
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  return <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)} className="mb-6">
      <div className={cn("rounded-lg border", teamColor.border)}>
        <CollapsibleTrigger asChild>
          <div className={cn("p-3 rounded-t-lg cursor-pointer flex items-center justify-between hover:opacity-80 transition-opacity", teamColor.header)}>
            <h3 className="text-lg font-medium">{team}</h3>
            {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className={cn("rounded-b-lg border-b border-x", teamColor.border)}>
            <ScrollArea className="h-[800px]" ref={scrollAreaRef}>
              {calendarMonths.map((month, monthIndex) => {
                const monthDays = generateMonthDays(month);
                const weeks = [];
                for (let i = 0; i < monthDays.length; i += 7) {
                  weeks.push(monthDays.slice(i, i + 7));
                }

                const isCurrentMonth = isSameMonth(month, new Date());

                return (
                  <div key={monthIndex} className="mb-4" data-current-month={isCurrentMonth}>
                    {/* Month header */}
                    <div className="sticky top-0 bg-gray-100 p-2 text-center font-medium border-b z-10">
                      {format(month, 'MMMM yyyy')}
                      {isCurrentMonth && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">Current</span>}
                    </div>
                    
                    {/* Day headers - starting with Monday */}
                    <div className="grid grid-cols-7 border-b">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="p-2 text-center font-medium text-sm bg-gray-50">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar grid */}
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7">
                        {week.map((date, dayIndex) => (
                      <DayCell 
                            key={dayIndex} 
                            date={date} 
                            team={team} 
                            teamId={teamId}
                            projects={projects} 
                            assignments={assignments} 
                            truckAssignments={truckAssignments} 
                            onDropProject={onDropProject} 
                            handleExtendProject={handleExtendProject}
                            handleDurationChange={handleDurationChange}
                            onTruckAssign={onTruckAssign}
                            currentMonth={month}
                            onRefreshData={onRefreshData}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>;
};

// Function to get status badge color
const getStatusColor = status => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Enhanced unassigned projects component with proper badge logic
const UnassignedProjects = ({
  projects,
  assignments,
  truckAssignments,
  onTruckAssign,
  onDropProject
}) => {
  const navigate = useNavigate();
  const [{
    isOver
  }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      console.log('Dropping project to unassigned:', item);
      // Move project back to unassigned by removing its team assignment
      onDropProject(item.id, null, null, null);
    },
    collect: monitor => ({
      isOver: !!monitor.isOver()
    })
  }));
  
  const unassignedProjects = projects.filter(project => !assignments.some(a => a.project_id === project.id));
  
  return <div className="mb-6">
      <div className={cn("p-3 rounded-t-lg", getColorClasses('unassigned').header)}>
        <h3 className="text-lg font-medium">Unassigned Projects ({unassignedProjects.length})</h3>
      </div>
      
      <div ref={drop} className={cn("p-2 rounded-b-lg border-b border-x border-gray-300 bg-white min-h-[100px]", isOver ? "bg-gray-100" : "")}>
        {unassignedProjects.length === 0 ? <p className="text-center text-gray-500 p-4">No unassigned projects</p> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {unassignedProjects.map(project => {
          const truckAssignment = truckAssignments.find(ta => ta.project_id === project.id);
          const hasTeamAssignment = assignments.some(a => a.project_id === project.id);
          
          return <div key={project.id} className="border rounded-lg p-3">
              <ProjectItem project={project} team={null} teamId={null} assignment={null} truckAssignment={truckAssignment} onExtendProject={() => {}} onDurationChange={() => {}} onTruckAssign={onTruckAssign} />
              
              {/* Show planned vs to plan badge */}
              <div className="mt-2 flex justify-center">
                <Badge variant={hasTeamAssignment ? "default" : "outline"}>
                  {hasTeamAssignment ? "Planned" : "To Plan"}
                </Badge>
              </div>
            </div>;
        })}
          </div>}
      </div>
    </div>;
};

// Define team interface
interface Team {
  id: string;
  name: string;
  color: string;
  external_team_names: string[];
  is_active: boolean;
}

// Main installation team calendar component with enhanced scroll preservation and default collapsed state
const InstallationTeamCalendar = ({
  projects
}: {
  projects: Project[];
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<TruckAssignment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [pageScrollPosition, setPageScrollPosition] = useState(0);
  // Start with all calendars collapsed - will be dynamically generated
  const [teamCollapsedStates, setTeamCollapsedStates] = useState<Record<string, boolean>>({});
  const {
    toast
  } = useToast();

  // Helper function to update individual team collapsed state
  const setTeamCollapsed = (team: string, collapsed: boolean) => {
    setTeamCollapsedStates(prev => ({
      ...prev,
      [team]: collapsed
    }));
  };

  // Store page scroll position before operations
  const storePageScrollPosition = () => {
    setPageScrollPosition(window.pageYOffset);
  };

  // Restore page scroll position after operations
  const restorePageScrollPosition = () => {
    setTimeout(() => {
      window.scrollTo({
        top: pageScrollPosition,
        behavior: 'instant'
      });
    }, 50);
  };

  // Fetch teams, team assignments and truck assignments
  const fetchAssignments = async () => {
    try {
      setLoading(true);

      // Fetch active placement teams
      const {
        data: teamsData,
        error: teamsError
      } = await supabase
        .from('placement_teams')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (teamsError) throw teamsError;
      
      const fetchedTeams = teamsData || [];
      setTeams(fetchedTeams);
      
      // Initialize collapsed states for all teams
      const initialCollapsedStates: Record<string, boolean> = {};
      fetchedTeams.forEach(team => {
        initialCollapsedStates[team.id] = true; // Start collapsed
      });
      setTeamCollapsedStates(initialCollapsedStates);

      // Fetch team assignments
      const {
        data: teamData,
        error: teamError
      } = await supabase.from('project_team_assignments').select('*').order('start_date', {
        ascending: true
      });
      if (teamError) throw teamError;
      setAssignments(teamData || []);

      // Fetch truck assignments
      const {
        data: truckData,
        error: truckError
      } = await supabase.from('project_truck_assignments').select(`
          *,
          trucks!fk_project_truck_assignments_truck(truck_number)
        `);
      if (truckError) throw truckError;
      const formattedTruckAssignments = truckData?.map(assignment => ({
        ...assignment,
        truck: assignment.trucks
      })) || [];
      setTruckAssignments(formattedTruckAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load assignments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchAssignments();
  }, [toast]);

  // Helper function to update truck loading date - enhanced version
  const updateTruckLoadingDate = async (projectId: string, installationDateStr: string, startDateStr: string) => {
    const truckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
    if (truckAssignmentIndex >= 0) {
      const truckAssignment = truckAssignments[truckAssignmentIndex];

      // Calculate new loading date (one business day before installation START)
      const startDate = new Date(startDateStr);
      const loadingDate = new Date(startDate);
      
      // Move back one day initially
      loadingDate.setDate(loadingDate.getDate() - 1);

      // Weekend adjustment - if loading falls on weekend, move to Friday
      if (loadingDate.getDay() === 0) {
        // Sunday - move to Friday
        loadingDate.setDate(loadingDate.getDate() - 2);
      } else if (loadingDate.getDay() === 6) {
        // Saturday - move to Friday
        loadingDate.setDate(loadingDate.getDate() - 1);
      }
      
      const loadingDateStr = format(loadingDate, 'yyyy-MM-dd');
      
      console.log(`Updating truck loading date for project ${projectId}: installation=${installationDateStr}, loading=${loadingDateStr}`);
      
      const { error } = await supabase
        .from('project_truck_assignments')
        .update({
          installation_date: installationDateStr,
          loading_date: loadingDateStr
        })
        .eq('id', truckAssignment.id);
        
      if (error) throw error;

      // Update local state
      const updatedTruckAssignments = [...truckAssignments];
      updatedTruckAssignments[truckAssignmentIndex] = {
        ...truckAssignment,
        installation_date: installationDateStr,
        loading_date: loadingDateStr
      };
      setTruckAssignments(updatedTruckAssignments);
      
      console.log(`Successfully updated truck loading date: ${loadingDateStr}`);
    }
  };

  // Enhanced project drop handling with truck loading date calculation
  const handleDropProject = async (projectId: string, team: string | null, teamId: string | null, newStartDate?: string) => {
    try {
      // Store current page scroll position
      storePageScrollPosition();
      
      console.log(`Handling drop for project ${projectId} to team ${team} (ID: ${teamId}) on date ${newStartDate}`);
      const existingAssignmentIndex = assignments.findIndex(a => a.project_id === projectId);
      
      if (team === null) {
        // Reset project completely - remove team assignment and truck assignment
        if (existingAssignmentIndex >= 0) {
          const existingAssignment = assignments[existingAssignmentIndex];

          // Remove team assignment
          const { error } = await supabase
            .from('project_team_assignments')
            .delete()
            .eq('id', existingAssignment.id);
          if (error) throw error;

          // Remove from assignments array
          const updatedAssignments = assignments.filter(a => a.project_id !== projectId);
          setAssignments(updatedAssignments);

          // Reset project installation_date to null
          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: null })
            .eq('id', projectId);
          if (projectError) throw projectError;

          // Remove truck assignment if exists
          const truckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
          if (truckAssignmentIndex >= 0) {
            const truckAssignment = truckAssignments[truckAssignmentIndex];
            const { error: truckError } = await supabase
              .from('project_truck_assignments')
              .delete()
              .eq('id', truckAssignment.id);
            if (truckError) throw truckError;
            
            const updatedTruckAssignments = truckAssignments.filter(ta => ta.project_id !== projectId);
            setTruckAssignments(updatedTruckAssignments);
          }
          
          toast({
            title: "Project Reset",
            description: "Project has been moved to unassigned and reset"
          });

          // Preserve both page and calendar scroll positions
          restorePageScrollPosition();
        }
      } else {
        // Assign to team
        if (existingAssignmentIndex >= 0) {
          const existingAssignment = assignments[existingAssignmentIndex];
          const updateData: Partial<Assignment> = { team, team_id: teamId };
          if (newStartDate) {
            updateData.start_date = newStartDate;
          }
          
          const { error } = await supabase
            .from('project_team_assignments')
            .update(updateData)
            .eq('id', existingAssignment.id);
          if (error) throw error;
          
          const updatedAssignments = [...assignments];
          updatedAssignments[existingAssignmentIndex] = {
            ...existingAssignment,
            ...updateData
          };
          setAssignments(updatedAssignments);

          // Calculate and update installation date using business days
          const startDate = new Date(updateData.start_date || existingAssignment.start_date);
          const installationDate = addBusinessDays(startDate, existingAssignment.duration - 1);
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          const startDateStr = format(startDate, 'yyyy-MM-dd');

          // Update project installation_date
          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
          if (projectError) throw projectError;

          // Update truck assignment loading date if exists
          await updateTruckLoadingDate(projectId, installationDateStr, startDateStr);
          
          toast({
            title: "Team Updated",
            description: `Project has been assigned to ${team} team${newStartDate ? ` starting ${format(new Date(newStartDate), 'MMM d')}` : ''}`
          });

          // Preserve both page and calendar scroll positions
          restorePageScrollPosition();
        } else {
          const newAssignment = {
            project_id: projectId,
            team,
            team_id: teamId,
            start_date: newStartDate || format(new Date(), 'yyyy-MM-dd'),
            duration: 1
          };
          
          const { data, error } = await supabase
            .from('project_team_assignments')
            .insert([newAssignment])
            .select();
          if (error) throw error;
          
          setAssignments([...assignments, data[0]]);

          // Calculate and update installation date using business days
          const startDate = new Date(newAssignment.start_date);
          const installationDate = addBusinessDays(startDate, newAssignment.duration - 1);
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          const startDateStr = format(startDate, 'yyyy-MM-dd');

          // Update project installation_date
          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
          if (projectError) throw projectError;

          // Update truck assignment loading date if exists (for newly assigned projects)
          await updateTruckLoadingDate(projectId, installationDateStr, startDateStr);
          
          toast({
            title: "Team Assigned",
            description: `Project has been assigned to ${team} team`
          });

          // Preserve both page and calendar scroll positions
          restorePageScrollPosition();
        }
      }
    } catch (error) {
      console.error('Error handling project assignment:', error);
      toast({
        title: "Error",
        description: "Failed to handle project assignment",
        variant: "destructive"
      });
    }
  };

  // Handle duration change with truck loading date update
  const handleDurationChange = async (assignmentId: string, newDuration: number) => {
    try {
      storePageScrollPosition();
      
      const assignmentIndex = assignments.findIndex(a => a.id === assignmentId);
      if (assignmentIndex < 0) return;
      
      const assignment = assignments[assignmentIndex];
      const { error } = await supabase
        .from('project_team_assignments')
        .update({ duration: newDuration })
        .eq('id', assignmentId);
      if (error) throw error;
      
      const updatedAssignments = [...assignments];
      updatedAssignments[assignmentIndex] = {
        ...assignment,
        duration: newDuration
      };
      setAssignments(updatedAssignments);

      // Calculate and update installation date using business days
      const startDate = new Date(assignment.start_date);
      const installationDate = addBusinessDays(startDate, newDuration - 1);
      const installationDateStr = format(installationDate, 'yyyy-MM-dd');
      const startDateStr = format(startDate, 'yyyy-MM-dd');

      // Update project installation_date
      const { error: projectError } = await supabase
        .from('projects')
        .update({ installation_date: installationDateStr })
        .eq('id', assignment.project_id);
      if (projectError) throw projectError;

      // Update truck assignment loading date if exists
      await updateTruckLoadingDate(assignment.project_id, installationDateStr, startDateStr);
      
      toast({
        title: "Duration Updated",
        description: `Project duration is now ${newDuration} day${newDuration > 1 ? 's' : ''}`
      });

      restorePageScrollPosition();
    } catch (error) {
      console.error('Error updating project duration:', error);
      toast({
        title: "Error",
        description: "Failed to update project duration",
        variant: "destructive"
      });
    }
  };

  // Handle project extension (legacy - keeping for compatibility)
  const handleExtendProject = async (projectId: string, direction: string) => {
    // This is handled by the duration change now
    console.log('Extension handled by duration change');
  };

  // Handle truck assignment
  const handleTruckAssign = async (projectId: string, truckId: string) => {
    try {
      storePageScrollPosition();
      
      // Find the team assignment to get installation date
      const assignment = assignments.find(a => a.project_id === projectId);
      if (!assignment) {
        toast({
          title: "Error",
          description: "Project must be assigned to a team first",
          variant: "destructive"
        });
        return;
      }

      // Calculate installation date from team assignment using business days
      const startDate = new Date(assignment.start_date);
      const installationDate = addBusinessDays(startDate, assignment.duration - 1);
      const installationDateStr = format(installationDate, 'yyyy-MM-dd');
      const existingTruckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
      if (truckId === 'none' || truckId === '') {
        // Remove truck assignment
        if (existingTruckAssignmentIndex >= 0) {
          const existingAssignment = truckAssignments[existingTruckAssignmentIndex];
          const { error } = await supabase
            .from('project_truck_assignments')
            .delete()
            .eq('id', existingAssignment.id);
          if (error) throw error;
          const updatedTruckAssignments = truckAssignments.filter(ta => ta.project_id !== projectId);
          setTruckAssignments(updatedTruckAssignments);
          toast({
            title: "Truck Unassigned",
            description: "Truck has been removed from project"
          });
        }
      } else {
        // Calculate loading date (one business day before installation)
        const loadingDate = new Date(installationDate);
        loadingDate.setDate(loadingDate.getDate() - 1);

        // Weekend adjustment
        if (loadingDate.getDay() === 0) {
          // Sunday
          loadingDate.setDate(loadingDate.getDate() - 2); // Friday
        } else if (loadingDate.getDay() === 6) {
          // Saturday
          loadingDate.setDate(loadingDate.getDate() - 1); // Friday
        }
        const loadingDateStr = format(loadingDate, 'yyyy-MM-dd');
        if (existingTruckAssignmentIndex >= 0) {
          // Update existing truck assignment
          const existingAssignment = truckAssignments[existingTruckAssignmentIndex];
          const { error } = await supabase
            .from('project_truck_assignments')
            .update({
              truck_id: truckId,
              installation_date: installationDateStr,
              loading_date: loadingDateStr
            })
            .eq('id', existingAssignment.id);
          if (error) throw error;

          // Fetch updated assignment with truck info
          const { data: updatedData, error: fetchError } = await supabase
            .from('project_truck_assignments')
            .select(`
                *,
                trucks!fk_project_truck_assignments_truck(truck_number)
              `)
            .eq('id', existingAssignment.id)
            .single();
          if (fetchError) throw fetchError;
          const updatedTruckAssignments = [...truckAssignments];
          updatedTruckAssignments[existingTruckAssignmentIndex] = {
            ...updatedData,
            truck: updatedData.trucks
          };
          setTruckAssignments(updatedTruckAssignments);
          toast({
            title: "Truck Updated",
            description: `Project assigned to truck ${updatedData.trucks.truck_number}`
          });
        } else {
          // Create new truck assignment
          const newTruckAssignment = {
            project_id: projectId,
            truck_id: truckId,
            installation_date: installationDateStr,
            loading_date: loadingDateStr
          };
          const { data, error } = await supabase
            .from('project_truck_assignments')
            .insert([newTruckAssignment])
            .select(`
                *,
                trucks!fk_project_truck_assignments_truck(truck_number)
              `);
          if (error) throw error;
          const formattedAssignment = {
            ...data[0],
            truck: data[0].trucks
          };
          setTruckAssignments([...truckAssignments, formattedAssignment]);
          toast({
            title: "Truck Assigned",
            description: `Project assigned to truck ${data[0].trucks.truck_number}`
          });
        }
      }

      restorePageScrollPosition();
    } catch (error) {
      console.error('Error assigning truck:', error);
      toast({
        title: "Error",
        description: "Failed to assign truck",
        variant: "destructive"
      });
    }
  };

  // Refresh data while maintaining scroll positions
  const refreshDataWithScrollPreservation = async () => {
    storePageScrollPosition();
    await fetchAssignments();
    restorePageScrollPosition();
  };
  
  if (loading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>;
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Installation Team Calendar - Enhanced View
          </CardTitle>
          <div className="text-sm text-gray-600">
            Calendars show ~1.5 months. Scroll to navigate through time. Click team headers to collapse/expand.
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <UnassignedProjects projects={projects} assignments={assignments} truckAssignments={truckAssignments} onTruckAssign={handleTruckAssign} onDropProject={handleDropProject} />
        
        {teams.map(team => {
          // Get assignments for this team based on team_id
          const teamAssignments = assignments.filter(assignment => 
            assignment.team_id === team.id || team.external_team_names.includes(assignment.team)
          );
          
          return (
            <TeamCalendar 
              key={team.id}
              team={team.name}
              teamId={team.id}
              currentMonth={currentMonth} 
              projects={projects} 
              assignments={teamAssignments}
              truckAssignments={truckAssignments} 
              onDropProject={handleDropProject} 
              handleExtendProject={handleExtendProject} 
              handleDurationChange={handleDurationChange} 
              onTruckAssign={handleTruckAssign} 
              onRefreshData={refreshDataWithScrollPreservation} 
              scrollPositions={scrollPositions} 
              setScrollPositions={setScrollPositions}
              isCollapsed={teamCollapsedStates[team.id] ?? true}
              setIsCollapsed={(collapsed) => setTeamCollapsed(team.id, collapsed)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
};

export default InstallationTeamCalendar;
