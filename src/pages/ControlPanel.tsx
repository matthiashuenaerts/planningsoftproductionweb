import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { workstationErrorService } from '@/services/workstationErrorService';
import { ArrowRight, Activity, AlertCircle, CheckCircle2, Clock, Users, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);
  const [workstationErrors, setWorkstationErrors] = useState<Record<string, number>>({});
  const [workstationBufferTimes, setWorkstationBufferTimes] = useState<Record<string, number>>({});

  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations'],
    queryFn: workstationService.getAll
  });

  useEffect(() => {
    loadStatuses();
    
    const statusesChannel = floorplanService.subscribeToTimeRegistrations(setWorkstationStatuses);
    const statusInterval = setInterval(loadStatuses, 30000);

    return () => {
      statusesChannel.unsubscribe();
      clearInterval(statusInterval);
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
                  {/* Show buffer before workstation (except for first one) */}
                  {index > 0 && (
                    <div className="flex flex-col items-center gap-1.5">
                      <ArrowRight className="w-6 h-6 text-slate-600 flex-shrink-0" />
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
      </div>
    </div>
  );
};

export default ControlPanel;
