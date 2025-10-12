import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationStatus } from '@/services/floorplanService';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Activity, AlertTriangle, CheckCircle2, Clock, Users, Package, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const WorkstationControl: React.FC = () => {
  const { workstationId } = useParams<{ workstationId: string }>();
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [workstationStatus, setWorkstationStatus] = useState<WorkstationStatus | null>(null);
  const [timeRegistrations, setTimeRegistrations] = useState<any[]>([]);
  const [brokenParts, setBrokenParts] = useState<any[]>([]);
  const [currentTasks, setCurrentTasks] = useState<any[]>([]);

  const { data: workstation } = useQuery({
    queryKey: ['workstation', workstationId],
    queryFn: () => workstationService.getById(workstationId!),
    enabled: !!workstationId
  });

  useEffect(() => {
    if (!workstationId) return;

    loadWorkstationData();
    
    const statusInterval = setInterval(loadWorkstationData, 30000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [workstationId]);

  const loadWorkstationData = async () => {
    if (!workstationId) return;

    try {
      // Get workstation status
      const statuses = await floorplanService.getWorkstationStatuses();
      const status = statuses.find(s => s.workstation_id === workstationId);
      setWorkstationStatus(status || null);

      // Get time registrations for today
      const today = new Date().toISOString().split('T')[0];
      
      // @ts-expect-error - Supabase type inference issue
      const timeRegistrationsQuery = supabase
        .from('time_registrations')
        .select('*')
        .eq('workstation_id', workstationId)
        .gte('start_time', `${today}T00:00:00`)
        .order('start_time', { ascending: false });
      
      const timeResult = await timeRegistrationsQuery;
      if (timeResult.data) setTimeRegistrations(timeResult.data);

      // Get broken parts
      const brokenPartsQuery = supabase
        .from('broken_parts')
        .select('*')
        .eq('workstation_id', workstationId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const brokenResult = await brokenPartsQuery;
      if (brokenResult.data) setBrokenParts(brokenResult.data);

      // Get current tasks
      // @ts-expect-error - Supabase type inference issue
      const currentTasksQuery = supabase
        .from('tasks')
        .select('*')
        .eq('workstation_id', workstationId);
      
      const tasksInProgressQuery = currentTasksQuery.in('status', ['IN_PROGRESS', 'TODO']);
      const tasksOrderedQuery = tasksInProgressQuery.order('created_at', { ascending: true });
      const tasksResult = await tasksOrderedQuery;
      if (tasksResult.data) setCurrentTasks(tasksResult.data);

    } catch (error) {
      console.error('Error loading workstation data:', error);
    }
  };

  const getStatusColor = () => {
    if (!workstationStatus) return 'bg-gray-400';
    if (workstationStatus.has_error) return 'bg-red-500';
    if (workstationStatus.is_active && workstationStatus.active_users_count > 0) return 'bg-green-500';
    if (workstationStatus.is_active) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (!workstationStatus) return 'Unknown';
    if (workstationStatus.has_error) return 'Error';
    if (workstationStatus.is_active && workstationStatus.active_users_count > 0) return 'Active - Running';
    if (workstationStatus.is_active) return 'Ready - Idle';
    return 'Idle';
  };

  // Prepare chart data for time registrations
  const chartData = timeRegistrations.slice(0, 10).map(reg => {
    const duration = reg.end_time 
      ? (new Date(reg.end_time).getTime() - new Date(reg.start_time).getTime()) / (1000 * 60)
      : (new Date().getTime() - new Date(reg.start_time).getTime()) / (1000 * 60);
    
    return {
      time: format(new Date(reg.start_time), 'HH:mm'),
      duration: Math.round(duration),
      user: 'Worker'
    };
  });

  if (!workstation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/control-panel'))}
            className="text-white border-slate-600 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Overview
          </Button>
          
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getStatusColor()} animate-pulse`} />
            <Badge 
              variant="outline" 
              className={`text-lg px-4 py-2 ${
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
        
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">{workstation.name}</h1>
          {workstation.description && (
            <p className="text-slate-400">{workstation.description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active Workers</p>
                <p className="text-3xl font-bold text-white">
                  {workstationStatus?.active_users_count || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Package className="w-8 h-8 text-purple-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Current Tasks</p>
                <p className="text-3xl font-bold text-white">
                  {workstationStatus?.active_tasks.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Capacity</p>
                <p className="text-3xl font-bold text-white">
                  {workstation.active_workers || 1}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Broken Parts</p>
                <p className="text-3xl font-bold text-white">{brokenParts.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Open Tasks */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="w-5 h-5" />
                Open Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {currentTasks.length === 0 ? (
                    <p className="text-slate-400 text-sm">No open tasks</p>
                  ) : (
                    currentTasks.map((task) => (
                      <Card key={task.id} className="bg-slate-700/50 border-slate-600 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{task.name}</h4>
                            <p className="text-slate-400 text-sm">Task #{task.id.slice(0, 8)}</p>
                          </div>
                          <Badge 
                            variant={task.status === 'IN_PROGRESS' ? 'default' : 'secondary'}
                            className="ml-2"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        {task.estimated_duration && (
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Clock className="w-4 h-4" />
                            {task.estimated_duration} min
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Time Registration Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Today's Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="duration" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Broken Parts */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Recent Broken Parts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {brokenParts.length === 0 ? (
                    <p className="text-slate-400 text-sm">No broken parts reported</p>
                  ) : (
                    brokenParts.map((part) => (
                      <Card key={part.id} className="bg-slate-700/50 border-slate-600 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-white text-sm">{part.description}</p>
                            <p className="text-slate-400 text-xs mt-1">
                              Report #{part.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs mt-2">
                          <span>{format(new Date(part.created_at), 'dd/MM/yyyy HH:mm')}</span>
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
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {workstationStatus?.active_user_names.length === 0 || !workstationStatus ? (
                    <p className="text-slate-400 text-sm">No active users</p>
                  ) : (
                    workstationStatus.active_user_names.map((userName, index) => (
                      <Card key={index} className="bg-slate-700/50 border-slate-600 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{userName}</p>
                            <p className="text-slate-400 text-xs">Working now</p>
                          </div>
                        </div>
                      </Card>
                    ))
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
