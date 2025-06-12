import React, { useState, useEffect } from 'react';
import { format, addDays, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, CalendarDays, Truck, GripHorizontal } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  assignment?: Assignment;
}

// Define team colors
const teamColors = {
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
  unassigned: {
    bg: 'bg-gray-100 hover:bg-gray-200',
    border: 'border-gray-300',
    text: 'text-gray-800',
    header: 'bg-gray-500 text-white',
    project: 'bg-gray-200 border-gray-400'
  }
};

// Get truck color for visual distinction
const getTruckColor = (truckNumber: string) => {
  switch (truckNumber) {
    case '01': return 'bg-blue-500 text-white';
    case '02': return 'bg-green-500 text-white';
    case '03': return 'bg-orange-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

// Duration selector component
const DurationSelector = ({ value, onChange, disabled = false }) => {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs">Days:</span>
      <Input
        type="number"
        min="1"
        max="30"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        disabled={disabled}
        className="h-6 w-16 text-xs"
      />
    </div>
  );
};

// Enhanced project item component with better visual spanning
const ProjectItem = ({ 
  project, 
  team, 
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
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PROJECT',
    item: { 
      id: project.id, 
      team: team,
      assignment: assignment
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }));

  const teamColor = team ? teamColors[team] : teamColors.unassigned;
  
  const handleDurationChange = (newDuration: number) => {
    if (assignment && onDurationChange) {
      onDurationChange(assignment.id, newDuration);
    }
  };

  const handleTruckChange = async (truckId: string) => {
    await onTruckAssign(project.id, truckId);
  };

  // Only show full content on the start day or single day projects
  const showFullContent = isStart || totalDays === 1;

  return (
    <div
      ref={drag}
      className={cn(
        "relative cursor-move border-2 rounded-lg mb-1",
        teamColor.project,
        isDragging ? "opacity-50 z-50" : "opacity-100",
        isContinuation ? "border-l-0 rounded-l-none" : "",
        dayPosition === totalDays - 1 && totalDays > 1 ? "border-r-0 rounded-r-none" : "",
        totalDays > 1 && dayPosition > 0 && dayPosition < totalDays - 1 ? "border-x-0 rounded-none" : ""
      )}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="p-2">
        {showFullContent ? (
          <>
            <div className="flex justify-between items-start mb-1">
              <div className="flex-1 min-w-0">
                <div className={cn("font-medium text-sm truncate", teamColor.text)}>
                  {project.name}
                </div>
                <div className="text-xs text-gray-600 truncate">{project.client}</div>
              </div>
              <Badge className={getStatusColor(project.status)} variant="outline">
                {project.status}
              </Badge>
            </div>
            
            {/* Duration Selector */}
            {team && assignment && (
              <div className="mb-2">
                <DurationSelector
                  value={assignment.duration}
                  onChange={handleDurationChange}
                />
              </div>
            )}
            
            {/* Truck Assignment */}
            {team && (
              <div className="mb-2">
                <TruckSelector
                  value={truckAssignment?.truck_id || ''}
                  onValueChange={handleTruckChange}
                  truckNumber={truckAssignment?.truck?.truck_number}
                />
              </div>
            )}
            
            {assignment && (
              <div className="text-xs text-gray-600 mt-1">
                {format(new Date(assignment.start_date), 'MMM d')}
                {assignment.duration > 1 && (
                  <span> - {format(addDays(new Date(assignment.start_date), assignment.duration - 1), 'MMM d')}</span>
                )}
                {truckAssignment && (
                  <div className="text-xs text-blue-600">
                    Load: {format(new Date(truckAssignment.loading_date), 'MMM d')}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // Continuation indicator
          <div className="h-8 flex items-center justify-center">
            <GripHorizontal className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
};

// Truck selector component
const TruckSelector = ({ value, onValueChange, truckNumber }) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    const fetchTrucks = async () => {
      const { data } = await supabase.from('trucks').select('*').order('truck_number');
      setTrucks(data || []);
    };
    fetchTrucks();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Truck className="h-3 w-3" />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-6 text-xs flex-1">
          <SelectValue placeholder="Assign truck">
            {truckNumber ? (
              <Badge className={getTruckColor(truckNumber)}>
                T{truckNumber}
              </Badge>
            ) : (
              "No truck"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No truck assigned</SelectItem>
          {trucks.map(truck => (
            <SelectItem key={truck.id} value={truck.id}>
              <div className="flex items-center gap-2">
                <Badge className={getTruckColor(truck.truck_number)}>
                  {truck.truck_number}
                </Badge>
                <span>{truck.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Enhanced day cell component with better drop zones
const DayCell = ({ 
  date, 
  team, 
  projects, 
  assignments, 
  truckAssignments, 
  onDropProject, 
  handleExtendProject,
  handleDurationChange,
  onTruckAssign,
  currentMonth 
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      const dropDate = format(date, 'yyyy-MM-dd');
      if (item.team === team && item.assignment) {
        // Moving within same team - just update start date
        handleDateChange(item.assignment.id, dropDate);
      } else {
        // Moving to different team or from unassigned
        onDropProject(item.id, team, dropDate);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  }));

  const handleDateChange = async (assignmentId: string, newStartDate: string) => {
    try {
      const { error } = await supabase
        .from('project_team_assignments')
        .update({ start_date: newStartDate })
        .eq('id', assignmentId);
        
      if (error) throw error;
      
      // The parent component should refetch data
      window.location.reload();
    } catch (error) {
      console.error('Error updating assignment date:', error);
    }
  };

  const dateStr = format(date, 'yyyy-MM-dd');
  const isCurrentMonthDay = isSameMonth(date, currentMonth);
  
  // Get projects that should be displayed on this day
  const projectsForDay = assignments
    .filter(assignment => assignment.team === team)
    .map(assignment => {
      const project = projects.find(p => p.id === assignment.project_id);
      if (!project) return null;
      
      const startDate = new Date(assignment.start_date);
      const endDate = addDays(startDate, assignment.duration - 1);
      
      // Check if this date falls within the project duration
      const isWithinProject = isWithinInterval(date, {
        start: startOfDay(startDate),
        end: endOfDay(endDate)
      });
      
      if (!isWithinProject) return null;
      
      // Calculate position within the project duration
      const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const isStart = daysDiff === 0;
      const isContinuation = daysDiff > 0;
      
      return {
        project,
        assignment,
        isStart,
        isContinuation,
        dayPosition: daysDiff,
        totalDays: assignment.duration
      };
    })
    .filter(Boolean);

  return (
    <div 
      ref={drop}
      className={cn(
        "min-h-[120px] border border-gray-200 p-1",
        !isCurrentMonthDay && "bg-gray-50 text-gray-400",
        isOver ? "bg-blue-50 border-blue-300" : "",
        isCurrentMonthDay ? "bg-white" : ""
      )}
    >
      <div className={cn(
        "text-center text-sm font-medium mb-1",
        !isCurrentMonthDay && "text-gray-400"
      )}>
        <div>{format(date, 'EEE')}</div>
        <div className="text-lg">{format(date, 'd')}</div>
      </div>
      
      <div className="space-y-1">
        {projectsForDay.map(({ project, assignment, isStart, isContinuation, dayPosition, totalDays }) => {
          const truckAssignment = truckAssignments.find(ta => ta.project_id === project.id);
          
          return (
            <ProjectItem 
              key={`${project.id}-${dayPosition}`}
              project={project} 
              team={team}
              assignment={assignment}
              truckAssignment={truckAssignment}
              onExtendProject={handleExtendProject}
              onDurationChange={handleDurationChange}
              onTruckAssign={onTruckAssign}
              isStart={isStart}
              isContinuation={isContinuation}
              dayPosition={dayPosition}
              totalDays={totalDays}
            />
          );
        })}
      </div>
    </div>
  );
};

// Enhanced team calendar component with monthly view
const TeamCalendar = ({ 
  team, 
  currentMonth, 
  projects, 
  assignments, 
  truckAssignments, 
  onDropProject, 
  handleExtendProject,
  handleDurationChange,
  onTruckAssign 
}) => {
  const teamColor = teamColors[team];
  
  // Get all days in the month including padding days from previous/next month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfDay(addDays(monthStart, -monthStart.getDay()));
  const calendarEnd = endOfDay(addDays(monthEnd, 6 - monthEnd.getDay()));
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  // Group days into weeks
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="mb-6">
      <div className={cn("p-3 rounded-t-lg", teamColor.header)}>
        <h3 className="text-lg font-medium capitalize">{team} Team</h3>
      </div>
      
      <div className={cn("rounded-b-lg border-b border-x", teamColor.border)}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
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
                projects={projects} 
                assignments={assignments}
                truckAssignments={truckAssignments}
                onDropProject={onDropProject}
                handleExtendProject={handleExtendProject}
                handleDurationChange={handleDurationChange}
                onTruckAssign={onTruckAssign}
                currentMonth={currentMonth}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Function to get status badge color
const getStatusColor = (status) => {
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

// Enhanced unassigned projects component
const UnassignedProjects = ({ projects, assignments, truckAssignments, onTruckAssign, onDropProject }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item: DragItem) => {
      // Move project back to unassigned by removing its team assignment
      onDropProject(item.id, null, null);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  }));

  const unassignedProjects = projects.filter(project => 
    !assignments.some(a => a.project_id === project.id)
  );
  
  return (
    <div className="mb-6">
      <div className={cn("p-3 rounded-t-lg", teamColors.unassigned.header)}>
        <h3 className="text-lg font-medium">Unassigned Projects ({unassignedProjects.length})</h3>
      </div>
      
      <div 
        ref={drop}
        className={cn(
          "p-2 rounded-b-lg border-b border-x border-gray-300 bg-white min-h-[100px]",
          isOver ? "bg-gray-100" : ""
        )}
      >
        {unassignedProjects.length === 0 ? (
          <p className="text-center text-gray-500 p-4">No unassigned projects</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {unassignedProjects.map(project => {
              const truckAssignment = truckAssignments.find(ta => ta.project_id === project.id);
              return (
                <ProjectItem 
                  key={project.id} 
                  project={project} 
                  team={null}
                  assignment={null}
                  truckAssignment={truckAssignment}
                  onExtendProject={() => {}}
                  onDurationChange={() => {}}
                  onTruckAssign={onTruckAssign}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Main installation team calendar component
const InstallationTeamCalendar = ({ projects }: { projects: Project[] }) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<TruckAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch team assignments and truck assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        
        // Fetch team assignments
        const { data: teamData, error: teamError } = await supabase
          .from('project_team_assignments')
          .select('*')
          .order('start_date', { ascending: true });
          
        if (teamError) throw teamError;
        setAssignments(teamData || []);
        
        // Fetch truck assignments
        const { data: truckData, error: truckError } = await supabase
          .from('project_truck_assignments')
          .select(`
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
    
    fetchAssignments();
  }, [toast]);

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Handle project drop on a team or unassigned
  const handleDropProject = async (projectId: string, team: string | null, newStartDate?: string) => {
    try {
      const existingAssignmentIndex = assignments.findIndex(a => a.project_id === projectId);
      
      if (team === null) {
        // Remove team assignment (move to unassigned)
        if (existingAssignmentIndex >= 0) {
          const existingAssignment = assignments[existingAssignmentIndex];
          
          const { error } = await supabase
            .from('project_team_assignments')
            .delete()
            .eq('id', existingAssignment.id);
            
          if (error) throw error;
          
          // Remove from assignments array
          const updatedAssignments = assignments.filter(a => a.project_id !== projectId);
          setAssignments(updatedAssignments);
          
          // Update project installation_date to null
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
            title: "Project Unassigned",
            description: "Project has been moved to unassigned"
          });
        }
      } else {
        // Assign to team
        if (existingAssignmentIndex >= 0) {
          const existingAssignment = assignments[existingAssignmentIndex];
          const updateData: Partial<Assignment> = { team };
          
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
          
          // Calculate and update installation date
          const installationDate = new Date(updateData.start_date || existingAssignment.start_date);
          installationDate.setDate(installationDate.getDate() + (existingAssignment.duration - 1));
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          
          // Update project installation_date
          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
            
          if (projectError) throw projectError;
          
          // Update truck assignment loading date if exists
          await updateTruckLoadingDate(projectId, installationDateStr);
          
          toast({
            title: "Team Updated",
            description: `Project has been assigned to ${team} team${newStartDate ? ` starting ${format(new Date(newStartDate), 'MMM d')}` : ''}`
          });
        } else {
          const newAssignment = {
            project_id: projectId,
            team,
            start_date: newStartDate || format(new Date(), 'yyyy-MM-dd'),
            duration: 1
          };
          
          const { data, error } = await supabase
            .from('project_team_assignments')
            .insert([newAssignment])
            .select();
            
          if (error) throw error;
          
          setAssignments([...assignments, data[0]]);
          
          // Calculate and update installation date
          const installationDate = new Date(newAssignment.start_date);
          installationDate.setDate(installationDate.getDate() + (newAssignment.duration - 1));
          const installationDateStr = format(installationDate, 'yyyy-MM-dd');
          
          // Update project installation_date
          const { error: projectError } = await supabase
            .from('projects')
            .update({ installation_date: installationDateStr })
            .eq('id', projectId);
            
          if (projectError) throw projectError;
          
          toast({
            title: "Team Assigned",
            description: `Project has been assigned to ${team} team`
          });
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

  // Handle duration change
  const handleDurationChange = async (assignmentId: string, newDuration: number) => {
    try {
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
      
      // Calculate and update installation date
      const installationDate = new Date(assignment.start_date);
      installationDate.setDate(installationDate.getDate() + (newDuration - 1));
      const installationDateStr = format(installationDate, 'yyyy-MM-dd');
      
      // Update project installation_date
      const { error: projectError } = await supabase
        .from('projects')
        .update({ installation_date: installationDateStr })
        .eq('id', assignment.project_id);
        
      if (projectError) throw projectError;
      
      // Update truck assignment loading date if exists
      await updateTruckLoadingDate(assignment.project_id, installationDateStr);
      
      toast({
        title: "Duration Updated",
        description: `Project duration is now ${newDuration} day${newDuration > 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error('Error updating project duration:', error);
      toast({
        title: "Error",
        description: "Failed to update project duration",
        variant: "destructive"
      });
    }
  };

  // Helper function to update truck loading date
  const updateTruckLoadingDate = async (projectId: string, installationDateStr: string) => {
    const truckAssignmentIndex = truckAssignments.findIndex(ta => ta.project_id === projectId);
    if (truckAssignmentIndex >= 0) {
      const truckAssignment = truckAssignments[truckAssignmentIndex];
      
      // Calculate new loading date
      const installationDate = new Date(installationDateStr);
      const loadingDate = new Date(installationDate);
      loadingDate.setDate(loadingDate.getDate() - 1);
      
      // Weekend adjustment
      if (loadingDate.getDay() === 0) { // Sunday
        loadingDate.setDate(loadingDate.getDate() - 2); // Friday
      } else if (loadingDate.getDay() === 6) { // Saturday
        loadingDate.setDate(loadingDate.getDate() - 1); // Friday
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
      
      // Update local state
      const updatedTruckAssignments = [...truckAssignments];
      updatedTruckAssignments[truckAssignmentIndex] = {
        ...truckAssignment,
        installation_date: installationDateStr,
        loading_date: loadingDateStr
      };
      setTruckAssignments(updatedTruckAssignments);
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
      
      // Calculate installation date from team assignment
      const startDate = new Date(assignment.start_date);
      const installationDate = new Date(startDate);
      installationDate.setDate(installationDate.getDate() + (assignment.duration - 1));
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
        // Calculate loading date (one workday before installation)
        const loadingDate = new Date(installationDate);
        loadingDate.setDate(loadingDate.getDate() - 1);
        
        // If installation is on Monday, loading should be on Friday
        if (loadingDate.getDay() === 0) { // Sunday
          loadingDate.setDate(loadingDate.getDate() - 2); // Friday
        } else if (loadingDate.getDay() === 6) { // Saturday
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
    } catch (error) {
      console.error('Error assigning truck:', error);
      toast({
        title: "Error",
        description: "Failed to assign truck",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Installation Team Calendar
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[150px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UnassignedProjects 
            projects={projects} 
            assignments={assignments} 
            truckAssignments={truckAssignments}
            onTruckAssign={handleTruckAssign}
            onDropProject={handleDropProject}
          />
          <TeamCalendar 
            team="green" 
            currentMonth={currentMonth}
            projects={projects} 
            assignments={assignments} 
            truckAssignments={truckAssignments}
            onDropProject={handleDropProject} 
            handleExtendProject={handleExtendProject}
            handleDurationChange={handleDurationChange}
            onTruckAssign={handleTruckAssign}
          />
          <TeamCalendar 
            team="blue" 
            currentMonth={currentMonth}
            projects={projects} 
            assignments={assignments} 
            truckAssignments={truckAssignments}
            onDropProject={handleDropProject} 
            handleExtendProject={handleExtendProject}
            handleDurationChange={handleDurationChange}
            onTruckAssign={handleTruckAssign}
          />
          <TeamCalendar 
            team="orange" 
            currentMonth={currentMonth}
            projects={projects} 
            assignments={assignments} 
            truckAssignments={truckAssignments}
            onDropProject={handleDropProject} 
            handleExtendProject={handleExtendProject}
            handleDurationChange={handleDurationChange}
            onTruckAssign={handleTruckAssign}
          />
        </CardContent>
      </Card>
    </DndProvider>
  );
};

export default InstallationTeamCalendar;
