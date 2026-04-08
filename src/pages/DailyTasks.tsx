import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Truck, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import InstallationTeamCalendar from '@/components/InstallationTeamCalendar';
import TruckLoadingCalendar from '@/components/TruckLoadingCalendar';
import OrdersGanttChart from '@/components/OrdersGanttChart';
import ServiceTeamCalendar from '@/components/ServiceTeamCalendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';
interface ProjectWithTeam {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
  team?: string;
  project_team_assignments?: {
    team: string;
    duration: number;
    start_date: string;
  }[] | null;
  [key: string]: any;
}
const DailyTasks: React.FC = () => {
  const [displayMode, setDisplayMode] = useState<'gantt' | 'teams' | 'trucks' | 'service'>('gantt');
  const [allProjects, setAllProjects] = useState<ProjectWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();
  const { tenant } = useTenant();

  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('projects')
        .select(`
          *,
          project_team_assignments!left (
            team,
            duration,
            start_date
          )
        `)
        .not('installation_date', 'is', null)
        .order('installation_date', { ascending: true });
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      
      if (error) throw error;
      setAllProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: `Failed to load projects: ${error.message}`,
        variant: "destructive"
      });
      setAllProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchAllProjects();
  }, [toast, tenant?.id]);

  // Refetch projects when switching display mode (so calendar/trucks get fresh data)
  useEffect(() => {
    if (displayMode !== 'gantt' && displayMode !== 'service') {
      fetchAllProjects();
      setProjectsRefreshKey(prev => prev + 1);
    }
  }, [displayMode]);
  return <div className="flex min-h-screen">
      {!drawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {drawerLayout && <Navbar />}
      <div className={`w-full ${drawerLayout ? 'px-2 py-3 pt-16' : 'p-6 ml-64'}`}>
        <div className="max-w-7xl mx-auto">
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-row items-center justify-between'} mb-4 sm:mb-6`}>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>{t('dt_installation_calendar')}</h1>
            
            <div className={`flex ${isMobile ? 'flex-wrap gap-1.5' : 'space-x-2'}`}>
              <Button
                size={isMobile ? 'sm' : 'default'}
                className={isMobile ? 'flex-1 text-xs px-2' : ''}
                variant={displayMode === 'gantt' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('gantt')}
              >
                {t('dt_gantt_chart')}
              </Button>
              <Button
                size={isMobile ? 'sm' : 'default'}
                className={isMobile ? 'flex-1 text-xs px-2' : ''}
                variant={displayMode === 'teams' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('teams')}
              >
                {t('dt_team_planner')}
              </Button>
              <Button
                size={isMobile ? 'sm' : 'default'}
                className={isMobile ? 'flex-1 text-xs px-2' : ''}
                variant={displayMode === 'trucks' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('trucks')}
              >
                <Truck className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
                {t('dt_truck_loading')}
              </Button>
              <Button
                size={isMobile ? 'sm' : 'default'}
                className={isMobile ? 'flex-1 text-xs px-2' : ''}
                variant={displayMode === 'service' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('service')}
              >
                <Wrench className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
                {t('dt_service_teams')}
              </Button>
            </div>
          </div>
          
          {displayMode === 'gantt' ? (
            <OrdersGanttChart className={isMobile ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-200px)]'} />
          ) : displayMode === 'teams' ? (
            <InstallationTeamCalendar projects={allProjects} key={projectsRefreshKey} />
          ) : displayMode === 'service' ? (
            <ServiceTeamCalendar />
          ) : (
            <TruckLoadingCalendar />
          )}
        </div>
      </div>
    </div>;
};
export default DailyTasks;