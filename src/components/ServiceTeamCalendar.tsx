import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Route, Loader2, Map, Plus, X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import RouteMapDialog, { type RouteWaypoint } from '@/components/service/RouteMapDialog';
import { workingHoursService, type WorkingHours } from '@/services/workingHoursService';

interface ServiceTeam {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  start_street?: string;
  start_number?: string;
  start_postal_code?: string;
  start_city?: string;
}

interface ServiceProject {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  progress: number;
  address_street?: string;
  address_number?: string;
  address_postal_code?: string;
  address_city?: string;
}

interface ServiceAssignment {
  id: string;
  project_id: string;
  team: string;
  team_id?: string;
  start_date: string | null;
  duration: number;
  service_hours?: number;
  service_order?: number;
  service_possible_week?: string;
  service_notes?: string;
}

const ServiceTeamCalendar: React.FC = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [serviceTeams, setServiceTeams] = useState<ServiceTeam[]>([]);
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [assignProjectId, setAssignProjectId] = useState<string>('');
  const [assignHours, setAssignHours] = useState<number>(2);
  const [assignDescription, setAssignDescription] = useState('');
  const [assignTodos, setAssignTodos] = useState<string[]>(['']);
  const [optimizing, setOptimizing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapWaypoints, setMapWaypoints] = useState<RouteWaypoint[]>([]);
  const [mapRouteGeometry, setMapRouteGeometry] = useState<[number, number][]>([]);
  const [mapStartPoint, setMapStartPoint] = useState<{ lat: number; lng: number; address: string } | undefined>();
  const [mapTeamName, setMapTeamName] = useState('');
  const [mapDateLabel, setMapDateLabel] = useState('');
  // Track which team+date combos have been optimized so we can show "Show on Map"
  const [optimizedRoutes, setOptimizedRoutes] = useState<Record<string, {
    waypoints: RouteWaypoint[];
    geometry: [number, number][];
    startPoint?: { lat: number; lng: number; address: string };
    totalDrivingMinutes?: number;
    unrecognizedAddresses?: string[];
    departureTime?: string;
    workStartTime?: string;
    workEndTime?: string;
  }>>({});

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6); // weekdays only

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load service teams
      let teamsQuery = (supabase
        .from('placement_teams')
        .select('*') as any)
        .eq('team_type', 'service')
        .eq('is_active', true)
        .order('name');
      teamsQuery = applyTenantFilter(teamsQuery, tenant?.id);
      const { data: teamsData } = await teamsQuery;
      setServiceTeams((teamsData as any) || []);

      // Load projects with addresses
      let projQuery = supabase
        .from('projects')
        .select(`*, project_team_assignments!left(*)`)
        .not('installation_date', 'is', null)
        .order('installation_date');
      projQuery = applyTenantFilter(projQuery, tenant?.id);
      const { data: projData } = await projQuery;
      setProjects((projData as any) || []);

      // Load assignments for service teams
      if (teamsData && teamsData.length > 0) {
        const teamIds = teamsData.map((t: any) => t.id);
        const { data: assignData } = await supabase
          .from('project_team_assignments')
          .select('*')
          .in('team_id', teamIds);
        setAssignments((assignData as any) || []);
      }
    } catch (error: any) {
      console.error('Error loading service calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const getProjectsForTeamAndDate = (teamId: string, dateStr: string) => {
    return assignments
      .filter(a => a.team_id === teamId && a.start_date === dateStr)
      .sort((a, b) => (a.service_order || 0) - (b.service_order || 0))
      .map(a => {
        const project = projects.find(p => p.id === a.project_id);
        return project ? { ...project, assignment: a } : null;
      })
      .filter(Boolean) as (ServiceProject & { assignment: ServiceAssignment })[];
  };

  const getProjectAddress = (project: ServiceProject) => {
    const parts = [project.address_street, project.address_number, project.address_postal_code, project.address_city].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : t('svc_no_address');
  };

  const handleAssignProject = async () => {
    if (!assignProjectId || !selectedTeamId || !selectedDate) return;
    try {
      const team = serviceTeams.find(t => t.id === selectedTeamId);
      const existingForDay = getProjectsForTeamAndDate(selectedTeamId, selectedDate);

      // Build notes from description + todos
      const todoLines = assignTodos.filter(t => t.trim()).map(t => `☐ ${t.trim()}`);
      const notes = [assignDescription, todoLines.length > 0 ? '\nTodos:\n' + todoLines.join('\n') : ''].filter(Boolean).join('\n');

      const { error } = await supabase
        .from('project_team_assignments')
        .insert({
          project_id: assignProjectId,
          team_id: selectedTeamId,
          team: team?.name || '',
          start_date: selectedDate,
          duration: 1,
          service_hours: assignHours,
          service_order: existingForDay.length + 1,
          service_notes: notes.trim() || null,
        } as any);

      if (error) throw error;

      // Post to project chat for record-keeping
      const project = projects.find(p => p.id === assignProjectId);
      if (notes.trim()) {
        const { data: empData } = await supabase.from('employees').select('id').limit(1).single();
        if (empData) {
          await supabase.from('chat_messages').insert({
            chat_room_id: assignProjectId,
            employee_id: empData.id,
            message: `${t('svc_service_visit_chat', { date: format(new Date(selectedDate + 'T12:00:00'), 'dd/MM/yyyy'), team: team?.name || 'Service' })}\n${notes}`,
          } as any);
        }
      }

      toast({ title: t('svc_success'), description: t('svc_service_scheduled', { project: project?.name || 'project', date: format(new Date(selectedDate + 'T12:00:00'), 'dd/MM/yyyy') }) });
      setIsAssignDialogOpen(false);
      setAssignDescription('');
      setAssignTodos(['']);
      setAssignProjectId('');
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    }
  };

  // Geocode an address using Nominatim
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'User-Agent': 'ServiceCalendarApp/1.0' } }
      );
      const data = await resp.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleOptimizeRoute = async (teamId: string, dateStr: string) => {
    setOptimizing(true);
    try {
      const team = serviceTeams.find(t => t.id === teamId);
      const dayProjects = getProjectsForTeamAndDate(teamId, dateStr);
      
      if (dayProjects.length < 2) {
        toast({ title: t('svc_info'), description: t('svc_need_min_2') });
        setOptimizing(false);
        return;
      }

      // Fetch installation working hours for this day
      const targetDate = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat
      const allWorkingHours = await workingHoursService.getWorkingHours(tenant?.id);
      const installationHours = workingHoursService.getWorkingHoursForDay(allWorkingHours, 'installation', dayOfWeek);
      
      const workStartTime = installationHours?.start_time || '08:00';
      const workEndTime = installationHours?.end_time || '17:00';

      // Geocode team start address
      const teamStartAddress = [team?.start_street, team?.start_number, team?.start_postal_code, team?.start_city].filter(Boolean).join(' ');
      const startCoords = teamStartAddress ? await geocodeAddress(teamStartAddress) : null;

      // Geocode all project addresses
      const geocodedProjects = await Promise.all(
        dayProjects.map(async (p) => {
          const addr = getProjectAddress(p);
          const coords = addr !== t('svc_no_address') ? await geocodeAddress(addr) : null;
          return { ...p, coords, fullAddress: addr };
        })
      );

      const projectsWithCoords = geocodedProjects.filter(p => p.coords !== null);
      const unrecognizedAddresses = geocodedProjects
        .filter(p => p.coords === null && p.fullAddress !== t('svc_no_address'))
        .map(p => `${p.name}: ${p.fullAddress}`);
      geocodedProjects
        .filter(p => p.fullAddress === t('svc_no_address'))
        .forEach(p => unrecognizedAddresses.push(`${p.name}: ${t('svc_no_address_set')}`));
      
      if (projectsWithCoords.length < 2) {
        toast({ title: t('svc_warning'), description: t('svc_geocode_fallback') });
        await fallbackPostalOptimize(team, dayProjects, teamId, dateStr);
        return;
      }

      // Build OSRM coordinates string: start + all projects + start again (return home)
      const coordinates: string[] = [];
      if (startCoords) {
        coordinates.push(`${startCoords.lng},${startCoords.lat}`);
      }
      projectsWithCoords.forEach(p => {
        coordinates.push(`${p.coords!.lng},${p.coords!.lat}`);
      });
      if (startCoords) {
        coordinates.push(`${startCoords.lng},${startCoords.lat}`);
      }

      // Use OSRM Trip API - roundtrip with source=first and destination=last (return home)
      const sourceParam = startCoords ? '&source=first&destination=last' : '';
      const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordinates.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration${sourceParam}&roundtrip=false`;
      
      const osrmResp = await fetch(osrmUrl);
      const osrmData = await osrmResp.json();

      if (osrmData.code !== 'Ok' || !osrmData.trips || osrmData.trips.length === 0) {
        toast({ title: t('svc_warning'), description: t('svc_route_unavailable') });
        await fallbackPostalOptimize(team, dayProjects, teamId, dateStr);
        return;
      }

      const trip = osrmData.trips[0];
      const waypointOrder = osrmData.waypoints.map((wp: any) => wp.waypoint_index);
      
      // Map OSRM waypoint order back to projects
      const offset = startCoords ? 1 : 0;
      const endOffset = startCoords ? 1 : 0;
      const projectWaypoints = waypointOrder.slice(offset, waypointOrder.length - endOffset);
      const orderedProjects = projectWaypoints
        .map((wpIdx: number) => {
          const projectIdx = wpIdx - offset;
          return projectsWithCoords[projectIdx];
        })
        .filter(Boolean);

      // Update service_order in DB
      for (let i = 0; i < orderedProjects.length; i++) {
        await supabase
          .from('project_team_assignments')
          .update({ service_order: i + 1 } as any)
          .eq('id', orderedProjects[i].assignment.id);
      }

      // Extract leg durations from the trip
      const legDurations: number[] = trip.legs?.map((leg: any) => (leg.duration || 0) / 60) || [];

      // Calculate departure time based on working hours
      // The team needs to arrive at the first stop by workStartTime
      // So departure = workStartTime - driving time to first stop
      const firstLegMinutes = legDurations.length > 0 ? legDurations[0] : 0;
      const [workStartH, workStartM] = workStartTime.split(':').map(Number);
      const workStartTotalMin = workStartH * 60 + workStartM;
      const departureTotalMin = Math.max(0, workStartTotalMin - Math.ceil(firstLegMinutes));
      const departureH = Math.floor(departureTotalMin / 60);
      const departureM = departureTotalMin % 60;
      const departureTimeStr = `${String(departureH).padStart(2, '0')}:${String(departureM).padStart(2, '0')}`;

      // Calculate estimated arrival and departure times for each stop
      let currentTimeMin = workStartTotalMin; // Arrive at first stop at work start
      const mapWps: RouteWaypoint[] = orderedProjects.map((p: any, i: number) => {
        const arrivalMin = currentTimeMin;
        const serviceMin = (p.assignment.service_hours || 0) * 60;
        const departureMin = arrivalMin + serviceMin;
        
        const arrivalH = Math.floor(arrivalMin / 60);
        const arrivalM = arrivalMin % 60;
        const depH = Math.floor(departureMin / 60);
        const depM = departureMin % 60;

        const wp: RouteWaypoint = {
          name: p.name,
          client: p.client,
          address: p.fullAddress,
          lat: p.coords!.lat,
          lng: p.coords!.lng,
          order: i + 1,
          serviceHours: p.assignment.service_hours,
          estimatedArrival: `${String(arrivalH).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}`,
          estimatedDeparture: `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`,
        };

        // Next stop: departure from this stop + driving to next stop
        // legDurations[0] = start->stop1, legDurations[1] = stop1->stop2, etc.
        const nextLegIdx = i + 1; // leg from this stop to next
        const drivingToNext = nextLegIdx < legDurations.length ? legDurations[nextLegIdx] : 0;
        currentTimeMin = departureMin + Math.ceil(drivingToNext);

        return wp;
      });

      // Calculate return time
      const returnLegIdx = legDurations.length - 1;
      const lastStopDepartureMin = mapWps.length > 0 
        ? (() => {
            const lastWp = mapWps[mapWps.length - 1];
            const [h, m] = lastWp.estimatedDeparture!.split(':').map(Number);
            return h * 60 + m;
          })()
        : workStartTotalMin;
      const returnDrivingMin = returnLegIdx >= 0 ? legDurations[returnLegIdx] : 0;
      const returnTotalMin = lastStopDepartureMin + Math.ceil(returnDrivingMin);
      const returnH = Math.floor(returnTotalMin / 60);
      const returnM = returnTotalMin % 60;
      const returnTimeStr = `${String(returnH).padStart(2, '0')}:${String(returnM).padStart(2, '0')}`;

      // Build route geometry
      const routeGeometry: [number, number][] = trip.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );

      const routeKey = `${teamId}_${dateStr}`;
      const startPt = startCoords ? { ...startCoords, address: teamStartAddress } : undefined;
      const totalDrivingMinutes = trip.duration ? trip.duration / 60 : undefined;
      
      setOptimizedRoutes(prev => ({
        ...prev,
        [routeKey]: {
          waypoints: mapWps,
          geometry: routeGeometry,
          startPoint: startPt,
          totalDrivingMinutes,
          unrecognizedAddresses,
          departureTime: departureTimeStr,
          workStartTime,
          workEndTime,
        }
      }));

      // Check if the total day exceeds working hours
      const [workEndH, workEndM] = workEndTime.split(':').map(Number);
      const workEndTotalMin = workEndH * 60 + workEndM;
      const overtime = returnTotalMin > workEndTotalMin;
      const overtimeMsg = overtime 
        ? ` ${t('svc_return_exceeds', { returnTime: returnTimeStr, endTime: workEndTime })}` 
        : ` ${t('svc_return_by', { time: returnTimeStr })}`;

      const warningMsg = unrecognizedAddresses.length > 0 
        ? ` (${t('svc_addresses_not_recognized', { count: String(unrecognizedAddresses.length) })})` 
        : '';
      toast({ 
        title: t('svc_route_optimized'), 
        description: `${t('svc_depart_stops', { time: departureTimeStr, count: String(orderedProjects.length) })}${overtimeMsg}${warningMsg}`,
        variant: overtime ? 'destructive' : 'default',
      });
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    } finally {
      setOptimizing(false);
    }
  };

  // Fallback: postal code nearest-neighbor (original logic)
  const fallbackPostalOptimize = async (
    team: ServiceTeam | undefined,
    dayProjects: (ServiceProject & { assignment: ServiceAssignment })[],
    teamId: string,
    dateStr: string
  ) => {
    const projectsWithAddr = dayProjects.map(p => ({
      ...p,
      postalNum: parseInt(p.address_postal_code || '0') || 0
    }));
    const startPostal = parseInt(team?.start_postal_code || '0') || 0;
    const sorted: typeof projectsWithAddr = [];
    const remaining = [...projectsWithAddr];
    let currentPostal = startPostal;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Math.abs(remaining[0].postalNum - currentPostal);
      for (let i = 1; i < remaining.length; i++) {
        const dist = Math.abs(remaining[i].postalNum - currentPostal);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
      sorted.push(remaining[nearestIdx]);
      currentPostal = remaining[nearestIdx].postalNum;
      remaining.splice(nearestIdx, 1);
    }

    for (let i = 0; i < sorted.length; i++) {
      await supabase
        .from('project_team_assignments')
        .update({ service_order: i + 1 } as any)
        .eq('id', sorted[i].assignment.id);
    }

    toast({ title: t('svc_route_optimized'), description: t('svc_optimized_postal', { count: String(sorted.length) }) });
    loadData();
  };

  const [mapDrivingMinutes, setMapDrivingMinutes] = useState<number | undefined>();
  const [mapUnrecognized, setMapUnrecognized] = useState<string[]>([]);
  const [mapDepartureTime, setMapDepartureTime] = useState<string | undefined>();
  const [mapWorkStartTime, setMapWorkStartTime] = useState<string | undefined>();
  const [mapWorkEndTime, setMapWorkEndTime] = useState<string | undefined>();

  const handleShowMap = (teamId: string, dateStr: string, teamName: string) => {
    const routeKey = `${teamId}_${dateStr}`;
    const route = optimizedRoutes[routeKey];
    if (!route) return;
    
    setMapWaypoints(route.waypoints);
    setMapRouteGeometry(route.geometry);
    setMapStartPoint(route.startPoint);
    setMapDrivingMinutes(route.totalDrivingMinutes);
    setMapUnrecognized(route.unrecognizedAddresses || []);
    setMapDepartureTime(route.departureTime);
    setMapWorkStartTime(route.workStartTime);
    setMapWorkEndTime(route.workEndTime);
    setMapTeamName(teamName);
    setMapDateLabel(format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMM d yyyy'));
    setMapOpen(true);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('project_team_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateHours = async (assignmentId: string, hours: number) => {
    try {
      const { error } = await supabase
        .from('project_team_assignments')
        .update({ service_hours: hours } as any)
        .eq('id', assignmentId);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    }
  };

  // Get unassigned projects for a given date (projects with installation_date matching)
  const getUnassignedProjects = (dateStr: string) => {
    const assignedProjectIds = assignments
      .filter(a => a.start_date === dateStr)
      .map(a => a.project_id);
    return projects.filter(p => 
      p.installation_date === dateStr && 
      !assignedProjectIds.includes(p.id)
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (serviceTeams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('svc_no_service_teams')}</h3>
          <p className="text-muted-foreground">{t('svc_create_teams_hint')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", isMobile && "space-y-3")}>
      {/* Week Navigation */}
      <div className={cn("flex items-center", isMobile ? "flex-col gap-2" : "justify-between")}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className={isMobile ? "h-7 w-7 p-0" : ""} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className={isMobile ? "h-7 text-xs px-2" : ""} onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            <Calendar className="h-4 w-4 mr-1" /> {t('svc_today')}
          </Button>
          <Button variant="outline" size="sm" className={isMobile ? "h-7 w-7 p-0" : ""} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className={cn("font-medium text-muted-foreground", isMobile ? "text-xs ml-1" : "text-sm ml-2")}>
            {format(weekDays[0], 'MMM d')} - {format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      {/* Service Teams Grid */}
      {serviceTeams.map(team => {
        const teamStartAddr = [team.start_street, team.start_number, team.start_postal_code, team.start_city].filter(Boolean).join(', ');
        
        return (
          <Card key={team.id}>
            <CardHeader className={cn("pb-3", isMobile && "p-3 pb-2")}>
              <div className={cn("flex items-center", isMobile ? "flex-col gap-1 items-start" : "justify-between")}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border shrink-0" style={{ backgroundColor: team.color }} />
                  <CardTitle className={isMobile ? "text-sm" : "text-lg"}>{team.name}</CardTitle>
                  <Badge variant="secondary" className={isMobile ? "text-[10px] px-1.5 py-0" : ""}>{t('svc_service')}</Badge>
                </div>
                {teamStartAddr && (
                  <div className={cn("flex items-center gap-1 text-muted-foreground", isMobile ? "text-[10px]" : "text-sm")}>
                    <MapPin className="h-3 w-3 shrink-0" />
                    {t('svc_start')}: {teamStartAddr}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className={isMobile ? "p-2 pt-0" : ""}>
              <div className={cn(isMobile ? "space-y-2" : "grid grid-cols-5 gap-2")}>
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isDayToday = isSameDay(day, new Date());
                  const dayProjects = getProjectsForTeamAndDate(team.id, dateStr);
                  const totalHours = dayProjects.reduce((sum, p) => sum + (p.assignment.service_hours || 0), 0);
                  const routeData = optimizedRoutes[`${team.id}_${dateStr}`];
                  const drivingMin = routeData?.totalDrivingMinutes;
                  const grandTotal = drivingMin != null ? totalHours + drivingMin / 60 : totalHours;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'border rounded-lg',
                        isMobile ? 'p-2' : 'p-2 min-h-[200px]',
                        isDayToday ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      {/* Day Header */}
                      <div className={cn("flex items-center justify-between", isMobile ? "mb-1.5" : "mb-2")}>
                        <div className={cn('font-medium', isDayToday && 'text-primary')}>
                          {isMobile ? (
                            <span className="text-sm">{format(day, 'EEE d')}</span>
                          ) : (
                            <>
                              <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                              <div className="text-lg">{format(day, 'd')}</div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {totalHours > 0 && (
                            <Badge variant="outline" className={cn("text-xs", isMobile && "text-[10px] px-1.5 py-0")} title={drivingMin != null ? `Service: ${totalHours}h + Driving: ${Math.round(drivingMin)}min` : `Service: ${totalHours}h`}>
                              <Clock className="h-3 w-3 mr-0.5" />{grandTotal.toFixed(1)}h
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Projects for this day */}
                      <div className={cn("space-y-1", isMobile && dayProjects.length === 0 && "hidden")}>
                        {dayProjects.map((project, idx) => (
                          <div
                            key={project.id}
                            className={cn(
                              "border rounded cursor-pointer hover:bg-accent/50 transition-colors",
                              isMobile ? "p-1.5 text-[11px]" : "p-2 text-xs"
                            )}
                            style={{ borderLeftColor: team.color, borderLeftWidth: '3px' }}
                            onClick={() => navigate(`/projects/${project.id}`)}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-medium truncate flex-1">
                                {project.assignment.service_order && (
                                  <Badge variant="secondary" className="mr-1 text-[10px] px-1">
                                    #{project.assignment.service_order}
                                  </Badge>
                                )}
                                {project.name}
                              </span>
                              <button
                                className="text-destructive hover:text-destructive/80 ml-1"
                                onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(project.assignment.id); }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="text-muted-foreground truncate">{project.client}</div>
                            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{getProjectAddress(project)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                min="0.5"
                                max="12"
                                step="0.5"
                                value={project.assignment.service_hours || 2}
                                onChange={(e) => { e.stopPropagation(); handleUpdateHours(project.assignment.id, parseFloat(e.target.value) || 2); }}
                                className={cn("h-5 text-xs", isMobile ? "w-12" : "w-14")}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-muted-foreground">{t('svc_hrs')}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className={cn("mt-1.5 space-y-1", isMobile && "flex gap-1 space-y-0 flex-wrap")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("h-6 text-xs", isMobile ? "flex-1 px-1" : "w-full")}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedTeamId(team.id);
                            setIsAssignDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          {isMobile ? t('svc_service') : t('svc_add_service')}
                        </Button>
                        {dayProjects.length >= 2 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn("h-6 text-xs", isMobile ? "flex-1 px-1" : "w-full")}
                              disabled={optimizing}
                              onClick={() => handleOptimizeRoute(team.id, dateStr)}
                            >
                              {optimizing ? <Loader2 className="h-3 w-3 animate-spin mr-0.5" /> : <Route className="h-3 w-3 mr-0.5" />}
                              {t('svc_optimize_route')}
                            </Button>
                            {optimizedRoutes[`${team.id}_${dateStr}`] && (
                              <Button
                                variant="default"
                                size="sm"
                                className={cn("h-6 text-xs", isMobile ? "flex-1 px-1" : "w-full")}
                                onClick={() => handleShowMap(team.id, dateStr, team.name)}
                              >
                                <Map className="h-3 w-3 mr-0.5" />
                                {t('svc_show_on_map')}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Assign Project Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) {
          setAssignDescription('');
          setAssignTodos(['']);
          setAssignProjectId('');
        }
      }}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", isMobile ? "max-w-[95vw] p-4" : "sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-base" : ""}>{t('svc_schedule_service_visit')}</DialogTitle>
            <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
              {t('svc_add_service_assignment')}
            </p>
          </DialogHeader>
          <div className={cn("py-2", isMobile ? "space-y-3" : "space-y-4")}>
            {/* Date & Team side by side on mobile */}
            <div className={cn(isMobile ? "grid grid-cols-2 gap-2" : "space-y-4")}>
              <div className="space-y-1">
                <Label className={isMobile ? "text-xs" : ""}>{t('svc_date')}</Label>
                <Input
                  value={selectedDate ? format(new Date(selectedDate + 'T12:00:00'), isMobile ? 'EEE, MMM d' : 'EEEE, MMM d yyyy') : ''}
                  disabled
                  className={isMobile ? "h-8 text-xs" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label className={isMobile ? "text-xs" : ""}>{t('svc_team')}</Label>
                <Input
                  value={serviceTeams.find(t => t.id === selectedTeamId)?.name || ''}
                  disabled
                  className={isMobile ? "h-8 text-xs" : ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_project')} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", isMobile && "h-8 text-xs")}>
                    {assignProjectId ? (
                      <span className="truncate">
                        {projects.find(p => p.id === assignProjectId)?.name || t('svc_select_project')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t('svc_search_projects')}</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('svc_search_placeholder')} />
                    <CommandList className={isMobile ? "max-h-[40vh]" : ""}>
                      <CommandEmpty>{t('svc_no_projects_found')}</CommandEmpty>
                      <CommandGroup>
                        {projects
                          .filter(p => p.installation_date)
                          .map(p => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.client || ''} ${getProjectAddress(p)}`}
                              onSelect={() => setAssignProjectId(p.id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", assignProjectId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{p.name}</span>
                                <span className="text-xs text-muted-foreground truncate">{p.client} — {getProjectAddress(p)}</span>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_estimated_hours')}</Label>
              <Input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={assignHours}
                onChange={(e) => setAssignHours(parseFloat(e.target.value) || 2)}
                className={isMobile ? "h-8 text-xs" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_description')}</Label>
              <Textarea
                placeholder={t('svc_describe_service')}
                value={assignDescription}
                onChange={e => setAssignDescription(e.target.value)}
                rows={isMobile ? 2 : 3}
                className={isMobile ? "text-xs" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_todos')}</Label>
              {assignTodos.map((todo, index) => (
                <div key={index} className="flex gap-1.5">
                  <Input
                    placeholder={t('svc_todo_item', { index: String(index + 1) })}
                    value={todo}
                    onChange={e => {
                      const updated = [...assignTodos];
                      updated[index] = e.target.value;
                      setAssignTodos(updated);
                    }}
                    className={isMobile ? "h-8 text-xs" : ""}
                  />
                  {assignTodos.length > 1 && (
                    <Button variant="ghost" size="icon" className={cn("flex-shrink-0", isMobile && "h-8 w-8")} onClick={() => setAssignTodos(assignTodos.filter((_, i) => i !== index))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setAssignTodos([...assignTodos, ''])} className={cn("w-full", isMobile && "h-7 text-xs")}>
                <Plus className="h-4 w-4 mr-1" /> {t('svc_add_todo')}
              </Button>
            </div>
          </div>
          <div className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "justify-end")}>
            <DialogClose asChild>
              <Button variant="outline" className={isMobile ? "w-full" : ""}>{t('svc_cancel')}</Button>
            </DialogClose>
            <Button onClick={handleAssignProject} disabled={!assignProjectId} className={isMobile ? "w-full" : ""}>
              {t('svc_schedule_service')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Map Dialog */}
      <RouteMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        waypoints={mapWaypoints}
        routeGeometry={mapRouteGeometry}
        teamName={mapTeamName}
        dateLabel={mapDateLabel}
        startPoint={mapStartPoint}
        totalDrivingMinutes={mapDrivingMinutes}
        unrecognizedAddresses={mapUnrecognized}
        departureTime={mapDepartureTime}
        workStartTime={mapWorkStartTime}
        workEndTime={mapWorkEndTime}
      />
    </div>
  );
};

export default ServiceTeamCalendar;
