import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .order('name');
      
      if (error) {
        console.error('Error fetching employees:', error);
        return;
      }
      
      setEmployees(data || []);
    };

    fetchEmployees();
  }, []);

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

  // Handle project assignment
  const handleAssignProject = async () => {
    if (!selectedEmployee || !selectedProject) return;
    
    // Here you would implement the assignment logic
    console.log('Assigning project', selectedProject, 'to employee', selectedEmployee);
    // Reset selections
    setSelectedEmployee('');
    setSelectedProject('');
  };

  return (
    <Card className="h-[calc(100vh-250px)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Installation Gantt Chart</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
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
                disabled={!selectedEmployee || !selectedProject}
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
          {/* Employee sidebar */}
          <div className="w-48 border-r border-border bg-muted/20">
            <div className="h-12 border-b border-border bg-muted/40 flex items-center px-4 font-semibold text-sm">
              Employees
            </div>
            <div className="overflow-y-auto h-[calc(100%-48px)]">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="h-16 border-b border-border/50 px-4 flex flex-col justify-center hover:bg-muted/30 transition-colors"
                >
                  <div className="font-medium text-sm truncate">{employee.name}</div>
                  <div className="text-xs text-muted-foreground">{employee.role}</div>
                </div>
              ))}
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
              
              {/* Employee rows with projects */}
              <div className="relative">
                {employees.map((employee, employeeIndex) => (
                  <div
                    key={employee.id}
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
                    
                    {/* Projects for this employee */}
                    {projects
                      .filter(project => {
                        // For now, show all projects. Later, filter by actual assignments
                        return true;
                      })
                      .map((project) => {
                        const position = getProjectPosition(project);
                        if (!position) return null;
                        
                        const teamName = project.project_team_assignments?.team;
                        const teamColor = getTeamColor(teamName);
                        
                        return (
                          <div
                            key={`${employee.id}-${project.id}`}
                            className={cn(
                              "absolute top-2 h-12 rounded-md flex items-center px-2 text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity",
                              teamColor
                            )}
                            style={{
                              left: position.left,
                              width: position.width
                            }}
                            title={`${project.name} - ${project.client} (${position.duration} days)`}
                          >
                            <div className="truncate flex-1">
                              <div className="font-semibold truncate">{project.name}</div>
                              <div className="text-xs opacity-90 truncate">{project.client}</div>
                            </div>
                            {project.progress > 0 && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {project.progress}%
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GanttChart;