import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { workstationErrorService } from '@/services/workstationErrorService';
import { ArrowRight, Activity, AlertCircle, CheckCircle2, Clock, Users, AlertTriangle, Truck, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isWeekend, differenceInDays, startOfDay } from 'date-fns';
import { holidayService } from '@/services/holidayService';

interface LoadingAssignment {
  project: {
    id: string;
    name: string;
    client: string;
    status: string;
    installation_date: string;
  };
  loading_date: string;
}

const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);
  const [workstationErrors, setWorkstationErrors] = useState<Record<string, number>>({});
  const [workstationBufferTimes, setWorkstationBufferTimes] = useState<Record<string, number>>({});
  const [truckLoadingData, setTruckLoadingData] = useState<{
    todayLoadings: LoadingAssignment[];
    upcomingLoadings: LoadingAssignment[];
    daysToNext: number;
  }>({
    todayLoadings: [],
    upcomingLoadings: [],
    daysToNext: 0
  });

  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations'],
    queryFn: workstationService.getAll
  });

  useEffect(() => {
    loadStatuses();
    loadTruckLoadingData();
    
    const statusesChannel = floorplanService.subscribeToTimeRegistrations(setWorkstationStatuses);
    const statusInterval = setInterval(loadStatuses, 30000);
    const loadingInterval = setInterval(loadTruckLoadingData, 60000);

    return () => {
      statusesChannel.unsubscribe();
      clearInterval(statusInterval);
      clearInterval(loadingInterval);
    };
  }, []);

  const loadStatuses = async () => {
    const statuses = await floorplanService.getWorkstationStatuses();
    setWorkstationStatuses(statuses);

    // Load error counts for each workstation
    const errors = await workstationErrorService.getAllActiveErrors();
    const errorCounts: Record<string, number> = {};
    errors.forEach((error) => {
      errorCounts[error.workstation_id] = (errorCounts[error.workstation_id] || 0) + 1;
    });
    setWorkstationErrors(errorCounts);

    // Load buffer times (TODO tasks duration) for each workstation
    const { data: todoTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        duration,
        task_workstation_links!inner(
          workstation_id
        )
      `)
      .eq('status', 'TODO');

    const bufferTimes: Record<string, number> = {};
    todoTasks?.forEach((task: any) => {
      task.task_workstation_links?.forEach((link: any) => {
        const workstationId = link.workstation_id;
        bufferTimes[workstationId] = (bufferTimes[workstationId] || 0) + (task.duration || 0);
      });
    });
    setWorkstationBufferTimes(bufferTimes);
  };

  const loadTruckLoadingData = async () => {
    try {
      // Fetch holidays
      const holidays = await holidayService.getHolidays();
      
      // Helper to calculate loading date
      const getPreviousWorkday = (date: Date): Date => {
        let previousDay = subDays(date, 1);
        
        while (true) {
          if (isWeekend(previousDay)) {
            previousDay = subDays(previousDay, 1);
            continue;
          }
          
          const dateStr = format(previousDay, 'yyyy-MM-dd');
          const isHoliday = holidays.some(h => h.date === dateStr && h.team === 'production');
          
          if (isHoliday) {
            previousDay = subDays(previousDay, 1);
            continue;
          }
          
          break;
        }
        
        return previousDay;
      };

      // Fetch overrides
      const { data: overridesData } = await supabase
        .from('project_loading_overrides')
        .select('project_id, override_loading_date');
      
      const overridesMap: Record<string, string> = {};
      (overridesData || []).forEach(override => {
        overridesMap[override.project_id] = override.override_loading_date;
      });

      // Fetch projects with installation dates
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client, status, installation_date')
        .not('installation_date', 'is', null)
        .gte('installation_date', format(new Date(), 'yyyy-MM-dd'))
        .order('installation_date');

      // Calculate loading dates
      const loadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const calculatedLoadingDate = getPreviousWorkday(installationDate);
        const loadingDate = overridesMap[project.id] || format(calculatedLoadingDate, 'yyyy-MM-dd');
        
        return {
          project,
          loading_date: loadingDate
        };
      });

      // Filter today's loadings
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const todayLoadings = loadingAssignments.filter(a => 
        format(startOfDay(new Date(overridesMap[a.project.id] || a.loading_date)), 'yyyy-MM-dd') === today
      );

      // Get upcoming loadings (next 7 days, excluding today)
      const upcomingLoadings = loadingAssignments
        .filter(a => {
          const loadingDate = new Date(overridesMap[a.project.id] || a.loading_date);
          return loadingDate > new Date() && differenceInDays(loadingDate, new Date()) <= 7;
        })
        .slice(0, 5);

      // Calculate days to next loading
      let daysToNext = 0;
      if (todayLoadings.length === 0 && loadingAssignments.length > 0) {
        const nextLoading = loadingAssignments[0];
        const nextDate = new Date(overridesMap[nextLoading.project.id] || nextLoading.loading_date);
        daysToNext = differenceInDays(nextDate, startOfDay(new Date()));
      }

      setTruckLoadingData({
        todayLoadings,
        upcomingLoadings,
        daysToNext
      });
    } catch (error) {
      console.error('Error loading truck loading data:', error);
    }
  };

  const getWorkstationStatus = (workstationId: string) => {
    const status = workstationStatuses.find(s => s.workstation_id === workstationId);
    const errorCount = workstationErrors[workstationId] || 0;
    
    // Override has_error if there are active errors
    if (status && errorCount > 0) {
      return { ...status, has_error: true, errorCount };
    }
    
    return status;
  };

  const getStatusColor = (status?: WorkstationStatus) => {
    if (!status) return 'bg-gray-400';
    if (status.has_error) return 'bg-red-500';
    if (status.is_active && status.active_users_count > 0) return 'bg-green-500';
    if (status.is_active) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getStatusText = (status?: WorkstationStatus) => {
    if (!status) return 'Unknown';
    if (status.has_error) return 'Error';
    if (status.is_active && status.active_users_count > 0) return 'Active';
    if (status.is_active) return 'Ready';
    return 'Idle';
  };

  const totalActive = workstations.filter(w => {
    const status = getWorkstationStatus(w.id);
    return status?.is_active && status?.active_users_count > 0 && !(status as any).errorCount;
  }).length;
  const totalErrors = Object.values(workstationErrors).reduce((sum, count) => sum + count, 0);
  const totalUsers = workstationStatuses.reduce((sum, s) => sum + s.active_users_count, 0);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-8 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{t('control_panel')}</h1>
            <p className="text-slate-400 text-sm">Production Overview & Monitoring</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/'))}
            className="text-white border-slate-600 hover:bg-slate-800"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Active Machines</p>
                <p className="text-2xl font-bold text-white">{totalActive}</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Active Workers</p>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Machines</p>
                <p className="text-2xl font-bold text-white">{workstations.length}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Errors</p>
                <p className="text-2xl font-bold text-white">{totalErrors}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Production Flow */}
        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Production Flow</h2>
          
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {workstations.map((workstation, index) => {
              const status = getWorkstationStatus(workstation.id);
              const statusColor = getStatusColor(status);
              const statusText = getStatusText(status);
              
              // Get buffer time (TODO tasks duration) for this workstation
              const bufferMinutes = workstationBufferTimes[workstation.id] || 0;
              const bufferHours = Math.floor(bufferMinutes / 60);
              const remainingMinutes = bufferMinutes % 60;
              
              return (
                <React.Fragment key={workstation.id}>
                  {index > 0 && (
                    <div className="flex flex-col items-center gap-1.5">
                      {bufferMinutes > 0 && (
                        <div className="flex flex-col items-center bg-slate-700/50 px-2 py-1 rounded-lg border border-slate-600">
                          <Clock className="w-3 h-3 text-blue-400 mb-0.5" />
                          <span className="text-white font-semibold text-xs">
                            {bufferHours > 0 && `${bufferHours}h `}
                            {remainingMinutes > 0 && `${remainingMinutes}m`}
                          </span>
                          <span className="text-slate-400 text-xs">buffer</span>
                        </div>
                      )}
                      <ArrowRight className="w-6 h-6 text-slate-600 flex-shrink-0" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                    className="group relative"
                  >
                    <Card 
                      className={`
                        w-40 h-28 border-2 transition-all duration-300
                        ${statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' : ''}
                        ${statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' : ''}
                        ${statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' : ''}
                        ${statusColor === 'bg-gray-400' ? 'border-slate-600 bg-slate-700/50' : ''}
                        hover:scale-105 hover:shadow-xl cursor-pointer
                      `}
                    >
                      <div className="p-3 h-full flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                          <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
                          {status && status.active_users_count > 0 && (
                            <Badge variant="secondary" className="bg-slate-900/50 text-white text-xs px-1.5 py-0">
                              <Users className="w-2.5 h-2.5 mr-0.5" />
                              {status.active_users_count}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center">
                          <h3 className="text-white font-bold text-sm leading-tight break-words">{workstation.name}</h3>
                          <p className="text-slate-400 text-xs mt-0.5">{statusText}</p>
                        </div>

                        {status && status.active_tasks.length > 0 && (
                          <div className="text-xs text-slate-400">
                           {status.active_tasks.length} tasks
                          </div>
                        )}
                      </div>
                    </Card>
                    
                    {status?.has_error && (
                      <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                        <AlertTriangle className="w-4 h-4" />
                        {(status as any).errorCount || 1}
                      </div>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-6 justify-center text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-slate-400">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-slate-400">Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-slate-400">Idle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-400">Error</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Truck Loading */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Truck className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Truck Loading</h2>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(createLocalizedPath('/daily-tasks'))}
              className="text-white border-slate-600 hover:bg-slate-700"
            >
              View Calendar
            </Button>
          </div>

          {/* Today's Loadings */}
          {truckLoadingData.todayLoadings.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-orange-400">Loading Today</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {truckLoadingData.todayLoadings.map((loading) => (
                  <Card 
                    key={loading.project.id}
                    className="bg-orange-500/10 border-orange-500/30 p-3 cursor-pointer hover:bg-orange-500/20 transition-colors"
                    onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{loading.project.name}</p>
                        <p className="text-slate-400 text-xs truncate">{loading.project.client}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                            Install: {format(new Date(loading.project.installation_date), 'MMM d')}
                          </Badge>
                        </div>
                      </div>
                      <Badge className="bg-orange-500 text-white flex-shrink-0">Today</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
              <p className="text-slate-400 text-sm">
                {truckLoadingData.daysToNext > 0 
                  ? `Next loading in ${truckLoadingData.daysToNext} day${truckLoadingData.daysToNext > 1 ? 's' : ''}`
                  : 'No loadings scheduled today'}
              </p>
            </div>
          )}

          {/* Upcoming Loadings */}
          {truckLoadingData.upcomingLoadings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-400">Upcoming Installations (Next 7 Days)</h3>
              </div>
              <div className="space-y-2">
                {truckLoadingData.upcomingLoadings.map((loading) => (
                  <Card 
                    key={loading.project.id}
                    className="bg-slate-700/30 border-slate-600 p-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{loading.project.name}</p>
                        <p className="text-slate-400 text-xs truncate">{loading.project.client}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Loading</p>
                          <p className="text-white font-semibold text-sm">
                            {format(new Date(loading.loading_date), 'MMM d')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Install</p>
                          <p className="text-white font-semibold text-sm">
                            {format(new Date(loading.project.installation_date), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {truckLoadingData.todayLoadings.length === 0 && truckLoadingData.upcomingLoadings.length === 0 && (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No upcoming installations scheduled</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ControlPanel;
