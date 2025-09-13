
import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isToday, isPast, isTomorrow, isWeekend, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Truck, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { holidayService, Holiday } from '@/services/holidayService';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

interface Project {
  id: string;
  name: string;
  client: string;
  status: string;
  installation_date: string;
}

interface LoadingAssignment {
  project: Project;
  loading_date: string;
  truck_number?: string;
}

// Define installation team colors
const installationTeamColors = {
  green: {
    bg: 'bg-green-100 hover:bg-green-200',
    border: 'border-green-300',
    text: 'text-green-800',
  },
  blue: {
    bg: 'bg-blue-100 hover:bg-blue-200',
    border: 'border-blue-300',
    text: 'text-blue-800',
  },
  orange: {
    bg: 'bg-orange-100 hover:bg-orange-200',
    border: 'border-orange-300',
    text: 'text-orange-800',
  },
  unassigned: {
    bg: 'bg-gray-100 hover:bg-gray-200',
    border: 'border-gray-300',
    text: 'text-gray-800',
  }
};

const TruckLoadingCalendar = () => {
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  
  const [assignments, setAssignments] = useState<LoadingAssignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedWeeks, setLoadedWeeks] = useState<Set<string>>(new Set());
  const [weekLoading, setWeekLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  // Calculate previous workday considering holidays
  const getPreviousWorkday = (date: Date, holidaysList: Holiday[]): Date => {
    let previousDay = subDays(date, 1);
    
    while (true) {
      // Skip weekends
      if (isWeekend(previousDay)) {
        previousDay = subDays(previousDay, 1);
        continue;
      }
      
      // Skip production holidays
      const dateStr = format(previousDay, 'yyyy-MM-dd');
      const isHoliday = holidaysList.some(h => h.date === dateStr && h.team === 'production');
      
      if (isHoliday) {
        previousDay = subDays(previousDay, 1);
        continue;
      }
      
      break;
    }
    
    return previousDay;
  };

  // Load projects for a specific week
  const loadWeekData = async (weekStart: Date, holidaysData: Holiday[]) => {
    const weekEnd = addDays(weekStart, 6);
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    if (loadedWeeks.has(weekKey)) {
      return; // Already loaded
    }

    try {
      setWeekLoading(true);
      
      // Calculate date range for loading dates (projects that load during this week)
      // We need to look ahead to find projects whose loading dates fall in this week
      const searchStart = format(weekStart, 'yyyy-MM-dd');
      const searchEnd = format(addDays(weekEnd, 30), 'yyyy-MM-dd'); // Look ahead 30 days for installation dates
      
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client, status, installation_date')
        .not('installation_date', 'is', null)
        .gte('installation_date', searchStart)
        .lte('installation_date', searchEnd)
        .order('installation_date');
        
      if (projectsError) throw projectsError;
      
      // Calculate loading dates and filter for current week
      const weekLoadingAssignments: LoadingAssignment[] = (projectsData || [])
        .map(project => {
          const installationDate = new Date(project.installation_date);
          const loadingDate = getPreviousWorkday(installationDate, holidaysData);
          
          return {
            project,
            loading_date: format(loadingDate, 'yyyy-MM-dd'),
          };
        })
        .filter(assignment => {
          const loadingDate = new Date(assignment.loading_date);
          return loadingDate >= weekStart && loadingDate <= weekEnd;
        });
      
      // Merge with existing assignments (avoid duplicates)
      setAssignments(prev => {
        const existingIds = new Set(prev.map(a => `${a.project.id}-${a.loading_date}`));
        const newAssignments = weekLoadingAssignments.filter(
          a => !existingIds.has(`${a.project.id}-${a.loading_date}`)
        );
        return [...prev, ...newAssignments];
      });
      
      // Mark week as loaded
      setLoadedWeeks(prev => new Set([...prev, weekKey]));
      
    } catch (error) {
      console.error('Error loading week data:', error);
      toast({
        title: "Error",
        description: "Failed to load week data",
        variant: "destructive"
      });
    } finally {
      setWeekLoading(false);
    }
  };

  // Initial data fetch - load holidays and current week
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch holidays first
        const holidaysData = await holidayService.getHolidays();
        setHolidays(holidaysData);
        
        // Load current week data
        await loadWeekData(weekStartDate, holidaysData);
        
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast({
          title: "Error",
          description: "Failed to load initial data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [toast]);

  // Load new week data when week changes
  useEffect(() => {
    if (holidays.length > 0) {
      loadWeekData(weekStartDate, holidays);
    }
  }, [weekStartDate, holidays]);

  // Re-calculate assignments when holidays change
  useEffect(() => {
    if (assignments.length > 0 && holidays.length > 0) {
      const updatedAssignments = assignments.map(assignment => {
        const installationDate = new Date(assignment.project.installation_date);
        const loadingDate = getPreviousWorkday(installationDate, holidays);
        
        return {
          ...assignment,
          loading_date: format(loadingDate, 'yyyy-MM-dd'),
        };
      });
      
      setAssignments(updatedAssignments);
    }
  }, [holidays]);

  // Navigate weeks
  const prevWeek = async () => {
    const newWeekStart = addDays(weekStartDate, -7);
    setWeekStartDate(newWeekStart);
  };

  const nextWeek = async () => {
    const newWeekStart = addDays(weekStartDate, 7);
    setWeekStartDate(newWeekStart);
  };

  // Get assignments for today's loading
  const getTodayLoadingAssignments = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return assignments.filter(assignment => assignment.loading_date === today);
  };

  // Get upcoming loading assignments (next 7 days)
  const getUpcomingAssignments = () => {
    const today = new Date();
    const weekFromNow = addDays(today, 7);
    
    return assignments.filter(assignment => {
      const loadingDate = new Date(assignment.loading_date);
      return loadingDate > today && loadingDate <= weekFromNow;
    }).sort((a, b) => new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime());
  };

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(assignment => assignment.loading_date === dateStr);
  };

  // Get installation team color based on project status/team
  const getInstallationTeamColor = (status: string) => {
    switch (status) {
      case 'in_progress': return installationTeamColors.blue;
      case 'planned': return installationTeamColors.green;
      case 'completed': return installationTeamColors.unassigned;
      default: return installationTeamColors.orange;
    }
  };

  // Handle project click navigation
  const handleProjectClick = (projectId: string) => {
    navigate(`/${lang}/projects/${projectId}`);
  };

  // Get priority styling for loading dates
  const getLoadingPriority = (loadingDate: string) => {
    const date = new Date(loadingDate);
    if (isToday(date)) return 'border-red-500 bg-red-50';
    if (isTomorrow(date)) return 'border-orange-500 bg-orange-50';
    if (isPast(date)) return 'border-gray-400 bg-gray-100 opacity-75';
    return 'border-blue-500 bg-blue-50';
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const todayAssignments = getTodayLoadingAssignments();
  const upcomingAssignments = getUpcomingAssignments();

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-gray-600">Loading truck loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Loading Schedule
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevWeek} disabled={weekLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
                {weekLoading && <span className="ml-2 text-xs text-gray-500">Loading...</span>}
              </span>
              <Button variant="outline" size="icon" onClick={nextWeek} disabled={weekLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const dayAssignments = getAssignmentsForDate(date);
              const isCurrentDay = isToday(date);
              
              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[120px] border rounded p-2",
                    isCurrentDay ? "border-red-500 bg-red-50" : "border-gray-200"
                  )}
                >
                  <div className={cn(
                    "text-center text-sm font-medium mb-2",
                    isCurrentDay ? "text-red-700" : "text-gray-700"
                  )}>
                    <div>{format(date, 'EEE')}</div>
                    <div className="text-lg">{format(date, 'd')}</div>
                  </div>
                  
                  <div className="space-y-1">
                    {dayAssignments.map((assignment, index) => {
                      const teamColor = getInstallationTeamColor(assignment.project.status);
                      return (
                        <div
                          key={`${assignment.project.id}-${index}`}
                          className={cn(
                            "p-1 rounded text-xs border cursor-pointer transition-colors",
                            teamColor.bg,
                            teamColor.border,
                            teamColor.text
                          )}
                          onClick={() => handleProjectClick(assignment.project.id)}
                        >
                          <div className="font-medium truncate">{assignment.project.name}</div>
                          <div className="text-xs opacity-75">
                            Install: {format(new Date(assignment.project.installation_date), 'MMM d')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default TruckLoadingCalendar;
