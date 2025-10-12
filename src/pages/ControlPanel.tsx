import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { ArrowRight, Activity, AlertCircle, CheckCircle2, Clock, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);

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
  };

  const getWorkstationStatus = (workstationId: string) => {
    return workstationStatuses.find(s => s.workstation_id === workstationId);
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

  const totalActive = workstationStatuses.filter(s => s.is_active && s.active_users_count > 0).length;
  const totalErrors = workstationStatuses.filter(s => s.has_error).length;
  const totalUsers = workstationStatuses.reduce((sum, s) => sum + s.active_users_count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t('control_panel')}</h1>
            <p className="text-slate-400">Production Overview & Monitoring</p>
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
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Activity className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active Machines</p>
                <p className="text-3xl font-bold text-white">{totalActive}</p>
              </div>
            </div>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active Workers</p>
                <p className="text-3xl font-bold text-white">{totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Machines</p>
                <p className="text-3xl font-bold text-white">{workstations.length}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Errors</p>
                <p className="text-3xl font-bold text-white">{totalErrors}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Production Flow */}
        <Card className="bg-slate-800/50 border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Production Flow</h2>
          
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {workstations.map((workstation, index) => {
              const status = getWorkstationStatus(workstation.id);
              const statusColor = getStatusColor(status);
              const statusText = getStatusText(status);
              
              return (
                <React.Fragment key={workstation.id}>
                  <button
                    onClick={() => navigate(createLocalizedPath(`/control-panel/${workstation.id}`))}
                    className="group relative"
                  >
                    <Card 
                      className={`
                        w-48 h-32 border-2 transition-all duration-300
                        ${statusColor === 'bg-green-500' ? 'border-green-500 bg-green-500/20' : ''}
                        ${statusColor === 'bg-yellow-500' ? 'border-yellow-500 bg-yellow-500/20' : ''}
                        ${statusColor === 'bg-red-500' ? 'border-red-500 bg-red-500/20' : ''}
                        ${statusColor === 'bg-gray-400' ? 'border-slate-600 bg-slate-700/50' : ''}
                        hover:scale-105 hover:shadow-xl cursor-pointer
                      `}
                    >
                      <div className="p-4 h-full flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                          <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`} />
                          {status && status.active_users_count > 0 && (
                            <Badge variant="secondary" className="bg-slate-900/50 text-white text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {status.active_users_count}
                            </Badge>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="text-white font-bold text-lg mb-1">{workstation.name}</h3>
                          <p className="text-slate-400 text-sm">{statusText}</p>
                        </div>

                        {status && status.active_tasks.length > 0 && (
                          <div className="text-xs text-slate-400">
                            {status.active_tasks.length} tasks
                          </div>
                        )}
                      </div>
                    </Card>
                    
                    {status?.has_error && (
                      <div className="absolute -top-2 -right-2">
                        <AlertCircle className="w-6 h-6 text-red-500 animate-pulse" />
                      </div>
                    )}
                  </button>
                  
                  {index < workstations.length - 1 && (
                    <ArrowRight className="w-8 h-8 text-slate-600 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-8 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-slate-400">Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-slate-400">Idle</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
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
