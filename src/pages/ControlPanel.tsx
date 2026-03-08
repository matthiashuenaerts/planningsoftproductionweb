import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { workstationErrorService } from '@/services/workstationErrorService';
import { ArrowRight, Activity, AlertCircle, CheckCircle2, Clock, Users, AlertTriangle, Truck, Calendar, Zap, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isWeekend, differenceInDays, startOfDay } from 'date-fns';
import { holidayService } from '@/services/holidayService';
import { rushOrderService } from '@/services/rushOrderService';
import { useTenant } from '@/context/TenantContext';
import { partTrackingService } from '@/services/partTrackingService';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { tenant } = useTenant();
  const isMobile = useIsMobile();
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);
  const [workstationErrors, setWorkstationErrors] = useState<Record<string, number>>({});
  const [workstationBufferTimes, setWorkstationBufferTimes] = useState<Record<string, number>>({});
  const [workstationPartCounts, setWorkstationPartCounts] = useState<Record<string, number>>({});
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [rushOrdersCount, setRushOrdersCount] = useState(0);
  const [selectedProductionLine, setSelectedProductionLine] = useState<number | null>(null);
  const [showWorkers, setShowWorkers] = useState(!isMobile);
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
    queryKey: ['workstations', tenant?.id],
    queryFn: () => workstationService.getAll(tenant?.id)
  });

  const productionLines = [...new Set(workstations.map(ws => ws.production_line))].sort((a, b) => a - b);
  const hasMultipleLines = productionLines.length > 1;

  useEffect(() => {
    if (workstations.length > 0 && selectedProductionLine === null) {
      setSelectedProductionLine(productionLines[0] || 1);
    }
  }, [workstations, productionLines, selectedProductionLine]);

  const sortedWorkstations = workstations
    .filter(ws => !hasMultipleLines || ws.production_line === selectedProductionLine)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  useEffect(() => {
    loadStatuses();
    loadPartCounts();
    loadTruckLoadingData();
    loadActiveEmployees();
    loadRushOrders();
    
    const statusesChannel = floorplanService.subscribeToTimeRegistrations(setWorkstationStatuses);
    const statusInterval = setInterval(() => {
      loadStatuses();
      loadActiveEmployees();
      loadRushOrders();
    }, 30000);
    const loadingInterval = setInterval(loadTruckLoadingData, 60000);

    return () => {
      statusesChannel.unsubscribe();
      clearInterval(statusInterval);
      clearInterval(loadingInterval);
    };
  }, []);

  const loadPartCounts = async () => {
    try {
      const counts: Record<string, number> = {};
      for (const ws of workstations) {
        counts[ws.id] = await partTrackingService.getBufferedPartCount(ws.id);
      }
      setWorkstationPartCounts(counts);
    } catch (error) {
      console.error('Error loading part counts:', error);
    }
  };

  const loadRushOrders = async () => {
    try {
      const { data } = await supabase
        .from('rush_orders')
        .select('id, status')
        .in('status', ['pending', 'in_progress']);
      setRushOrdersCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading rush orders:', error);
    }
  };

  const loadActiveEmployees = async () => {
    try {
      const { data } = await supabase
        .from('time_registrations')
        .select(`
          employee_id,
          task_id,
          employees!inner(name),
          tasks(
            id,
            title,
            task_workstation_links(workstation_id, workstations(id, name))
          )
        `)
        .eq('is_active', true)
        .order('start_time', { ascending: false });
      setActiveEmployees(data || []);
    } catch (error) {
      console.error('Error loading active employees:', error);
    }
  };

  const loadStatuses = async () => {
    const statuses = await floorplanService.getWorkstationStatuses();
    setWorkstationStatuses(statuses);

    const errors = await workstationErrorService.getAllActiveErrors();
    const errorCounts: Record<string, number> = {};
    errors.forEach((error) => {
      errorCounts[error.workstation_id] = (errorCounts[error.workstation_id] || 0) + 1;
    });
    setWorkstationErrors(errorCounts);

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
      const holidays = await holidayService.getHolidays(tenant?.id);
      
      const getPreviousWorkday = (date: Date): Date => {
        let previousDay = subDays(date, 1);
        while (true) {
          if (isWeekend(previousDay)) { previousDay = subDays(previousDay, 1); continue; }
          const dateStr = format(previousDay, 'yyyy-MM-dd');
          const isHoliday = holidays.some(h => h.date === dateStr && h.team === 'production');
          if (isHoliday) { previousDay = subDays(previousDay, 1); continue; }
          break;
        }
        return previousDay;
      };

      const { data: overridesData } = await supabase
        .from('project_loading_overrides')
        .select('project_id, override_loading_date');
      const overridesMap: Record<string, string> = {};
      (overridesData || []).forEach(override => {
        overridesMap[override.project_id] = override.override_loading_date;
      });

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client, status, installation_date')
        .not('installation_date', 'is', null)
        .gte('installation_date', format(new Date(), 'yyyy-MM-dd'))
        .order('installation_date');

      const loadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const calculatedLoadingDate = getPreviousWorkday(installationDate);
        const loadingDate = overridesMap[project.id] || format(calculatedLoadingDate, 'yyyy-MM-dd');
        return { project, loading_date: loadingDate };
      });

      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const todayLoadings = loadingAssignments.filter(a => 
        format(startOfDay(new Date(overridesMap[a.project.id] || a.loading_date)), 'yyyy-MM-dd') === today
      );

      const upcomingLoadings = loadingAssignments
        .filter(a => {
          const loadingDate = new Date(overridesMap[a.project.id] || a.loading_date);
          return loadingDate > new Date() && differenceInDays(loadingDate, new Date()) <= 7;
        })
        .slice(0, 5);

      let daysToNext = 0;
      if (todayLoadings.length === 0 && loadingAssignments.length > 0) {
        const nextLoading = loadingAssignments[0];
        const nextDate = new Date(overridesMap[nextLoading.project.id] || nextLoading.loading_date);
        daysToNext = differenceInDays(nextDate, startOfDay(new Date()));
      }

      setTruckLoadingData({ todayLoadings, upcomingLoadings, daysToNext });
    } catch (error) {
      console.error('Error loading truck loading data:', error);
    }
  };

  const getWorkstationStatus = (workstationId: string) => {
    const status = workstationStatuses.find(s => s.workstation_id === workstationId);
    const errorCount = workstationErrors[workstationId] || 0;
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
    if (!status) return t('cp_unknown');
    if (status.has_error) return t('cp_error');
    if (status.is_active && status.active_users_count > 0) return t('cp_active');
    if (status.is_active) return t('cp_ready');
    return t('cp_idle');
  };

  const totalActive = workstations.filter(w => {
    const status = getWorkstationStatus(w.id);
    return status?.is_active && status?.active_users_count > 0 && !(status as any).errorCount;
  }).length;
  const totalErrors = Object.values(workstationErrors).reduce((sum, count) => sum + count, 0);
  const totalUsers = workstationStatuses.reduce((sum, s) => sum + s.active_users_count, 0);

  const statsData = [
    { icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10', label: t('cp_active_machines'), value: totalActive },
    { icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('cp_active_workers'), value: totalUsers },
    { icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10', label: t('cp_total_machines'), value: workstations.length },
    { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: t('cp_errors'), value: totalErrors },
    { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10', label: t('cp_rush_orders'), value: rushOrdersCount, onClick: () => navigate(createLocalizedPath('/rush-orders')) },
  ];

  return (
    <div className={`h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${totalErrors > 0 || rushOrdersCount > 0 ? 'ring-4 ring-red-500 ring-inset' : ''}`}>
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-4 md:px-8 py-3 md:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-white mb-0.5 truncate">{t('control_panel')}</h1>
            <p className="text-slate-400 text-xs md:text-sm hidden sm:block">{t('cp_production_overview')}</p>
          </div>
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={() => navigate(createLocalizedPath('/'))}
            className="text-white border-slate-600 bg-transparent hover:bg-white hover:text-slate-900 flex-shrink-0"
          >
            {isMobile ? '←' : t('cp_back_to_dashboard')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 md:px-8 py-3 md:py-4">
        {/* Stats */}
        <div className={`grid gap-3 mb-4 md:mb-6 ${isMobile ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {statsData.slice(0, isMobile ? 3 : 5).map((stat, i) => (
            <Card
              key={i}
              className={`bg-slate-800/50 border-slate-700 p-3 md:p-4 ${stat.onClick ? 'cursor-pointer hover:bg-slate-800/70 transition-colors' : ''}`}
              onClick={stat.onClick}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`p-1.5 md:p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 md:w-6 md:h-6 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-400 text-[10px] md:text-xs truncate">{stat.label}</p>
                  <p className="text-lg md:text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {isMobile && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {statsData.slice(3).map((stat, i) => (
              <Card
                key={i}
                className={`bg-slate-800/50 border-slate-700 p-3 ${stat.onClick ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
                onClick={stat.onClick}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] truncate">{stat.label}</p>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-[1fr_300px] gap-4'}`}>
          {/* Production Flow */}
          <Card className="bg-slate-800/50 border-slate-700 p-4 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base md:text-xl font-bold text-white">{t('cp_production_flow')}</h2>
              {hasMultipleLines && (
                <div className="flex gap-1 md:gap-2">
                  {productionLines.map(line => (
                    <Button
                      key={line}
                      variant={selectedProductionLine === line ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedProductionLine(line)}
                      className={selectedProductionLine === line 
                        ? "bg-primary text-primary-foreground" 
                        : "text-white border-slate-600 bg-transparent hover:bg-slate-700"}
                    >
                      {t('cp_line')} {line}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {isMobile ? (
              /* Mobile: vertical list */
              <div className="space-y-2">
                {sortedWorkstations.map((workstation, index) => {
                  const status = getWorkstationStatus(workstation.id);
                  const statusColor = getStatusColor(status);
                  const statusText = getStatusText(status);
                  const bufferMinutes = workstationBufferTimes[workstation.id] || 0;
                  const bufferHours = Math.floor(bufferMinutes / 60);
                  const remainingMinutes = bufferMinutes % 60;
                  const partCount = workstationPartCounts[workstation.id] || 0;

                  return (
                    <React.Fragment key={workstation.id}>
                      {index > 0 && (bufferMinutes > 0 || partCount > 0) && (
                        <div className="flex items-center justify-center gap-3 py-1">
                          <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
                          <div className="flex items-center gap-2 bg-slate-700/50 px-2 py-0.5 rounded text-xs">
                            {bufferMinutes > 0 && (
                              <span className="text-white">
                                <Clock className="w-3 h-3 inline mr-0.5 text-blue-400" />
                                {bufferHours > 0 && `${bufferHours}h `}{remainingMinutes > 0 && `${remainingMinutes}m`} {t('cp_buffer')}
                              </span>
                            )}
                            {partCount > 0 && (
                              <span className="text-white">
                                <Package className="w-3 h-3 inline mr-0.5 text-amber-400" />{partCount} {t('cp_parts')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                        className="w-full"
                      >
                        <Card className={`border-2 transition-all ${
                          statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' :
                          statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' :
                          statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' :
                          'border-slate-600 bg-slate-700/50'
                        }`}>
                          <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
                              <div className="text-left">
                                <h3 className="text-white font-bold text-sm">{workstation.name}</h3>
                                <p className="text-slate-400 text-xs">{statusText}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {status && status.active_users_count > 0 && (
                                <Badge variant="secondary" className="bg-slate-900/50 text-white text-xs">
                                  <Users className="w-3 h-3 mr-0.5" />{status.active_users_count}
                                </Badge>
                              )}
                              {status && status.active_tasks.length > 0 && (
                                <span className="text-xs text-slate-400">{status.active_tasks.length} {t('cp_tasks')}</span>
                              )}
                            </div>
                          </div>
                        </Card>
                      </button>
                    </React.Fragment>
                  );
                })}

                {/* Truck Loading mobile */}
                <div className="flex items-center justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
                </div>
                <button onClick={() => navigate(createLocalizedPath('/truck-loading'))} className="w-full">
                  <Card className="border-2 border-orange-500 bg-orange-500/20">
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5 text-orange-500" />
                        <div className="text-left">
                          <h3 className="text-white font-bold text-sm">{t('cp_truck_loading')}</h3>
                          {truckLoadingData.todayLoadings.length > 0 && (
                            <p className="text-orange-400 text-xs">{t('cp_today')}: {truckLoadingData.todayLoadings.length}</p>
                          )}
                          {truckLoadingData.todayLoadings.length === 0 && truckLoadingData.daysToNext > 0 && (
                            <p className="text-slate-400 text-xs">{t('cp_in_days', { days: String(truckLoadingData.daysToNext) })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              </div>
            ) : (
              /* Desktop: horizontal flow */
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {sortedWorkstations.map((workstation, index) => {
                  const status = getWorkstationStatus(workstation.id);
                  const statusColor = getStatusColor(status);
                  const statusText = getStatusText(status);
                  const bufferMinutes = workstationBufferTimes[workstation.id] || 0;
                  const bufferHours = Math.floor(bufferMinutes / 60);
                  const remainingMinutes = bufferMinutes % 60;
                  const partCount = workstationPartCounts[workstation.id] || 0;

                  return (
                    <React.Fragment key={workstation.id}>
                      {index > 0 && (
                        <div className="flex flex-col items-center gap-1.5">
                          {(bufferMinutes > 0 || partCount > 0) && (
                            <div className="flex flex-col items-center bg-slate-700/50 px-2 py-1 rounded-lg border border-slate-600">
                              {bufferMinutes > 0 && (
                                <>
                                  <Clock className="w-3 h-3 text-blue-400 mb-0.5" />
                                  <span className="text-white font-semibold text-xs">
                                    {bufferHours > 0 && `${bufferHours}h `}{remainingMinutes > 0 && `${remainingMinutes}m`}
                                  </span>
                                  <span className="text-slate-400 text-xs">{t('cp_buffer')}</span>
                                </>
                              )}
                              {partCount > 0 && (
                                <>
                                  <Package className="w-3 h-3 text-amber-400 mb-0.5 mt-1" />
                                  <span className="text-white font-semibold text-xs">{partCount}</span>
                                  <span className="text-slate-400 text-xs">{t('cp_parts')}</span>
                                </>
                              )}
                            </div>
                          )}
                          <ArrowRight className="w-6 h-6 text-slate-600 flex-shrink-0" />
                        </div>
                      )}
                      
                      <button
                        onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                        className="group relative"
                      >
                        <Card className={`w-40 h-28 border-2 transition-all duration-300 ${
                          statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' :
                          statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' :
                          statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' :
                          'border-slate-600 bg-slate-700/50'
                        } hover:scale-105 hover:shadow-xl cursor-pointer`}>
                          <div className="p-3 h-full flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                              <div className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
                              {status && status.active_users_count > 0 && (
                                <Badge variant="secondary" className="bg-slate-900/50 text-white text-xs px-1.5 py-0">
                                  <Users className="w-2.5 h-2.5 mr-0.5" />{status.active_users_count}
                                </Badge>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                              <h3 className="text-white font-bold text-sm leading-tight break-words">{workstation.name}</h3>
                              <p className="text-slate-400 text-xs mt-0.5">{statusText}</p>
                            </div>
                            {status && status.active_tasks.length > 0 && (
                              <div className="text-xs text-slate-400">{status.active_tasks.length} {t('cp_tasks')}</div>
                            )}
                          </div>
                        </Card>
                        {status?.has_error && (
                          <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                            <AlertTriangle className="w-4 h-4" />{(status as any).errorCount || 1}
                          </div>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })}
                
                {/* Truck Loading */}
                <div className="flex flex-col items-center gap-1.5">
                  <ArrowRight className="w-6 h-6 text-slate-600 flex-shrink-0" />
                </div>
                <button onClick={() => navigate(createLocalizedPath('/truck-loading'))} className="group relative">
                  <Card className="w-40 h-28 border-2 border-orange-500 bg-orange-500/20 hover:scale-105 hover:shadow-xl cursor-pointer transition-all duration-300">
                    <div className="p-3 h-full flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center items-center">
                        <Truck className="w-6 h-6 text-orange-500 mb-1" />
                        <h3 className="text-white font-bold text-sm leading-tight">{t('cp_truck_loading')}</h3>
                        {truckLoadingData.todayLoadings.length > 0 && (
                          <p className="text-orange-400 text-xs mt-1">{t('cp_today')}: {truckLoadingData.todayLoadings.length}</p>
                        )}
                        {truckLoadingData.todayLoadings.length === 0 && truckLoadingData.daysToNext > 0 && (
                          <p className="text-slate-400 text-xs mt-1">{t('cp_in_days', { days: String(truckLoadingData.daysToNext) })}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </button>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-700">
              <div className="flex items-center gap-4 md:gap-6 justify-center text-xs flex-wrap">
                {[
                  { color: 'bg-green-500', label: t('cp_active') },
                  { color: 'bg-yellow-500', label: t('cp_ready') },
                  { color: 'bg-gray-400', label: t('cp_idle') },
                  { color: 'bg-red-500', label: t('cp_error') },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Active Employees */}
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <button 
              className="w-full flex items-center justify-between mb-3 md:cursor-default"
              onClick={() => isMobile && setShowWorkers(!showWorkers)}
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {t('cp_active_workers')}
              </h2>
              {isMobile && (showWorkers ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />)}
            </button>
            
            {(showWorkers || !isMobile) && (
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
                {activeEmployees.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">{t('cp_no_active_workers')}</p>
                ) : (
                  activeEmployees.map((emp: any) => (
                    <div 
                      key={emp.employee_id} 
                      className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">
                            {emp.employees?.name || t('cp_unknown')}
                          </p>
                          {emp.tasks && (
                            <>
                              <p className="text-slate-300 text-xs mt-1 line-clamp-2">{emp.tasks.title}</p>
                              {emp.tasks.task_workstation_links?.[0]?.workstations && (
                                <p className="text-slate-400 text-xs mt-1">{emp.tasks.task_workstation_links[0].workstations.name}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
