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
      <div className="bg-slate-900/50 border-b border-slate-700 px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-white truncate">{t('control_panel')}</h1>
            <p className="text-slate-400 text-[10px] md:text-xs hidden sm:block">{t('cp_production_overview')}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(createLocalizedPath('/'))}
            className="text-white border-slate-600 bg-transparent hover:bg-white hover:text-slate-900 flex-shrink-0"
          >
            {isMobile ? '←' : t('cp_back_to_dashboard')}
          </Button>
        </div>
      </div>

      {/* Content - no scroll on desktop, scroll on mobile */}
      <div className={`flex-1 ${isMobile ? 'overflow-y-auto' : 'overflow-hidden'} px-3 md:px-6 py-2 md:py-3 flex flex-col`}>
        {/* Stats */}
        <div className={`grid gap-2 md:gap-3 mb-3 flex-shrink-0 ${isMobile ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {statsData.slice(0, isMobile ? 3 : 5).map((stat, i) => (
            <Card
              key={i}
              className={`bg-slate-800/50 border-slate-700 p-2 md:p-3 ${stat.onClick ? 'cursor-pointer hover:bg-slate-800/70 transition-colors' : ''}`}
              onClick={stat.onClick}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 md:p-1.5 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-3.5 h-3.5 md:w-5 md:h-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-400 text-[9px] md:text-[11px] truncate">{stat.label}</p>
                  <p className="text-base md:text-xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {isMobile && (
          <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
            {statsData.slice(3).map((stat, i) => (
              <Card
                key={i}
                className={`bg-slate-800/50 border-slate-700 p-2 ${stat.onClick ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
                onClick={stat.onClick}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[9px] truncate">{stat.label}</p>
                    <p className="text-base font-bold text-white">{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className={`${isMobile ? 'flex flex-col gap-3' : 'grid grid-cols-[1fr_240px] gap-3 flex-1 min-h-0'}`}>
          {/* Production Flow */}
          <Card className="bg-slate-800/50 border-slate-700 p-3 md:p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 md:mb-3 flex-shrink-0">
              <h2 className="text-sm md:text-base font-bold text-white">{t('cp_production_flow')}</h2>
              {hasMultipleLines && (
                <div className="flex gap-1">
                  {productionLines.map(line => (
                    <Button
                      key={line}
                      variant={selectedProductionLine === line ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedProductionLine(line)}
                      className={`h-7 text-xs ${selectedProductionLine === line 
                        ? "bg-primary text-primary-foreground" 
                        : "text-white border-slate-600 bg-transparent hover:bg-slate-700"}`}
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
                        <div className="flex items-center justify-center gap-3 py-0.5">
                          <ArrowRight className="w-3 h-3 text-slate-600 rotate-90" />
                          <div className="flex items-center gap-2 bg-slate-700/50 px-2 py-0.5 rounded text-[10px]">
                            {bufferMinutes > 0 && (
                              <span className="text-white">
                                <Clock className="w-2.5 h-2.5 inline mr-0.5 text-blue-400" />
                                {bufferHours > 0 && `${bufferHours}h `}{remainingMinutes > 0 && `${remainingMinutes}m`}
                              </span>
                            )}
                            {partCount > 0 && (
                              <span className="text-white">
                                <Package className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />{partCount}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                        className="w-full"
                      >
                        <Card className={`border transition-all ${
                          statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' :
                          statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' :
                          statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' :
                          'border-slate-600 bg-slate-700/50'
                        }`}>
                          <div className="p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                              <div className="text-left">
                                <h3 className="text-white font-bold text-xs">{workstation.name}</h3>
                                <p className="text-slate-400 text-[10px]">{statusText}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {status && status.active_users_count > 0 && (
                                <Badge variant="secondary" className="bg-slate-900/50 text-white text-[10px] px-1 py-0">
                                  <Users className="w-2.5 h-2.5 mr-0.5" />{status.active_users_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      </button>
                    </React.Fragment>
                  );
                })}

                {/* Truck Loading mobile */}
                <button onClick={() => navigate(createLocalizedPath('/truck-loading'))} className="w-full">
                  <Card className="border border-orange-500 bg-orange-500/20">
                    <div className="p-2.5 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-orange-500" />
                      <div className="text-left">
                        <h3 className="text-white font-bold text-xs">{t('cp_truck_loading')}</h3>
                        {truckLoadingData.todayLoadings.length > 0 && (
                          <p className="text-orange-400 text-[10px]">{t('cp_today')}: {truckLoadingData.todayLoadings.length}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </button>
              </div>
            ) : (
              /* Desktop: compact grid of workstation cards that fits the screen */
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 auto-rows-min">
                  {sortedWorkstations.map((workstation, index) => {
                    const status = getWorkstationStatus(workstation.id);
                    const statusColor = getStatusColor(status);
                    const statusText = getStatusText(status);
                    const bufferMinutes = workstationBufferTimes[workstation.id] || 0;
                    const bufferHours = Math.floor(bufferMinutes / 60);
                    const remainingMinutes = bufferMinutes % 60;
                    const partCount = workstationPartCounts[workstation.id] || 0;

                    return (
                      <button
                        key={workstation.id}
                        onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                        className="group relative text-left"
                      >
                        <Card className={`h-full border transition-all duration-200 ${
                          statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' :
                          statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' :
                          statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' :
                          'border-slate-600 bg-slate-700/50'
                        } hover:brightness-125 cursor-pointer`}>
                          <div className="p-2 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                              {status && status.active_users_count > 0 && (
                                <Badge variant="secondary" className="bg-slate-900/50 text-white text-[9px] px-1 py-0 h-4">
                                  <Users className="w-2.5 h-2.5 mr-0.5" />{status.active_users_count}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-white font-semibold text-[11px] leading-tight line-clamp-2">{workstation.name}</h3>
                            <p className="text-slate-400 text-[9px]">{statusText}</p>
                            {(bufferMinutes > 0 || partCount > 0) && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {bufferMinutes > 0 && (
                                  <span className="text-blue-400 text-[9px] flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {bufferHours > 0 && `${bufferHours}h`}{remainingMinutes > 0 && ` ${remainingMinutes}m`}
                                  </span>
                                )}
                                {partCount > 0 && (
                                  <span className="text-amber-400 text-[9px] flex items-center gap-0.5">
                                    <Package className="w-2.5 h-2.5" />{partCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                        {status?.has_error && (
                          <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg">
                            <AlertTriangle className="w-3 h-3" />{(status as any).errorCount || 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Truck Loading card */}
                  <button onClick={() => navigate(createLocalizedPath('/truck-loading'))} className="text-left">
                    <Card className="h-full border border-orange-500 bg-orange-500/20 hover:brightness-125 cursor-pointer transition-all duration-200">
                      <div className="p-2 flex flex-col gap-1 items-center justify-center min-h-[80px]">
                        <Truck className="w-5 h-5 text-orange-500" />
                        <h3 className="text-white font-semibold text-[11px] leading-tight text-center">{t('cp_truck_loading')}</h3>
                        {truckLoadingData.todayLoadings.length > 0 && (
                          <p className="text-orange-400 text-[9px]">{t('cp_today')}: {truckLoadingData.todayLoadings.length}</p>
                        )}
                        {truckLoadingData.todayLoadings.length === 0 && truckLoadingData.daysToNext > 0 && (
                          <p className="text-slate-400 text-[9px]">{t('cp_in_days', { days: String(truckLoadingData.daysToNext) })}</p>
                        )}
                      </div>
                    </Card>
                  </button>
                </div>

                {/* Legend */}
                <div className="mt-auto pt-2 border-t border-slate-700 flex-shrink-0">
                  <div className="flex items-center gap-4 justify-center text-[10px]">
                    {[
                      { color: 'bg-green-500', label: t('cp_active') },
                      { color: 'bg-yellow-500', label: t('cp_ready') },
                      { color: 'bg-gray-400', label: t('cp_idle') },
                      { color: 'bg-red-500', label: t('cp_error') },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-slate-400">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Legend */}
            {isMobile && (
              <div className="mt-3 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-3 justify-center text-[10px] flex-wrap">
                  {[
                    { color: 'bg-green-500', label: t('cp_active') },
                    { color: 'bg-yellow-500', label: t('cp_ready') },
                    { color: 'bg-gray-400', label: t('cp_idle') },
                    { color: 'bg-red-500', label: t('cp_error') },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-slate-400">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Active Employees */}
          <Card className={`bg-slate-800/50 border-slate-700 p-3 ${isMobile ? '' : 'overflow-hidden flex flex-col'}`}>
            <button 
              className="w-full flex items-center justify-between mb-2 md:cursor-default flex-shrink-0"
              onClick={() => isMobile && setShowWorkers(!showWorkers)}
            >
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                {t('cp_active_workers')}
              </h2>
              {isMobile && (showWorkers ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
            </button>
            
            {(showWorkers || !isMobile) && (
              <div className={`space-y-1.5 ${isMobile ? '' : 'flex-1 overflow-y-auto'} pr-1`}>
                {activeEmployees.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-3">{t('cp_no_active_workers')}</p>
                ) : (
                  activeEmployees.map((emp: any) => (
                    <div 
                      key={emp.employee_id} 
                      className="bg-slate-700/30 border border-slate-600 rounded-lg p-2 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-xs truncate">
                            {emp.employees?.name || t('cp_unknown')}
                          </p>
                          {emp.tasks && (
                            <p className="text-slate-300 text-[10px] mt-0.5 truncate">{emp.tasks.title}</p>
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
