import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import InstallationTeamCalendar from '@/components/InstallationTeamCalendar';
import TruckLoadingCalendar from '@/components/TruckLoadingCalendar';
import OrdersGanttChart from '@/components/OrdersGanttChart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
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
  } | null;
  [key: string]: any;
}
const DailyTasks: React.FC = () => {
  const [displayMode, setDisplayMode] = useState<'gantt' | 'teams' | 'trucks'>('gantt');
  const [allProjects, setAllProjects] = useState<ProjectWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
    if (displayMode !== 'gantt') {
      fetchAllProjects();
      setProjectsRefreshKey(prev => prev + 1);
    }
  }, [displayMode]);
  return <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Installation Calendar</h1>
            
            <div className="flex mt-4 md:mt-0 space-x-2">
              <Button variant={displayMode === 'gantt' ? 'default' : 'outline'} onClick={() => setDisplayMode('gantt')}>
                Gantt Chart
              </Button>
              <Button variant={displayMode === 'teams' ? 'default' : 'outline'} onClick={() => setDisplayMode('teams')}>
                Team Planner
              </Button>
              <Button variant={displayMode === 'trucks' ? 'default' : 'outline'} onClick={() => setDisplayMode('trucks')}>
                <Truck className="h-4 w-4 mr-2" />
                Truck Loading
              </Button>
            </div>
          </div>
          
          {displayMode === 'gantt' ? (
            <OrdersGanttChart className="h-[calc(100vh-200px)]" />
          ) : displayMode === 'teams' ? (
            <InstallationTeamCalendar projects={allProjects} key={projectsRefreshKey} />
          ) : (
            <TruckLoadingCalendar />
          )}
        </div>
      </div>
    </div>;
};
export default DailyTasks;