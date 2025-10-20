import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, Calendar, ArrowLeft } from 'lucide-react';
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
        
        return {
          project,
          loading_date: loadingDate
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
        .slice(0, 10);

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
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-slate-900/50 border-b border-slate-700 px-8 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(createLocalizedPath('/control-panel'))}
              className="text-white border-slate-600 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Truck Loading</h1>
              <p className="text-slate-400 text-sm">Installation & Loading Schedule</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {truckLoadingData.todayLoadings.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Truck className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Loading Today</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {truckLoadingData.todayLoadings.map((loading) => (
                <Card 
                  key={loading.project.id}
                  className="bg-orange-500/10 border-orange-500/30 p-4 cursor-pointer hover:bg-orange-500/20 transition-colors"
                  onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-base truncate">{loading.project.name}</p>
                      <p className="text-slate-400 text-sm truncate">{loading.project.client}</p>
                      <div className="flex items-center gap-2 mt-2">
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
          </Card>
        )}

        {truckLoadingData.todayLoadings.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Truck className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Loading Today</h2>
            </div>
            <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
              <p className="text-slate-400">
                {truckLoadingData.daysToNext > 0 
                  ? `Next loading in ${truckLoadingData.daysToNext} day${truckLoadingData.daysToNext > 1 ? 's' : ''}`
                  : 'No loadings scheduled today'}
              </p>
            </div>
          </Card>
        )}

        {truckLoadingData.upcomingLoadings.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Upcoming Installations (Next 7 Days)</h2>
            </div>
            <div className="space-y-3">
              {truckLoadingData.upcomingLoadings.map((loading) => (
                <Card 
                  key={loading.project.id}
                  className="bg-slate-700/30 border-slate-600 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => navigate(createLocalizedPath(`/projects/${loading.project.id}`))}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-base truncate">{loading.project.name}</p>
                      <p className="text-slate-400 text-sm truncate">{loading.project.client}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Loading</p>
                        <p className="text-white font-semibold">
                          {format(new Date(loading.loading_date), 'MMM d')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Install</p>
                        <p className="text-white font-semibold">
                          {format(new Date(loading.project.installation_date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {truckLoadingData.todayLoadings.length === 0 && truckLoadingData.upcomingLoadings.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-12">
            <div className="text-center">
              <Truck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No upcoming installations scheduled</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TruckLoadingView;
