import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Truck, Calendar, ArrowLeft, Users, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isWeekend, differenceInDays, startOfDay } from 'date-fns';
import { holidayService } from '@/services/holidayService';

interface PlacementTeam {
  id: string;
  name: string;
  color: string | null;
}

interface LoadingAssignment {
  project: {
    id: string;
    name: string;
    client: string;
    status: string;
    installation_date: string;
    progress?: number;
  };
  loading_date: string;
  truck?: { id: string; name: string } | null;
  team?: { id: string; name: string; color?: string | null } | null;
}

const TruckLoadingView: React.FC = () => {
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [truckLoadingData, setTruckLoadingData] = useState<{
    todayLoadings: LoadingAssignment[];
    upcomingLoadings: LoadingAssignment[];
    daysToNext: number;
  }>({
    todayLoadings: [],
    upcomingLoadings: [],
    daysToNext: 0
  });

  useEffect(() => {
    loadTruckLoadingData();
    const interval = setInterval(loadTruckLoadingData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadTruckLoadingData = async () => {
    try {
      const holidays = await holidayService.getHolidays();
      
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

      const { data: overridesData } = await supabase
        .from('project_loading_overrides')
        .select('project_id, override_loading_date');
      
      const overridesMap: Record<string, string> = {};
      (overridesData || []).forEach(override => {
        overridesMap[override.project_id] = override.override_loading_date;
      });

      // Fetch projects with progress (projects table already has progress field)
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client, status, installation_date, progress')
        .not('installation_date', 'is', null)
        .gte('installation_date', format(new Date(), 'yyyy-MM-dd'))
        .order('installation_date');

      // Fetch truck assignments
      const { data: truckAssignments } = await supabase
        .from('project_truck_assignments')
        .select('project_id, truck_id, trucks(id, name)');

      const truckMap: Record<string, { id: string; name: string }> = {};
      (truckAssignments || []).forEach((ta: any) => {
        if (ta.trucks) {
          truckMap[ta.project_id] = { id: ta.trucks.id, name: ta.trucks.name };
        }
      });

      // Fetch team assignments with color
      const { data: teamAssignments } = await supabase
        .from('project_team_assignments')
        .select('project_id, team_id, placement_teams(id, name, color)');

      const teamMap: Record<string, { id: string; name: string; color?: string | null }> = {};
      (teamAssignments || []).forEach((ta: any) => {
        if (ta.placement_teams) {
          teamMap[ta.project_id] = { id: ta.placement_teams.id, name: ta.placement_teams.name, color: ta.placement_teams.color };
        }
      });

      const loadingAssignments: LoadingAssignment[] = (projectsData || []).map(project => {
        const installationDate = new Date(project.installation_date);
        const calculatedLoadingDate = getPreviousWorkday(installationDate);
        const loadingDate = overridesMap[project.id] || format(calculatedLoadingDate, 'yyyy-MM-dd');
        
        return {
          project: {
            ...project,
            progress: project.progress || 0
          },
          loading_date: loadingDate,
          truck: truckMap[project.id] || null,
          team: teamMap[project.id] || null
        };
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
        .slice(0, 12);

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

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 hide-task-timer">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-8 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Truck Loading</h1>
              <p className="text-slate-400 text-xs">Installation & Loading Schedule</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/control-panel'))}
            className="text-white border-slate-600 bg-transparent hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Control Panel
          </Button>
        </div>
      </div>

      {/* Main Content - No Scroll */}
      <div className="flex-1 flex flex-col px-6 py-4 overflow-hidden">
        {/* Loading Today - Main Focus (larger section) */}
        <div className="flex-[2] min-h-0 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Truck className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Loading Today</h2>
          </div>

          {truckLoadingData.todayLoadings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-[calc(100%-2.5rem)] overflow-hidden">
              {truckLoadingData.todayLoadings.map((loading) => (
                <Card 
                  key={loading.project.id}
                  className="border p-4 cursor-pointer hover:opacity-90 transition-colors flex flex-col"
                  style={{
                    backgroundColor: loading.team?.color 
                      ? `${loading.team.color}25` 
                      : 'rgba(249, 115, 22, 0.1)',
                    borderColor: loading.team?.color 
                      ? `${loading.team.color}50` 
                      : 'rgba(249, 115, 22, 0.3)',
                  }}
                  onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-lg truncate">{loading.project.name}</p>
                      <p className="text-slate-400 text-sm truncate">{loading.project.client}</p>
                    </div>
                    <Badge className="bg-orange-500 text-white flex-shrink-0">Today</Badge>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Progress</span>
                      <span className="text-xs font-semibold text-white">{loading.project.progress}%</span>
                    </div>
                    <Progress value={loading.project.progress} className="h-2" />
                  </div>

                  {/* Truck & Team */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-white">
                        {loading.truck ? loading.truck.name : <span className="text-slate-500 italic">No truck assigned</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-white">
                        {loading.team ? loading.team.name : <span className="text-slate-500 italic">No team assigned</span>}
                      </span>
                    </div>
                  </div>

                  {/* Installation Date */}
                  <div className="mt-3 pt-3 border-t border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-300">
                        Install: {format(new Date(loading.project.installation_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700 h-[calc(100%-2.5rem)] flex items-center justify-center">
              <div className="text-center">
                <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-lg">
                  {truckLoadingData.daysToNext > 0 
                    ? `Next loading in ${truckLoadingData.daysToNext} day${truckLoadingData.daysToNext > 1 ? 's' : ''}`
                    : 'No loadings scheduled today'}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Upcoming Installations - Smaller tiles */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <h2 className="text-sm font-bold text-white">Upcoming (Next 7 Days)</h2>
          </div>

          {truckLoadingData.upcomingLoadings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 h-[calc(100%-2rem)] overflow-hidden">
              {truckLoadingData.upcomingLoadings.map((loading) => (
                <Card 
                  key={loading.project.id}
                  className="border p-2.5 cursor-pointer hover:opacity-80 transition-colors flex flex-col"
                  style={{
                    backgroundColor: loading.team?.color 
                      ? `${loading.team.color}20` 
                      : 'rgba(51, 65, 85, 0.3)',
                    borderColor: loading.team?.color 
                      ? `${loading.team.color}40` 
                      : 'rgba(71, 85, 105, 1)',
                  }}
                  onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                >
                  <p className="text-white font-semibold text-xs truncate mb-1">{loading.project.name}</p>
                  <p className="text-slate-500 text-[10px] truncate mb-2">{loading.project.client}</p>
                  <div className="mt-auto flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Load</span>
                    <span className="text-white font-medium">{format(new Date(loading.loading_date), 'MMM d')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Install</span>
                    <span className="text-blue-400 font-medium">{format(new Date(loading.project.installation_date), 'MMM d')}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-[calc(100%-2rem)] flex items-center justify-center">
              <p className="text-slate-500 text-sm">No upcoming installations</p>
            </div>
          )}
        </div>
      </div>

      {/* CSS to hide TaskTimer on this page */}
      <style>{`
        .hide-task-timer ~ div[class*="fixed"] {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default TruckLoadingView;
