import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarDays, Truck, ExternalLink, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useIsMobile } from '@/hooks/use-mobile';

interface Project {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
  [key: string]: any;
}

interface Assignment {
  id: string;
  project_id: string;
  team: string;
  team_id?: string;
  start_date: string;
  duration: number;
  service_hours?: number | null;
  created_at?: string;
  updated_at?: string;
}

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

interface Truck {
  id: string;
  truck_number: string;
  description?: string;
}

interface DragItem {
  type: string;
  id: string;
  team: string;
  teamId?: string;
  assignment?: Assignment;
}

const addBusinessDays = (date: Date, days: number): Date => {
  let result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result = addDays(result, 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result;
};

const getBusinessDaysArray = (startDate: Date, duration: number): Date[] => {
  const days: Date[] = [];
  let currentDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < duration) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      days.push(new Date(currentDate));
      addedDays++;
    }
    currentDate = addDays(currentDate, 1);
  }
  return days;
};

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

const DurationSelector = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useLanguage();
  return <div className="flex items-center gap-1">
      <span className="text-xs">{t('itc_days')}</span>
      <Input type="number" min="1" max="30" value={value} onChange={e => onChange(parseInt(e.target.value) || 1)} disabled={disabled} className="h-6 w-16 text-xs" />
    </div>;
};

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
  const { t, createLocalizedPath } = useLanguage();
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
  const getTeamColor = (teamName: string) => {
    if (teamName?.toLowerCase().includes('groen') || teamName?.toLowerCase().includes('green')) return getColorClasses('green');
    if (teamName?.toLowerCase().includes('blauw') || teamName?.toLowerCase().includes('blue')) return getColorClasses('blue');
    if (teamName?.toLowerCase().includes('orange') || teamName?.toLowerCase().includes('oranje')) return getColorClasses('orange');
    if (teamName?.toLowerCase().includes('red') || teamName?.toLowerCase().includes('rood')) return getColorClasses('red');
    if (teamName?.toLowerCase().includes('yellow') || teamName?.toLowerCase().includes('geel')) return getColorClasses('yellow');
    if (teamName?.toLowerCase().includes('purple') || teamName?.toLowerCase().includes('paars')) return getColorClasses('purple');
    return getColorClasses('blue');
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
                {t('itc_view_details')}
              </Button>
            </div>
            
            {/* Show service hours badge if it's a service assignment */}
            {assignment?.service_hours && <div className="mb-1">
                <Badge variant="outline" className="text-xs gap-1">
                  <Wrench className="h-3 w-3" />
                  {assignment.service_hours}h
                </Badge>
              </div>}
            
            {team && assignment && !assignment.service_hours && <div className="mb-2">
                <DurationSelector value={assignment.duration} onChange={handleDurationChange} />
              </div>}
            
            {team && <div className="mb-2">
                <TruckSelector value={truckAssignment?.truck_id || ''} onValueChange={handleTruckChange} truckNumber={truckAssignment?.truck?.truck_number} />
              </div>}
            
            {assignment && <div className="text-xs text-gray-600 mt-1">
                {format(new Date(assignment.start_date), 'MMM d')}
                {assignment.duration > 1 && <span> - {format(addBusinessDays(new Date(assignment.start_date), assignment.duration - 1), 'MMM d')}</span>}
                {truckAssignment && <div className="text-xs text-blue-600">
                    {t('itc_load')}: {format(new Date(truckAssignment.loading_date), 'MMM d')}
                  </div>}
              </div>}
          </> :
      <div className="h-8 flex items-center justify-center">
            <div className={cn("text-xs font-medium truncate", teamColor.text)}>
              {project.name}
            </div>
          </div>}
      </div>
    </div>;
};

