import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { projectService } from '@/services/dataService';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import InstallationTeamCalendar from '@/components/InstallationTeamCalendar';
import TruckLoadingCalendar from '@/components/TruckLoadingCalendar';
interface Project {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
  team?: string;
  [key: string]: any;
}

interface ProjectWithTeam extends Project {
  project_team_assignments?: {
    team: string;
  } | null;
}

// Define team colors
const teamColors = {
  green: {
    bg: 'bg-green-100',
    border: 'border-green-300',
    text: 'text-green-800',
    project: 'bg-green-200 border-green-400'
  },
  blue: {
    bg: 'bg-blue-100',
    border: 'border-blue-300', 
    text: 'text-blue-800',
    project: 'bg-blue-200 border-blue-400'
  },
  orange: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-800',
    project: 'bg-orange-200 border-orange-400'
  },
  unassigned: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-800',
    project: 'bg-gray-200 border-gray-400'
  }
};
const DailyTasks: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [displayMode, setDisplayMode] = useState<'calendar' | 'teams' | 'trucks'>('calendar');
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const {
    toast
  } = useToast();

  // Format the selected date to match our date format in the database
  const formattedSelectedDate = selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Fetch all projects with installation dates and team assignments
  useEffect(() => {
    const fetchAllProjects = async () => {
      try {
        setLoading(true);

        // Get all projects with installation dates and their team assignments
        const {
          data,
          error
        } = await supabase
          .from('projects')
          .select(`
            *,
            project_team_assignments!left (
              team
            )
          `)
          .not('installation_date', 'is', null)
          .order('installation_date', {
            ascending: true
          });
        
        if (error) throw error;
        setAllProjects(data || []);

        // Filter projects for the selected date
        filterProjectsForSelectedDate(selectedDate, data || []);
      } catch (error: any) {
        console.error('Error fetching projects:', error);
        toast({
          title: "Error",
          description: `Failed to load projects: ${error.message}`,
          variant: "destructive"
        });
        setAllProjects([]);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProjects();
  }, [toast]);

  // Filter projects when selected date changes
  useEffect(() => {
    filterProjectsForSelectedDate(selectedDate, allProjects);
  }, [selectedDate, allProjects]);

  // Filter projects for selected date
  const filterProjectsForSelectedDate = (date: Date | undefined, allProjectsData: ProjectWithTeam[]) => {
    if (!date) {
      setProjects([]);
      return;
    }
    const dateString = date.toISOString().split('T')[0];
    const filtered = allProjectsData.filter(project => {
      return project.installation_date === dateString;
    });
    setProjects(filtered);
  };

  // Navigation helpers for month view
  const goToPreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Get calendar grid (6 weeks)
  const getCalendarGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  // Get projects for a specific date
  const getProjectsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return allProjects.filter(project => project.installation_date === dateString);
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Handler for clicking project
  const handleProjectClick = (projectId: string) => {
    window.location.href = `/projects/${projectId}`;
  };

  // Get team color based on team name
  const getTeamColor = (teamName: string | null | undefined) => {
    if (!teamName) return teamColors.unassigned;
    
    if (teamName.toLowerCase().includes('groen')) return teamColors.green;
    if (teamName.toLowerCase().includes('blauw')) return teamColors.blue;
    if (teamName.toLowerCase().includes('orange')) return teamColors.orange;
    
    return teamColors.unassigned;
  };

  // Get project's team assignment
  const getProjectTeam = (project: ProjectWithTeam): string | null => {
    return project.project_team_assignments?.team || null;
  };

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
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
  return <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6 my-[70px]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Installation Calendar</h1>
            
            <div className="flex mt-4 md:mt-0 space-x-2">
              <Button variant={displayMode === 'calendar' ? 'default' : 'outline'} onClick={() => setDisplayMode('calendar')}>
                Calendar View
              </Button>
              <Button variant={displayMode === 'teams' ? 'default' : 'outline'} onClick={() => setDisplayMode('teams')}>
                Team Planner
              </Button>
              <Button variant={displayMode === 'trucks' ? 'default' : 'outline'} onClick={() => setDisplayMode('trucks')}>
                <Truck className="h-4 w-4 mr-2" />
                Truck Loading
              </Button>
            </div>
          </div>
          
          {displayMode === 'calendar' ? (
            <Card className="h-[calc(100vh-250px)]">
              <CardHeader>
                <CardTitle>Installation Timeline</CardTitle>
                <CardDescription>
                  All projects scheduled for installation
                </CardDescription>
              </CardHeader>
              <CardContent className="h-full">
                {loading ? (
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    <div className="relative">
                      <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
                      
                      {allProjects.length > 0 ? (() => {
                        // Group projects by installation date
                        const projectsByDate = allProjects.reduce((acc, project) => {
                          const date = project.installation_date;
                          if (!acc[date]) {
                            acc[date] = [];
                          }
                          acc[date].push(project);
                          return acc;
                        }, {} as Record<string, ProjectWithTeam[]>);

                        // Sort dates
                        const sortedDates = Object.keys(projectsByDate).sort();

                        return (
                          <div className="space-y-8">
                            {sortedDates.map((date) => {
                              const projects = projectsByDate[date];
                              const installationDate = new Date(date);
                              const isUpcoming = installationDate >= new Date();
                              
                              return (
                                <div key={date} className="relative pl-14">
                                  {/* Date node */}
                                  <div className={cn(
                                    "absolute left-3 top-3 w-6 h-6 rounded-full border-4 border-background flex items-center justify-center",
                                    isUpcoming ? "bg-primary" : "bg-muted"
                                  )}>
                                    <div className={cn(
                                      "w-2 h-2 rounded-full",
                                      isUpcoming ? "bg-primary-foreground" : "bg-muted-foreground"
                                    )} />
                                  </div>
                                  
                                  {/* Date header */}
                                  <div className="mb-4">
                                    <div className="text-lg font-semibold">
                                      {formatDate(date)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                                    </div>
                                  </div>
                                  
                                  {/* Projects for this date */}
                                  <div className="space-y-3 ml-4">
                                    {projects.map((project) => {
                                      const teamName = getProjectTeam(project);
                                      const teamColor = getTeamColor(teamName);
                                      
                                      return (
                                        <div 
                                          key={project.id} 
                                          className={cn(
                                            "p-4 rounded-lg border-l-4 cursor-pointer hover:bg-muted/50 transition-colors",
                                            teamColor.project
                                          )}
                                          onClick={() => handleProjectClick(project.id)}
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="font-semibold text-base">{project.name}</div>
                                              <div className="text-muted-foreground text-sm">{project.client}</div>
                                            </div>
                                            
                                            <div className="flex flex-col sm:items-end gap-2">
                                              <Badge className={cn(getStatusColor(project.status))}>
                                                {project.status}
                                              </Badge>
                                              {teamName && (
                                                <Badge variant="outline" className={cn(teamColor.text, teamColor.border)}>
                                                  {teamName}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-2 text-sm mt-2">
                                            <span className="text-muted-foreground">Progress:</span>
                                            <span className="font-medium">{project.progress || 0}%</span>
                                            <div className="flex-1 max-w-[200px] h-2 bg-background rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-primary rounded-full transition-all duration-300" 
                                                style={{ width: `${project.progress || 0}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })() : (
                        <div className="text-center py-12">
                          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-lg font-medium text-muted-foreground mb-2">No installations found</p>
                          <p className="text-muted-foreground">
                            No projects are currently scheduled for installation.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : displayMode === 'teams' ? <InstallationTeamCalendar projects={allProjects} /> : <TruckLoadingCalendar />}
        </div>
      </div>
    </div>;
};
export default DailyTasks;