
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

const TruckLoadingCalendar = () => {
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  
  const [assignments, setAssignments] = useState<LoadingAssignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const { toast } = useToast();

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

  // Fetch projects and calculate loading dates
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch holidays
        const holidaysData = await holidayService.getHolidays();
        setHolidays(holidaysData);
        
        // Fetch existing overrides
        const { data: overridesData, error: overridesError } = await supabase
          .from('project_loading_overrides')
          .select('project_id, override_loading_date');
          
        if (overridesError) throw overridesError;
        
        // Convert overrides to map
        const overridesMap: Record<string, string> = {};
        (overridesData || []).forEach(override => {
          overridesMap[override.project_id] = override.override_loading_date;
        });
        setManualOverrides(overridesMap);
        
        // Fetch all projects with installation dates
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, client, status, installation_date')
          .not('installation_date', 'is', null)
          .order('installation_date');
          
        if (projectsError) throw projectsError;
        
        // Calculate loading dates for each project
        const loadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
          const installationDate = new Date(project.installation_date);
          const loadingDate = getPreviousWorkday(installationDate, holidaysData);
          
          return {
            project,
            loading_date: format(loadingDate, 'yyyy-MM-dd'),
          };
        });
        
        setAssignments(loadingAssignments);
      } catch (error) {
        console.error('Error fetching truck loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load truck loading data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [toast]);

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
  const prevWeek = () => {
    setWeekStartDate(addDays(weekStartDate, -7));
  };

  const nextWeek = () => {
    setWeekStartDate(addDays(weekStartDate, 7));
  };

  // Get assignments for today's loading
  const getTodayLoadingAssignments = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return assignments.filter(assignment => {
      const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
      return effectiveLoadingDate === today;
    });
  };

  // Get upcoming loading assignments (next 7 days)
  const getUpcomingAssignments = () => {
    const today = new Date();
    const weekFromNow = addDays(today, 7);
    
    return assignments.filter(assignment => {
      const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
      const loadingDate = new Date(effectiveLoadingDate);
      return loadingDate > today && loadingDate <= weekFromNow;
    }).sort((a, b) => {
      const aDate = manualOverrides[a.project.id] || a.loading_date;
      const bDate = manualOverrides[b.project.id] || b.loading_date;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  };

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(assignment => {
      const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
      return effectiveLoadingDate === dateStr;
    });
  };

  // Adjust loading date manually
  const adjustLoadingDate = async (projectId: string, direction: 'left' | 'right') => {
    const assignment = assignments.find(a => a.project.id === projectId);
    if (!assignment) return;

    const currentDate = manualOverrides[projectId] 
      ? new Date(manualOverrides[projectId]) 
      : new Date(assignment.loading_date);
    
    const newDate = addDays(currentDate, direction === 'right' ? 1 : -1);
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    
    try {
      // Check if override already exists
      const { data: existingOverride } = await supabase
        .from('project_loading_overrides')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (existingOverride) {
        // Update existing override
        const { error } = await supabase
          .from('project_loading_overrides')
          .update({ 
            override_loading_date: newDateStr,
            updated_at: new Date().toISOString()
          })
          .eq('project_id', projectId);
          
        if (error) throw error;
      } else {
        // Create new override
        const { error } = await supabase
          .from('project_loading_overrides')
          .insert({
            project_id: projectId,
            original_loading_date: assignment.loading_date,
            override_loading_date: newDateStr
          });
          
        if (error) throw error;
      }

      // Update local state
      setManualOverrides(prev => ({
        ...prev,
        [projectId]: newDateStr
      }));

      toast({
        title: "Loading date updated",
        description: `Loading date changed to ${format(newDate, 'MMM d, yyyy')}`,
      });
    } catch (error) {
      console.error('Error saving loading date override:', error);
      toast({
        title: "Error",
        description: "Failed to save loading date change",
        variant: "destructive"
      });
    }
  };

  // Get project color for visual distinction
  const getProjectColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'planned': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-orange-100 text-orange-800 border-orange-300';
    }
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
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Today's Loading - Big Sign */}
      <Card className="border-2 border-red-500">
        <CardHeader className="bg-red-500 text-white">
          <CardTitle className="text-2xl flex items-center gap-3">
            <Truck className="h-8 w-8" />
            TODAY'S LOADING SCHEDULE
            <Badge className="bg-white text-red-500 text-lg px-3 py-1">
              {format(new Date(), 'EEEE, MMMM d')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {todayAssignments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {todayAssignments.map((assignment, index) => (
                <div
                  key={`${assignment.project.id}-${index}`}
                  className={cn(
                    "p-4 rounded-lg border-2",
                    getProjectColor(assignment.project.status)
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={cn("text-lg px-3 py-1", getProjectColor(assignment.project.status))}>
                      {assignment.project.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <div className="text-sm text-gray-600">
                      Install: {format(new Date(assignment.project.installation_date), 'MMM d')}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{assignment.project.name}</h3>
                  <p className="text-gray-600 mb-2">{assignment.project.client}</p>
                  <div className="text-sm text-gray-500">
                    Loading scheduled for today, installation starts tomorrow
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Truck className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">No Loading Scheduled Today</h3>
              <p className="text-gray-500">All trucks are ready for tomorrow's installations</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Loading Schedule
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="icon" onClick={nextWeek}>
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
                      const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
                      const isManuallyAdjusted = manualOverrides[assignment.project.id] !== undefined;
                      
                      return (
                        <div
                          key={`${assignment.project.id}-${index}`}
                          className={cn(
                            "p-1 rounded text-xs border group relative",
                            getProjectColor(assignment.project.status),
                            isManuallyAdjusted && "border-orange-400 bg-orange-50"
                          )}
                        >
                          <div className="font-medium overflow-hidden relative">
                            <div className="animate-marquee whitespace-nowrap inline-block">
                              {assignment.project.name} • {assignment.project.name} • {assignment.project.name}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            Install: {format(new Date(assignment.project.installation_date), 'MMM d')}
                          </div>
                          <div className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => adjustLoadingDate(assignment.project.id, 'left')}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              ←
                            </button>
                            <span className="text-xs text-gray-600">
                              {format(new Date(effectiveLoadingDate), 'MMM d')}
                            </span>
                            <button
                              onClick={() => adjustLoadingDate(assignment.project.id, 'right')}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              →
                            </button>
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

      {/* Upcoming Loading - Small Column */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Loading ({upcomingAssignments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAssignments.length > 0 ? (
            <div className="space-y-3">
              {upcomingAssignments.slice(0, 10).map((assignment, index) => {
                const effectiveLoadingDate = manualOverrides[assignment.project.id] || assignment.loading_date;
                const isManuallyAdjusted = manualOverrides[assignment.project.id] !== undefined;
                
                return (
                  <div
                    key={`${assignment.project.id}-${index}`}
                    className={cn(
                      "p-3 rounded-lg border-l-4 bg-white border group",
                      getLoadingPriority(effectiveLoadingDate),
                      isManuallyAdjusted && "border-orange-400 bg-orange-50"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getProjectColor(assignment.project.status)}>
                            {assignment.project.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => adjustLoadingDate(assignment.project.id, 'left')}
                              className="text-sm text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ←
                            </button>
                            <span className="text-sm text-gray-600">
                              Load: {format(new Date(effectiveLoadingDate), 'MMM d')}
                              {isManuallyAdjusted && <span className="text-orange-600 ml-1">*</span>}
                            </span>
                            <button
                              onClick={() => adjustLoadingDate(assignment.project.id, 'right')}
                              className="text-sm text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              →
                            </button>
                          </div>
                        </div>
                        <h4 className="font-medium">{assignment.project.name}</h4>
                        <p className="text-sm text-gray-600">{assignment.project.client}</p>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>Install:</div>
                        <div>{format(new Date(assignment.project.installation_date), 'MMM d')}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {upcomingAssignments.length > 10 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  +{upcomingAssignments.length - 10} more assignments
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p>No upcoming loading scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TruckLoadingCalendar;