const TruckSelector = ({
  value,
  onValueChange,
  truckNumber
}) => {
  const { t } = useLanguage();
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
          <SelectValue placeholder={t('itc_assign_truck')}>
            {truckNumber ? <Badge className={getTruckColor(truckNumber)}>
                T{truckNumber}
              </Badge> : t('itc_no_truck')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('itc_no_truck_assigned')}</SelectItem>
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
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [{
    isOver
  }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      const dropDate = format(date, 'yyyy-MM-dd');
      console.log(`Dropping project ${item.id} on date: ${dropDate}, team: ${team}, teamId: ${teamId}`);
      
      if (item.teamId === teamId && item.assignment) {
        handleDateChange(item.assignment.id, dropDate);
      } else {
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

  const projectsForDay = assignments.filter(assignment => assignment.team === team).map(assignment => {
    const project = projects.find(p => p.id === assignment.project_id);
    if (!project) return null;
    const startDate = new Date(assignment.start_date);
    const businessDays = getBusinessDaysArray(startDate, assignment.duration);
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
      isMobile ? "min-h-[60px] border border-border p-0.5" : "min-h-[120px] border border-border p-1",
      !isCurrentMonthDay && "bg-muted/50 text-muted-foreground",
      isWeekend && isCurrentMonthDay && "bg-accent/30",
      isToday && isCurrentMonthDay && "bg-yellow-100 border-yellow-400 border-2",
      isOver && isCurrentMonthDay ? "bg-green-50 border-green-300" : "",
      isCurrentMonthDay ? "bg-background" : ""
    )} data-today={isToday ? "true" : undefined}>
      <div className={cn(
        "text-center font-medium mb-0.5",
        isMobile ? "text-[10px]" : "text-sm",
        !isCurrentMonthDay && "text-muted-foreground",
        isToday && "text-yellow-800 font-bold"
      )}>
        {!isMobile && <div className="text-xs">{format(date, 'EEE')}</div>}
        <div className={isMobile ? "text-xs" : "text-lg"}>{format(date, 'd')}</div>
        {isToday && !isMobile && <div className="text-xs font-bold">{t('itc_today')}</div>}
      </div>
      
      <div className="space-y-0.5">
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
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const getTeamColor = (teamName: string) => {
    if (teamName?.toLowerCase().includes('groen') || teamName?.toLowerCase().includes('green')) return getColorClasses('green');
    if (teamName?.toLowerCase().includes('blauw') || teamName?.toLowerCase().includes('blue')) return getColorClasses('blue');
    if (teamName?.toLowerCase().includes('orange') || teamName?.toLowerCase().includes('oranje')) return getColorClasses('orange');
    if (teamName?.toLowerCase().includes('red') || teamName?.toLowerCase().includes('rood')) return getColorClasses('red');
    if (teamName?.toLowerCase().includes('yellow') || teamName?.toLowerCase().includes('geel')) return getColorClasses('yellow');
    if (teamName?.toLowerCase().includes('purple') || teamName?.toLowerCase().includes('paars')) return getColorClasses('purple');
    return getColorClasses('blue');
  };
  const teamColor = getTeamColor(team);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  const generateCalendarMonths = () => {
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const month = addMonths(currentMonth, i);
      months.push(month);
    }
    return months;
  };

  const calendarMonths = generateCalendarMonths();

  useEffect(() => {
    if (!isCollapsed && scrollAreaRef.current) {
      const timer = setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (!viewport) return;

        const todayCell = scrollAreaRef.current?.querySelector('[data-today="true"]');
        if (todayCell) {
          todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        const currentMonthElement = scrollAreaRef.current?.querySelector('[data-current-month="true"]');
        if (currentMonthElement) {
          currentMonthElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

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

  const generateMonthDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const dayHeaders = [
    t('itc_mon'), t('itc_tue'), t('itc_wed'), t('itc_thu'), t('itc_fri'), t('itc_sat'), t('itc_sun')
  ];

  return <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)} className="mb-6">
      <div className={cn("rounded-lg border", teamColor.border)}>
        <CollapsibleTrigger asChild>
          <div className={cn("p-2 sm:p-3 rounded-t-lg cursor-pointer flex items-center justify-between hover:opacity-80 transition-opacity", teamColor.header)}>
            <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-medium`}>{team}</h3>
            {isCollapsed ? <ChevronDown className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} /> : <ChevronUp className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className={cn("rounded-b-lg border-b border-x", teamColor.border)}>
            <ScrollArea className={isMobile ? 'h-[400px]' : 'h-[800px]'} ref={scrollAreaRef}>
              {calendarMonths.map((month, monthIndex) => {
                const monthDays = generateMonthDays(month);
                const weeks = [];
                for (let i = 0; i < monthDays.length; i += 7) {
                  weeks.push(monthDays.slice(i, i + 7));
                }

                const isCurrentMonth = isSameMonth(month, new Date());

                return (
                  <div key={monthIndex} className={isMobile ? 'mb-2' : 'mb-4'} data-current-month={isCurrentMonth}>
                    <div className={`sticky top-0 bg-muted ${isMobile ? 'p-1.5 text-xs' : 'p-2 text-sm'} text-center font-medium border-b z-10`}>
                      {format(month, 'MMMM yyyy')}
                      {isCurrentMonth && <span className="ml-2 text-[10px] sm:text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">{t('itc_current')}</span>}
                    </div>
                    
                    <div className="grid grid-cols-7 border-b">
                      {dayHeaders.map(day => (
                        <div key={day} className={`${isMobile ? 'p-0.5 text-[10px]' : 'p-2 text-sm'} text-center font-medium bg-muted/50`}>
                          {isMobile ? day.charAt(0) : day}
                        </div>
                      ))}
                    </div>
                    
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

const UnassignedProjects = ({
  projects,
  assignments,
  truckAssignments,
  onTruckAssign,
  onDropProject
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [{
    isOver
  }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      console.log('Dropping project to unassigned:', item);
      onDropProject(item.id, null, null, null);
    },
    collect: monitor => ({
      isOver: !!monitor.isOver()
    })
  }));
  
  const unassignedProjects = projects.filter(project => !assignments.some(a => a.project_id === project.id));
  
  const isMobile = useIsMobile();

  return <div className={isMobile ? 'mb-3' : 'mb-6'}>
      <div className={cn("p-2 sm:p-3 rounded-t-lg", getColorClasses('unassigned').header)}>
        <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-medium`}>{t('itc_unassigned_projects', { count: String(unassignedProjects.length) })}</h3>
      </div>
      
      <div ref={drop} className={cn("p-2 rounded-b-lg border-b border-x border-border bg-background min-h-[60px] sm:min-h-[100px]", isOver ? "bg-muted" : "")}>
        {unassignedProjects.length === 0 ? <p className={`text-center text-muted-foreground ${isMobile ? 'p-2 text-xs' : 'p-4'}`}>{t('itc_no_unassigned')}</p> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {unassignedProjects.map(project => {
          const truckAssignment = truckAssignments.find(ta => ta.project_id === project.id);
          const hasTeamAssignment = assignments.some(a => a.project_id === project.id);
          
          return <div key={project.id} className="border rounded-lg p-3">
              <ProjectItem project={project} team={null} teamId={null} assignment={null} truckAssignment={truckAssignment} onExtendProject={() => {}} onDurationChange={() => {}} onTruckAssign={onTruckAssign} />
              
              <div className="mt-2 flex justify-center">
                <Badge variant={hasTeamAssignment ? "default" : "outline"}>
                  {hasTeamAssignment ? t('itc_planned') : t('itc_to_plan')}
                </Badge>
              </div>
            </div>;
        })}
          </div>}
      </div>
    </div>;
};

interface Team {
  id: string;
  name: string;
  color: string;
  external_team_names: string[];
  is_active: boolean;
  team_type?: string;
}

const InstallationTeamCalendar = ({
  projects
}: {
  projects: Project[];
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<TruckAssignment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [pageScrollPosition, setPageScrollPosition] = useState(0);
  const [teamCollapsedStates, setTeamCollapsedStates] = useState<Record<string, boolean>>({});
  
  // Service hours dialog state
  const [serviceHoursDialog, setServiceHoursDialog] = useState<{
    open: boolean;
    projectId: string;
    team: string;
    teamId: string;
    startDate: string;
    hours: number;
  }>({ open: false, projectId: '', team: '', teamId: '', startDate: '', hours: 2 });
  const {
    toast
  } = useToast();

  const setTeamCollapsed = (team: string, collapsed: boolean) => {
    setTeamCollapsedStates(prev => ({
      ...prev,
      [team]: collapsed
    }));
  };

  const storePageScrollPosition = () => {
    setPageScrollPosition(window.pageYOffset);
  };

  const restorePageScrollPosition = () => {
    setTimeout(() => {
      window.scrollTo({
        top: pageScrollPosition,
        behavior: 'instant'
      });
    }, 50);
  };

  const isServiceAssignment = (assignment: Assignment) => {
    if (assignment.service_hours != null) return true;
    if (!assignment.team_id) return false;
    const assignedTeam = teams.find(t => t.id === assignment.team_id);
    return assignedTeam?.team_type === 'service';
  };

  const getMainAssignmentIndex = (projectId: string) =>
    assignments.findIndex(a => a.project_id === projectId && !isServiceAssignment(a));

  const getMainAssignment = (projectId: string) =>
    assignments.find(a => a.project_id === projectId && !isServiceAssignment(a));

  const getServiceAssignmentsForTeamDate = (teamId: string, dateStr: string) =>
    assignments.filter(a => a.team_id === teamId && a.start_date === dateStr && isServiceAssignment(a));

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      const {
        data: teamsData,
        error: teamsError
      } = await supabase
        .from('placement_teams')
        .select('*, team_type')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (teamsError) throw teamsError;
      
      const fetchedTeams = teamsData || [];
      setTeams(fetchedTeams);
      
      setTeamCollapsedStates(prev => {
        const hasExistingStates = Object.keys(prev).length > 0;
        if (hasExistingStates) return prev;
        const initialCollapsedStates: Record<string, boolean> = {};
        fetchedTeams.forEach(team => {
          initialCollapsedStates[team.id] = true;
        });
        return initialCollapsedStates;
      });

      const {
        data: teamData,
        error: teamError
      } = await supabase.from('project_team_assignments').select('*').order('start_date', {
        ascending: true
      });
      if (teamError) throw teamError;
      setAssignments(teamData || []);

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
        title: t('itc_error'),
        description: t('itc_error_assignments'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchAssignments();
  }, [toast]);

  const updateTruckLoadingDate = async (projectId: string, installationDateStr: string, startDateStr: string) => {
    const truckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
    if (truckAssignmentIndex >= 0) {
      const truckAssignment = truckAssignments[truckAssignmentIndex];
      const startDate = new Date(startDateStr);
      const loadingDate = new Date(startDate);
      loadingDate.setDate(loadingDate.getDate() - 1);
      if (loadingDate.getDay() === 0) {
        loadingDate.setDate(loadingDate.getDate() - 2);
      } else if (loadingDate.getDay() === 6) {
        loadingDate.setDate(loadingDate.getDate() - 1);
      }
      const loadingDateStr = format(loadingDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('project_truck_assignments')
        .update({
          installation_date: installationDateStr,
          loading_date: loadingDateStr
        })
        .eq('id', truckAssignment.id);
      if (error) throw error;

      const updatedTruckAssignments = [...truckAssignments];
      updatedTruckAssignments[truckAssignmentIndex] = {
        ...truckAssignment,
        installation_date: installationDateStr,
        loading_date: loadingDateStr
      };
      setTruckAssignments(updatedTruckAssignments);
    }
  };

  const handleDropProject = async (projectId: string, team: string | null, teamId: string | null, newStartDate?: string) => {
    try {
      storePageScrollPosition();
      
      // Dropping onto any team (including service teams) is treated as a regular main installation assignment.
      // Service tickets are only created via the dedicated "Add After Sales Service" dialog.
      
      const existingMainAssignmentIndex = getMainAssignmentIndex(projectId);
      
      if (team === null) {
        if (existingMainAssignmentIndex >= 0) {
          const existingMainAssignment = assignments[existingMainAssignmentIndex];
          const { error } = await supabase
            .from('project_team_assignments')
            .delete()
            .eq('id', existingMainAssignment.id);
          if (error) throw error;

          const updatedAssignments = assignments.filter(a => a.id !== existingMainAssignment.id);
          setAssignments(updatedAssignments);

          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: null })
            .eq('id', projectId);
          if (projectError) throw projectError;

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
            title: t('itc_project_reset'),
            description: t('itc_project_reset_desc')
          });
          restorePageScrollPosition();
        }
      } else {
        // Moving to a regular team - set duration=1 (full day), clear service_hours
        if (existingMainAssignmentIndex >= 0) {
          const existingMainAssignment = assignments[existingMainAssignmentIndex];
          const updateData: any = { team, team_id: teamId, service_hours: null };
          if (newStartDate) {
            updateData.start_date = newStartDate;
          }
          // If coming from a service team, reset duration to 1 day
          const previousTeam = existingMainAssignment.team_id ? teams.find(t => t.id === existingMainAssignment.team_id) : null;
          if (previousTeam?.team_type === 'service') {
            updateData.duration = 1;
          }
          
          const { error } = await supabase
            .from('project_team_assignments')
            .update(updateData)
            .eq('id', existingMainAssignment.id);
          if (error) throw error;
          
          const updatedAssignments = [...assignments];
          updatedAssignments[existingMainAssignmentIndex] = {
            ...existingMainAssignment,
            ...updateData
          };
          setAssignments(updatedAssignments);

          const effectiveDuration = updateData.duration || existingMainAssignment.duration;
          const startDate = new Date(updateData.start_date || existingMainAssignment.start_date);
          const installationDate = addBusinessDays(startDate, effectiveDuration - 1);
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          const startDateStr = format(startDate, 'yyyy-MM-dd');

          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
          if (projectError) throw projectError;

          await updateTruckLoadingDate(projectId, installationDateStr, startDateStr);
          
          toast({
            title: t('itc_team_updated'),
            description: newStartDate 
              ? t('itc_team_updated_desc', { team, date: format(new Date(newStartDate), 'MMM d') })
              : t('itc_team_assigned_desc', { team })
          });
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

          const startDate = new Date(newAssignment.start_date);
          const installationDate = addBusinessDays(startDate, newAssignment.duration - 1);
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          const startDateStr = format(startDate, 'yyyy-MM-dd');

          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
          if (projectError) throw projectError;

          await updateTruckLoadingDate(projectId, installationDateStr, startDateStr);
          
          toast({
            title: t('itc_team_assigned'),
            description: t('itc_team_assigned_desc', { team })
          });
          restorePageScrollPosition();
        }
      }
    } catch (error) {
      console.error('Error handling project assignment:', error);
      toast({
        title: t('itc_error'),
        description: t('itc_error_assignment'),
        variant: "destructive"
      });
    }
  };

  // Handle service hours confirmation from dialog
  const handleServiceHoursConfirm = async () => {
    const { projectId, team, teamId, startDate, hours } = serviceHoursDialog;
    try {
      storePageScrollPosition();

      const existingForDay = getServiceAssignmentsForTeamDate(teamId, startDate);
      const newAssignment = {
        project_id: projectId,
        team,
        team_id: teamId,
        start_date: startDate,
        duration: 1,
        service_hours: hours,
        service_order: existingForDay.length + 1,
      };
      
      const { data, error } = await supabase
        .from('project_team_assignments')
        .insert([newAssignment])
        .select();
      if (error) throw error;
      setAssignments(prev => [...prev, data[0]]);
      
      toast({
        title: t('itc_team_assigned'),
        description: `${team} - ${hours}h`
      });
      
      setServiceHoursDialog(prev => ({ ...prev, open: false }));
      restorePageScrollPosition();
    } catch (error) {
      console.error('Error assigning service team:', error);
      toast({ title: t('itc_error'), description: t('itc_error_assignment'), variant: "destructive" });
    }
  };

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

      const startDate = new Date(assignment.start_date);
      const installationDate = addBusinessDays(startDate, newDuration - 1);
      const installationDateStr = format(installationDate, 'yyyy-MM-dd');
      const startDateStr = format(startDate, 'yyyy-MM-dd');

      const { error: projectError } = await supabase
        .from('projects')
        .update({ installation_date: installationDateStr })
        .eq('id', assignment.project_id);
      if (projectError) throw projectError;

      await updateTruckLoadingDate(assignment.project_id, installationDateStr, startDateStr);
      
      toast({
        title: t('itc_duration_updated'),
        description: t('itc_duration_updated_desc', { count: String(newDuration) })
      });

      restorePageScrollPosition();
    } catch (error) {
      console.error('Error updating project duration:', error);
      toast({
        title: t('itc_error'),
        description: t('itc_error_duration'),
        variant: "destructive"
      });
    }
  };

  const handleExtendProject = async (projectId: string, direction: string) => {
    console.log('Extension handled by duration change');
  };

  const handleTruckAssign = async (projectId: string, truckId: string) => {
    try {
      storePageScrollPosition();
      
      const assignment = getMainAssignment(projectId);
      if (!assignment) {
        toast({
          title: t('itc_error'),
          description: t('itc_error_team_first'),
          variant: "destructive"
        });
        return;
      }

      const startDate = new Date(assignment.start_date);
      const installationDate = addBusinessDays(startDate, assignment.duration - 1);
      const installationDateStr = format(installationDate, 'yyyy-MM-dd');
      const existingTruckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
      if (truckId === 'none' || truckId === '') {
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
            title: t('itc_truck_unassigned'),
            description: t('itc_truck_unassigned_desc')
          });
        }
      } else {
        const loadingDate = new Date(installationDate);
        loadingDate.setDate(loadingDate.getDate() - 1);
        if (loadingDate.getDay() === 0) {
          loadingDate.setDate(loadingDate.getDate() - 2);
        } else if (loadingDate.getDay() === 6) {
          loadingDate.setDate(loadingDate.getDate() - 1);
        }
        const loadingDateStr = format(loadingDate, 'yyyy-MM-dd');
        if (existingTruckAssignmentIndex >= 0) {
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
            title: t('itc_truck_updated'),
            description: t('itc_truck_updated_desc', { truck: updatedData.trucks.truck_number })
          });
        } else {
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
            title: t('itc_truck_updated'),
            description: t('itc_truck_updated_desc', { truck: data[0].trucks.truck_number })
          });
        }
      }

      restorePageScrollPosition();
    } catch (error) {
      console.error('Error assigning truck:', error);
      toast({
        title: t('itc_error'),
        description: t('itc_error_truck'),
        variant: "destructive"
      });
    }
  };

  const refreshDataWithScrollPreservation = async () => {
    storePageScrollPosition();
    await fetchAssignments();
    restorePageScrollPosition();
  };

  const mainAssignments = assignments.filter(a => !isServiceAssignment(a));
  
  if (loading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>;
  }
  
  return (
    <Card>
      <CardHeader className={isMobile ? 'px-3 py-2' : 'pb-2'}>
        <div className={`flex ${isMobile ? 'flex-col gap-1' : 'justify-between items-center'}`}>
          <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
            <CalendarDays className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
            {t('itc_title')}
          </CardTitle>
          {!isMobile && (
            <div className="text-sm text-muted-foreground">
              {t('itc_description')}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={isMobile ? 'px-2 pb-2' : ''}>
        <UnassignedProjects projects={projects} assignments={mainAssignments} truckAssignments={truckAssignments} onTruckAssign={handleTruckAssign} onDropProject={handleDropProject} />
        
        {teams.map(team => {
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

      {/* Service Hours Dialog */}
      <Dialog open={serviceHoursDialog.open} onOpenChange={(open) => setServiceHoursDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t('itc_service_hours_title') || 'Service Assignment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('itc_service_hours_desc') || 'How many hours will this service take?'}
            </p>
            <div className="space-y-2">
              <Label>{t('itc_hours') || 'Hours'}</Label>
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={serviceHoursDialog.hours}
                onChange={(e) => setServiceHoursDialog(prev => ({ ...prev, hours: parseFloat(e.target.value) || 1 }))}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t('itc_service_team') || 'Team'}: {serviceHoursDialog.team}<br/>
              {t('itc_date') || 'Date'}: {serviceHoursDialog.startDate && format(new Date(serviceHoursDialog.startDate), 'MMM d, yyyy')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceHoursDialog(prev => ({ ...prev, open: false }))}>
              {t('itc_cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleServiceHoursConfirm}>
              {t('itc_confirm') || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default InstallationTeamCalendar;
