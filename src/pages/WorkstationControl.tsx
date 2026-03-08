import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { workstationErrorService, WorkstationError } from '@/services/workstationErrorService';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Activity, AlertTriangle, CheckCircle2, Clock, Users, Package, TrendingUp, Calendar, Zap } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, parseISO, addDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { rushOrderService } from '@/services/rushOrderService';
import { useIsMobile } from '@/hooks/use-mobile';

const WorkstationControl: React.FC = () => {
  const { workstationId } = useParams<{ workstationId: string }>();
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();
  const [workstationStatus, setWorkstationStatus] = useState<WorkstationStatus | null>(null);
  const [timeRegistrations, setTimeRegistrations] = useState<any[]>([]);
  const [weekTimeRegistrations, setWeekTimeRegistrations] = useState<any[]>([]);
  const [brokenParts, setBrokenParts] = useState<any[]>([]);
  const [currentTasks, setCurrentTasks] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [activeUserTasks, setActiveUserTasks] = useState<Map<string, any[]>>(new Map());
  const [activeErrors, setActiveErrors] = useState<WorkstationError[]>([]);
  const [newErrorMessage, setNewErrorMessage] = useState('');
  const [newErrorType, setNewErrorType] = useState('general');
  const [newErrorNotes, setNewErrorNotes] = useState('');
  const [showAddError, setShowAddError] = useState(false);
  const [rushOrders, setRushOrders] = useState<any[]>([]);

  const { data: workstation } = useQuery({
    queryKey: ['workstation', workstationId],
    queryFn: () => workstationService.getById(workstationId!),
    enabled: !!workstationId
  });

  useEffect(() => {
    if (!workstationId) return;
    loadWorkstationData();
    const statusInterval = setInterval(loadWorkstationData, 30000);
    return () => clearInterval(statusInterval);
  }, [workstationId]);

  const loadWorkstationData = async () => {
    if (!workstationId) return;
    try {
      const statuses = await floorplanService.getWorkstationStatuses();
      const status = statuses.find(s => s.workstation_id === workstationId);
      setWorkstationStatus(status || null);

      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayTimeRegsRaw } = await supabase
        .from('time_registrations')
        .select('*, employees(name), tasks(task_workstation_links(workstation_id))')
        .gte('start_time', `${today}T00:00:00`)
        .order('start_time', { ascending: false });
      
      const todayRegs = (todayTimeRegsRaw || []).filter((reg: any) => 
        reg.tasks?.task_workstation_links?.some((link: any) => link.workstation_id === workstationId)
      );
      setTimeRegistrations(todayRegs);

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      
      const { data: weekTimeRegsRaw } = await supabase
        .from('time_registrations')
        .select('*, employees(name), tasks(task_workstation_links(workstation_id))')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });
      
      const weekRegs = (weekTimeRegsRaw || []).filter((reg: any) => 
        reg.tasks?.task_workstation_links?.some((link: any) => link.workstation_id === workstationId)
      );
      setWeekTimeRegistrations(weekRegs);

      const brokenResult = await supabase
        .from('broken_parts')
        .select('*')
        .eq('workstation_id', workstationId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (brokenResult.data) setBrokenParts(brokenResult.data);

      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, phases(name, projects(id, name)), task_workstation_links!inner(workstation_id)`)
        .eq('task_workstation_links.workstation_id', workstationId)
        .in('status', ['IN_PROGRESS', 'TODO'])
        .order('due_date', { ascending: true });
      if (tasksData) setCurrentTasks(tasksData);

      const { data: todayTasksData } = await supabase
        .from('tasks')
        .select(`*, phases(name, projects(id, name)), task_workstation_links!inner(workstation_id)`)
        .eq('task_workstation_links.workstation_id', workstationId)
        .eq('status', 'IN_PROGRESS')
        .gte('due_date', today)
        .order('due_date', { ascending: true });
      if (todayTasksData) setTodayTasks(todayTasksData);

      if (status?.active_user_names && status.active_user_names.length > 0) {
        const userTasksMap = new Map<string, any[]>();
        for (const userName of status.active_user_names) {
          const { data: userTasks } = await supabase
            .from('time_registrations')
            .select(`*, tasks(id, title, description, status, task_workstation_links(workstation_id), phases(name, projects(id, name)))`)
            .gte('start_time', `${today}T00:00:00`)
            .is('end_time', null)
            .order('start_time', { ascending: false });
          const filteredTasks = (userTasks || []).filter((reg: any) => 
            reg.tasks?.task_workstation_links?.some((link: any) => link.workstation_id === workstationId)
          );
          if (filteredTasks.length > 0) userTasksMap.set(userName, filteredTasks);
        }
        setActiveUserTasks(userTasksMap);
      }

      const errors = await workstationErrorService.getActiveErrors(workstationId);
      setActiveErrors(errors);

      const rushOrdersData = await rushOrderService.getRushOrdersForWorkstation(workstationId);
      setRushOrders(rushOrdersData || []);
    } catch (error) {
      console.error('Error loading workstation data:', error);
    }
  };

  const getStatusColor = () => {
    if (!workstationStatus) return 'bg-gray-400';
    if (activeErrors.length > 0) return 'bg-red-500';
    if (workstationStatus.has_error) return 'bg-red-500';
    if (workstationStatus.is_active && workstationStatus.active_users_count > 0) return 'bg-green-500';
    if (workstationStatus.is_active) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (!workstationStatus) return t('cp_unknown');
    if (activeErrors.length > 0) return t('cp_error');
    if (workstationStatus.has_error) return t('cp_error');
    if (workstationStatus.is_active && workstationStatus.active_users_count > 0) return t('wc_active_running');
    if (workstationStatus.is_active) return t('wc_ready_idle');
    return t('cp_idle');
  };

  const todayChartData = timeRegistrations.slice(0, 10).map(reg => {
    const duration = reg.end_time 
      ? (new Date(reg.end_time).getTime() - new Date(reg.start_time).getTime()) / (1000 * 60)
      : (new Date().getTime() - new Date(reg.start_time).getTime()) / (1000 * 60);
    return { time: format(new Date(reg.start_time), 'HH:mm'), duration: Math.round(duration), name: t('wc_today') };
  });

  const weekChartData: any[] = [];
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRegs = weekTimeRegistrations.filter(reg => format(new Date(reg.start_time), 'yyyy-MM-dd') === dayStr);
    const totalMinutes = dayRegs.reduce((sum, reg) => {
      const duration = reg.end_time ? (new Date(reg.end_time).getTime() - new Date(reg.start_time).getTime()) / (1000 * 60) : 0;
      return sum + duration;
    }, 0);
    weekChartData.push({ day: daysOfWeek[i], hours: Math.round(totalMinutes / 60 * 10) / 10, registrations: dayRegs.length });
  }

  const handleAddError = async () => {
    if (!workstationId || !currentEmployee || !newErrorMessage.trim()) return;
    await workstationErrorService.createError(workstationId, newErrorMessage, newErrorType, currentEmployee.id, newErrorNotes || undefined);
    setNewErrorMessage('');
    setNewErrorType('general');
    setNewErrorNotes('');
    setShowAddError(false);
    loadWorkstationData();
  };

  const handleResolveError = async (errorId: string) => {
    if (!currentEmployee) return;
    await workstationErrorService.resolveError(errorId, currentEmployee.id);
    loadWorkstationData();
  };

  if (!workstation) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-white text-xl">{t('wc_loading')}</div>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${activeErrors.length > 0 || rushOrders.length > 0 ? 'ring-4 ring-red-500 ring-inset' : ''}`}>
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-4 md:px-8 py-3 md:py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={() => navigate(createLocalizedPath('/control-panel'))}
            className="text-white border-slate-600 bg-transparent hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
            {isMobile ? '' : t('wc_back_to_overview')}
          </Button>
          
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
            <Badge 
              variant="outline" 
              className={`text-xs md:text-base px-2 md:px-3 py-0.5 md:py-1 ${
                getStatusColor() === 'bg-green-500' ? 'border-green-500 text-green-500' :
                getStatusColor() === 'bg-red-500' ? 'border-red-500 text-red-500' :
                getStatusColor() === 'bg-yellow-500' ? 'border-yellow-500 text-yellow-500' :
                'border-gray-400 text-gray-400'
              }`}
            >
              {getStatusText()}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-white mb-0.5 truncate">{workstation.name}</h1>
            {workstation.description && (
              <p className="text-slate-400 text-xs md:text-sm truncate">{workstation.description}</p>
            )}
          </div>
          
          {rushOrders.length > 0 && (
            <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-red-500/20 border border-red-500/50 rounded-lg flex-shrink-0 ml-2">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-red-400 animate-pulse" />
              <div>
                <p className="text-red-400 font-bold text-xs md:text-sm">{t('wc_rush_orders_label')}</p>
                <p className="text-red-300 text-[10px] md:text-xs">{rushOrders.length} {rushOrders.length === 1 ? t('wc_active_order') : t('wc_active_orders')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-3 md:px-8 py-3 md:py-4">
        {/* Stats Grid */}
        <div className={`grid gap-3 mb-4 md:mb-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {[
            { icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('wc_active_workers'), value: workstationStatus?.active_users_count || 0 },
            { icon: Package, color: 'text-purple-500', bg: 'bg-purple-500/10', label: t('wc_current_tasks'), value: workstationStatus?.active_tasks.length || 0 },
            { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', label: t('wc_capacity'), value: workstation.active_workers || 1 },
            { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', label: t('wc_active_errors'), value: activeErrors.length },
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700 p-3 md:p-4">
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

        {/* Main Grid */}
        <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-3 gap-4 auto-rows-min'}`}>
          {/* Today's Task Timeline */}
          <Card className={`bg-slate-800/50 border-slate-700 ${isMobile ? '' : 'row-span-2'}`}>
            <CardHeader className="px-4 md:px-6 py-3 md:py-4">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <Package className="w-4 h-4 md:w-5 md:h-5" />
                {t('wc_todays_task_timeline')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4">
              <ScrollArea className={isMobile ? 'max-h-[300px]' : 'h-[570px]'}>
                <div className="space-y-2">
                  {todayTasks.length === 0 ? (
                    <p className="text-slate-400 text-sm">{t('wc_no_tasks_today')}</p>
                  ) : (
                    todayTasks.map((task, index) => {
                      const startTime = task.due_date ? new Date(task.due_date) : new Date();
                      const endTime = task.duration ? new Date(startTime.getTime() + task.duration * 60000) : new Date(startTime.getTime() + 60 * 60000);
                      const projectName = task.phases?.projects?.name || t('wc_unknown_project');
                      return (
                        <div key={task.id} className="relative">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs text-slate-400 w-14 md:w-20">{format(startTime, 'HH:mm')}</div>
                            <div className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={task.status === 'IN_PROGRESS' ? 'default' : 'secondary'} className="text-xs">{task.status}</Badge>
                                    <span className="text-white text-sm font-medium truncate">{task.title}</span>
                                  </div>
                                  <p className="text-slate-400 text-xs mt-1 truncate">{projectName}</p>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-xs flex-shrink-0">
                                  <Clock className="w-3 h-3" />{format(endTime, 'HH:mm')}
                                </div>
                              </div>
                            </div>
                          </div>
                          {index < todayTasks.length - 1 && <div className="w-0.5 h-2 bg-slate-600 ml-7 md:ml-10"></div>}
                        </div>
                      );
                    })
                  )}
                  
                  {currentTasks.filter(t2 => t2.status === 'TODO').length > 0 && (
                    <>
                      <div className="pt-3 mt-3 border-t border-slate-600">
                        <p className="text-slate-400 text-xs mb-2">{t('wc_upcoming_tasks')}</p>
                      </div>
                      {currentTasks.filter(t2 => t2.status === 'TODO').slice(0, 5).map((task) => (
                        <Card key={task.id} className="bg-slate-700/30 border-slate-600 p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{task.title}</p>
                              <p className="text-slate-400 text-xs truncate">{task.phases?.projects?.name || t('wc_unknown_project')}</p>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400 text-xs flex-shrink-0">
                              <Clock className="w-3 h-3" />{task.duration || 60}m
                            </div>
                          </div>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Activity Overview Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="px-4 md:px-6 py-3 md:py-4">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                {t('wc_activity_overview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4">
              <div className="mb-4">
                <p className="text-slate-400 text-xs mb-2">{t('wc_this_week')}</p>
                <ResponsiveContainer width="100%" height={isMobile ? 100 : 120}>
                  <ComposedChart data={weekChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#fff' }} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="registrations" stroke="#10b981" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-2">{t('wc_today')}</p>
                <ResponsiveContainer width="100%" height={isMobile ? 100 : 120}>
                  <BarChart data={todayChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: '#fff' }} />
                    <Bar dataKey="duration" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Active Errors */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="px-4 md:px-6 py-3 md:py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                  {t('wc_active_error_reports')}
                </CardTitle>
                <Dialog open={showAddError} onOpenChange={setShowAddError}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="text-xs md:text-sm">
                      {t('wc_add_error')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 text-white border-slate-700 max-w-[95vw] md:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{t('wc_new_error_report')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="errorMessage">{t('wc_error_message')}</Label>
                        <Input id="errorMessage" value={newErrorMessage} onChange={(e) => setNewErrorMessage(e.target.value)} placeholder={t('wc_describe_error')} className="bg-slate-700 border-slate-600 text-white" />
                      </div>
                      <div>
                        <Label htmlFor="errorType">{t('wc_type')}</Label>
                        <select id="errorType" value={newErrorType} onChange={(e) => setNewErrorType(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border-slate-600 text-white">
                          <option value="general">{t('wc_type_general')}</option>
                          <option value="mechanical">{t('wc_type_mechanical')}</option>
                          <option value="electrical">{t('wc_type_electrical')}</option>
                          <option value="software">{t('wc_type_software')}</option>
                          <option value="material">{t('wc_type_material')}</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="errorNotes">{t('wc_notes_optional')}</Label>
                        <Textarea id="errorNotes" value={newErrorNotes} onChange={(e) => setNewErrorNotes(e.target.value)} placeholder={t('wc_extra_info')} className="bg-slate-700 border-slate-600 text-white" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddError} className="flex-1">{t('wc_save')}</Button>
                        <Button variant="outline" onClick={() => setShowAddError(false)} className="flex-1">{t('wc_cancel')}</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4">
              <ScrollArea className={isMobile ? 'max-h-[200px]' : 'h-[250px]'}>
                <div className="space-y-3">
                  {activeErrors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                      <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-green-500 mb-3" />
                      <p className="text-slate-400 text-sm">{t('wc_no_active_errors')}</p>
                    </div>
                  ) : (
                    activeErrors.map((error) => (
                      <Card key={error.id} className="bg-red-900/20 border-red-500/50 p-3 md:p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <Badge variant="destructive" className="text-xs mb-1">{error.error_type}</Badge>
                            <p className="text-white font-medium text-sm">{error.error_message}</p>
                            {error.notes && <p className="text-slate-400 text-xs md:text-sm mt-1 truncate">{error.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-red-500/30">
                          <div className="text-slate-400 text-xs">{format(new Date(error.created_at), 'dd/MM/yyyy HH:mm')}</div>
                          <Button size="sm" variant="outline" onClick={() => handleResolveError(error.id)} className="border-green-500 text-green-500 hover:bg-green-500/10 text-xs">
                            {t('wc_reset')}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Broken Parts */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="px-4 md:px-6 py-3 md:py-4">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                {t('wc_recent_broken_parts')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4">
              <ScrollArea className={isMobile ? 'max-h-[200px]' : 'h-[250px]'}>
                <div className="space-y-3">
                  {brokenParts.length === 0 ? (
                    <p className="text-slate-400 text-sm">{t('wc_no_broken_parts')}</p>
                  ) : (
                    brokenParts.map((part) => (
                      <Card key={part.id} className="bg-slate-700/50 border-slate-600 p-3">
                        <div className="flex gap-3">
                          {part.image_path && (
                            <div className="flex-shrink-0">
                              <img 
                                src={`https://pqzfmphitzlgwnmexrbx.supabase.co/storage/v1/object/public/${part.image_path}`}
                                alt={t('wc_broken_part')}
                                className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover border border-slate-600"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{part.description}</p>
                            <p className="text-slate-400 text-xs mt-1">{t('wc_report')} #{part.id.slice(0, 8)}</p>
                            <div className="flex items-center gap-2 text-slate-400 text-xs mt-2">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(part.created_at), 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Active Users */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="px-4 md:px-6 py-3 md:py-4">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                {t('wc_active_users_tasks')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4">
              <ScrollArea className={isMobile ? 'max-h-[200px]' : 'h-[250px]'}>
                <div className="space-y-3">
                  {workstationStatus?.active_user_names.length === 0 || !workstationStatus ? (
                    <p className="text-slate-400 text-sm">{t('wc_no_active_users')}</p>
                  ) : (
                    workstationStatus.active_user_names.map((userName, index) => {
                      const userTasks = workstationStatus.active_tasks || [];
                      return (
                        <Card key={index} className="bg-slate-700/50 border-slate-600 p-3">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm truncate">{userName}</p>
                              <p className="text-slate-400 text-xs">{t('wc_working_now')}</p>
                            </div>
                            <Activity className="w-4 h-4 text-green-500 animate-pulse flex-shrink-0" />
                          </div>
                          {userTasks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                              <p className="text-slate-400 text-xs mb-1.5">{t('wc_current_tasks_label')}</p>
                              <div className="space-y-1.5">
                                {userTasks.slice(0, 2).map((task: any, taskIndex: number) => (
                                  <div key={taskIndex} className="bg-slate-800/50 rounded p-1.5">
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                      <span className="text-white text-xs flex-1 truncate">{task.title || `Task ${taskIndex + 1}`}</span>
                                    </div>
                                    {task.project_name && <p className="text-slate-400 text-xs ml-5 mt-0.5 truncate">{task.project_name}</p>}
                                  </div>
                                ))}
                                {userTasks.length > 2 && (
                                  <p className="text-slate-400 text-xs ml-5">{t('wc_more', { count: String(userTasks.length - 2) })}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkstationControl;
