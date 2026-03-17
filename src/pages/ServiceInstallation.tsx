import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { workingHoursService } from '@/services/workingHoursService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, Play, Route, Loader2, Navigation, Home, ChevronLeft, ChevronRight, Calendar, Pin } from 'lucide-react';
import L from 'leaflet';

interface ServiceStop {
  assignmentId: string;
  projectId: string;
  projectName: string;
  client: string;
  address: string;
  serviceHours: number;
  serviceOrder: number;
  serviceNotes: string | null;
  isServiceTicket: boolean;
  fixedTime: string | null;
  lat?: number;
  lng?: number;
  estimatedArrival?: string;
  estimatedDeparture?: string;
}

interface RouteData {
  stops: ServiceStop[];
  geometry: [number, number][];
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
  departureTime?: string;
  returnTime?: string;
  workStartTime?: string;
  workEndTime?: string;
}

interface SavedRouteData {
  waypoints: { name: string; client: string; address: string; lat: number; lng: number; order: number; serviceHours?: number; estimatedArrival?: string; estimatedDeparture?: string }[];
  geometry: [number, number][];
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
  departureTime?: string;
  workStartTime?: string;
  workEndTime?: string;
}

const ServiceInstallation: React.FC = () => {
  const isMobile = useIsMobile();
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#f73b3b');
  const [teamHourlyCost, setTeamHourlyCost] = useState<number>(0);
  const [startingTimer, setStartingTimer] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

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

  const loadRoute = useCallback(async () => {
    if (!currentEmployee) return;
    setLoading(true);

    try {
      const isPrivileged = ['admin', 'teamleader', 'developer'].includes(currentEmployee.role);

      let targetTeams: any[] = [];

      if (isPrivileged) {
        const { data: allServiceTeams } = await (supabase
          .from('placement_teams')
          .select('id, name, color, hourly_cost, start_street, start_number, start_postal_code, start_city') as any)
          .eq('team_type', 'service')
          .eq('is_active', true);
        targetTeams = allServiceTeams || [];
      } else {
        const { data: teamMemberships } = await supabase
          .from('placement_team_members' as any)
          .select('team_id')
          .eq('employee_id', currentEmployee.id);

        if (!teamMemberships || teamMemberships.length === 0) {
          setRouteData(null);
          setLoading(false);
          return;
        }

        const memberTeamIds = (teamMemberships as any[]).map((m: any) => m.team_id);

        const { data: serviceTeams } = await (supabase
          .from('placement_teams')
          .select('id, name, color, hourly_cost, start_street, start_number, start_postal_code, start_city') as any)
          .eq('team_type', 'service')
          .eq('is_active', true)
          .in('id', memberTeamIds);

        targetTeams = serviceTeams || [];
      }

      if (targetTeams.length === 0) {
        setRouteData(null);
        setLoading(false);
        return;
      }

      const team = targetTeams[0];
      setTeamName(isPrivileged && targetTeams.length > 1
        ? targetTeams.map((t: any) => t.name).join(' / ')
        : team.name);
      setTeamColor(team.color || '#f73b3b');
      setTeamHourlyCost(team.hourly_cost || 0);

      const targetDate = selectedDate;
      const dayOfWeek = targetDate.getDay();
      const allWorkingHours = await workingHoursService.getWorkingHours(tenant?.id);
      const installationHours = workingHoursService.getWorkingHoursForDay(allWorkingHours, 'installation', dayOfWeek);
      const workStartTime = installationHours?.start_time || '08:00';
      const workEndTime = installationHours?.end_time || '17:00';

      const allTeamIds = targetTeams.map((t: any) => t.id);

      // Try to load saved route first
      const { data: savedRoutes } = await supabase
        .from('service_routes')
        .select('*')
        .in('team_id', allTeamIds)
        .eq('route_date', dateStr);

      // Get assignments for the day
      const { data: assignments } = await supabase
        .from('project_team_assignments')
        .select('*')
        .in('team_id', allTeamIds)
        .eq('start_date', dateStr);

      if (!assignments || assignments.length === 0) {
        setRouteData({ stops: [], geometry: [], totalDrivingMinutes: 0, workStartTime, workEndTime });
        setLoading(false);
        return;
      }

      const projectIds = assignments.map((a: any) => a.project_id);
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client, address_street, address_number, address_postal_code, address_city')
        .in('id', projectIds);

      const projectsMap = new Map((projectsData || []).map((p: any) => [p.id, p]));

      // If we have a saved route, use its order and timing data
      const savedRoute = savedRoutes?.[0]?.route_data as unknown as SavedRouteData | undefined;
      
      const sortedAssignments = [...assignments].sort((a: any, b: any) => (a.service_order || 0) - (b.service_order || 0));

      const stopsWithCoords = await Promise.all(
        sortedAssignments.map(async (a: any, idx: number) => {
          const proj = projectsMap.get(a.project_id);
          const address = proj
            ? [proj.address_street, proj.address_number, proj.address_postal_code, proj.address_city].filter(Boolean).join(' ')
            : 'No address';
          
          // Try to get coords from saved route first, then geocode
          let coords: { lat: number; lng: number } | null = null;
          if (savedRoute?.waypoints) {
            const savedWp = savedRoute.waypoints.find(w => w.name === proj?.name);
            if (savedWp?.lat && savedWp?.lng) {
              coords = { lat: savedWp.lat, lng: savedWp.lng };
            }
          }
          if (!coords && address !== 'No address') {
            coords = await geocodeAddress(address);
          }

          // Get timing from saved route if available
          const savedWp = savedRoute?.waypoints?.find(w => w.order === (a.service_order || idx + 1));

          return {
            assignmentId: a.id,
            projectId: a.project_id,
            projectName: proj?.name || 'Unknown',
            client: proj?.client || '',
            address,
            serviceHours: a.service_hours || 0,
            serviceOrder: a.service_order || idx + 1,
            serviceNotes: a.service_notes || null,
            isServiceTicket: a.is_service_ticket === true,
            fixedTime: a.fixed_time || null,
            lat: coords?.lat,
            lng: coords?.lng,
            estimatedArrival: savedWp?.estimatedArrival,
            estimatedDeparture: savedWp?.estimatedDeparture,
          } as ServiceStop;
        })
      );

      // Use saved route geometry/timing if available
      let geometry: [number, number][] = savedRoute?.geometry || [];
      let totalDrivingMinutes = savedRoute?.totalDrivingMinutes;
      let departureTime = savedRoute?.departureTime;

      const teamStartAddr = [team.start_street, team.start_number, team.start_postal_code, team.start_city].filter(Boolean).join(' ');
      const startCoords = savedRoute?.startPoint || (teamStartAddr ? await geocodeAddress(teamStartAddr) : null);
      const startPointData = startCoords ? { ...startCoords, address: savedRoute?.startPoint?.address || teamStartAddr } : undefined;

      // If no saved route, compute live
      if (!savedRoute && stopsWithCoords.filter(s => s.lat && s.lng).length >= 1 && startCoords) {
        const stopsWithGeo = stopsWithCoords.filter(s => s.lat && s.lng);
        const coords: string[] = [`${startCoords.lng},${startCoords.lat}`];
        stopsWithGeo.forEach(s => coords.push(`${s.lng},${s.lat}`));
        coords.push(`${startCoords.lng},${startCoords.lat}`);

        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration`;
          const resp = await fetch(osrmUrl);
          const data = await resp.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            const route = data.routes[0];
            geometry = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
            totalDrivingMinutes = route.duration ? route.duration / 60 : undefined;
            const legDurations = route.legs?.map((leg: any) => (leg.duration || 0) / 60) || [];

            const [workStartH, workStartM] = workStartTime.split(':').map(Number);
            const workStartTotalMin = workStartH * 60 + workStartM;
            const firstLegMin = legDurations.length > 0 ? legDurations[0] : 0;
            const departureTotalMin = Math.max(0, workStartTotalMin - Math.ceil(firstLegMin));
            departureTime = `${String(Math.floor(departureTotalMin / 60)).padStart(2, '0')}:${String(departureTotalMin % 60).padStart(2, '0')}`;

            let currentTimeMin = workStartTotalMin;
            stopsWithCoords.forEach((stop, i) => {
              let arrivalMin = currentTimeMin;
              if (stop.fixedTime) {
                const [fh, fm] = stop.fixedTime.split(':').map(Number);
                arrivalMin = fh * 60 + fm;
              }
              const serviceMin = (stop.serviceHours || 0) * 60;
              const departureMin = arrivalMin + serviceMin;
              stop.estimatedArrival = `${String(Math.floor(arrivalMin / 60)).padStart(2, '0')}:${String(Math.round(arrivalMin % 60)).padStart(2, '0')}`;
              stop.estimatedDeparture = `${String(Math.floor(departureMin / 60)).padStart(2, '0')}:${String(Math.round(departureMin % 60)).padStart(2, '0')}`;
              const nextLegIdx = i + 1;
              const drivingToNext = nextLegIdx < legDurations.length ? legDurations[nextLegIdx] : 0;
              currentTimeMin = departureMin + Math.ceil(drivingToNext);
            });
          }
        } catch {}
      }

      // Calculate return time
      const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
      let returnTime: string | undefined;
      if (lastStop?.estimatedDeparture && startCoords) {
        const [depH, depM] = lastStop.estimatedDeparture.split(':').map(Number);
        returnTime = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;
        // If we have total driving and multiple stops, estimate return more accurately
      }

      setRouteData({
        stops: stopsWithCoords,
        geometry,
        startPoint: startPointData,
        totalDrivingMinutes,
        departureTime,
        returnTime,
        workStartTime,
        workEndTime,
      });
    } catch (error: any) {
      console.error('Error loading service route:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentEmployee, tenant?.id, dateStr]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  // Initialize/update map when routeData changes
  useEffect(() => {
    if (!mapRef.current || !routeData) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initTimer = setTimeout(() => {
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([50.85, 4.35], 9);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const bounds = L.latLngBounds([]);

      if (routeData.startPoint) {
        const startIcon = L.divIcon({
          html: `<div style="background:${teamColor};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏠</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([routeData.startPoint.lat, routeData.startPoint.lng], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<strong>Start / Return</strong><br/>${routeData.startPoint.address}${routeData.departureTime ? `<br/>🚗 Depart: ${routeData.departureTime}` : ''}${routeData.returnTime ? `<br/>🏠 Return: ${routeData.returnTime}` : ''}`);
        bounds.extend([routeData.startPoint.lat, routeData.startPoint.lng]);
      }

      routeData.stops.forEach((stop) => {
        if (!stop.lat || !stop.lng) return;
        const icon = L.divIcon({
          html: `<div style="background:${teamColor};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${stop.serviceOrder}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([stop.lat, stop.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>#${stop.serviceOrder} — ${stop.projectName}</strong><br/>${stop.client}<br/>${stop.address}${stop.estimatedArrival ? `<br/>🕐 Arrive: ${stop.estimatedArrival}` : ''}${stop.estimatedDeparture ? ` — Leave: ${stop.estimatedDeparture}` : ''}${stop.serviceHours ? `<br/>🔧 ${stop.serviceHours}h service` : ''}`);
        bounds.extend([stop.lat, stop.lng]);
      });

      if (routeData.geometry.length > 0) {
        L.polyline(routeData.geometry, {
          color: teamColor,
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
      }

      map.invalidateSize();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      setTimeout(() => {
        map.invalidateSize();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      }, 300);
      setTimeout(() => map.invalidateSize(), 800);
    }, 200);

    return () => {
      clearTimeout(initTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [routeData, teamColor]);

  const handleStartTimeRegistration = async (stop: ServiceStop) => {
    if (!currentEmployee) return;
    setStartingTimer(stop.assignmentId);

    try {
      await timeRegistrationService.stopActiveRegistrations(currentEmployee.id);

      const { data, error } = await supabase
        .from('time_registrations')
        .insert({
          employee_id: currentEmployee.id,
          start_time: new Date().toISOString(),
          is_active: true,
          project_name: `🔧 ${stop.projectName} - ${stop.client}`,
          service_assignment_id: stop.assignmentId,
        } as any)
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      toast({
        title: t('si_timer_started'),
        description: (t('si_timer_started_desc') || '').replace('{{name}}', stop.projectName),
      });
    } catch (error: any) {
      console.error('Error starting service time registration:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setStartingTimer(null);
    }
  };

  const totalServiceHours = routeData?.stops.reduce((sum, s) => sum + s.serviceHours, 0) || 0;
  const drivingHours = routeData?.totalDrivingMinutes ? routeData.totalDrivingMinutes / 60 : 0;

  const isOvertime = (() => {
    if (!routeData?.returnTime || !routeData?.workEndTime) return false;
    const [rh, rm] = routeData.returnTime.split(':').map(Number);
    const [eh, em] = routeData.workEndTime.split(':').map(Number);
    return rh * 60 + rm > eh * 60 + em;
  })();

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <div className={`${isMobile ? 'px-3 py-3' : 'p-6'} max-w-7xl mx-auto`}>
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} mb-4`}>
            <div>
              <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>{t('si_title')}</h1>
              <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {teamName && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full inline-block`} style={{ backgroundColor: teamColor }} />
                    {teamName}
                  </span>
                )}
              </p>
            </div>
            {/* Day Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant={isToday ? "default" : "outline"} 
                size="sm" 
                onClick={() => setSelectedDate(new Date())}
              >
                <Calendar className="h-4 w-4 mr-1" />
                {isMobile ? format(selectedDate, 'EEE d MMM') : format(selectedDate, 'EEEE, MMMM d yyyy')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} animate-spin text-muted-foreground`} />
            </div>
          ) : !routeData || routeData.stops.length === 0 ? (
            <Card>
              <CardContent className={`${isMobile ? 'py-8' : 'py-12'} text-center`}>
                <Navigation className={`mx-auto ${isMobile ? 'h-10 w-10 mb-3' : 'h-12 w-12 mb-4'} text-muted-foreground`} />
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold mb-1.5`}>{t('si_no_stops_today')}</h3>
                <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('si_no_stops_desc')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className={`space-y-${isMobile ? '3' : '4'}`}>
              {/* Time summary badges */}
              <div className={`flex flex-wrap items-center gap-1.5 ${isMobile ? 'text-xs' : ''}`}>
                {routeData.departureTime && (
                  <Badge variant="default" className={`gap-1 font-semibold ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                    🚗 {t('si_depart')}: {routeData.departureTime}
                  </Badge>
                )}
                {routeData.workStartTime && (
                  <Badge variant="outline" className={`gap-1 ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                    🏁 {t('si_first_stop')}: {routeData.workStartTime}
                  </Badge>
                )}
                <Badge variant="outline" className={`gap-1 ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                  <Clock className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                  {t('si_service')}: {totalServiceHours.toFixed(1)}h
                </Badge>
                {routeData.totalDrivingMinutes != null && (
                  <Badge variant="outline" className={`gap-1 ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                    <Route className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                    {t('si_driving')}: {Math.round(routeData.totalDrivingMinutes)}min
                  </Badge>
                )}
                <Badge variant="secondary" className={`gap-1 font-semibold ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                  ≈ {(totalServiceHours + drivingHours).toFixed(1)}h {t('si_total')}
                </Badge>
                {teamHourlyCost > 0 && (
                  <Badge variant="outline" className={`gap-1 ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                    💰 €{(totalServiceHours * teamHourlyCost).toFixed(2)} ({t('si_estimated')})
                  </Badge>
                )}
                {routeData.returnTime && (
                  <Badge variant={isOvertime ? 'destructive' : 'outline'} className={`gap-1 font-semibold ${isMobile ? 'text-[10px] px-2 py-0.5' : ''}`}>
                    <Home className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                    {t('si_return')}: {routeData.returnTime}
                    {isOvertime && ' ⚠️'}
                  </Badge>
                )}
              </div>

              <div className={`grid grid-cols-1 lg:grid-cols-2 ${isMobile ? 'gap-3' : 'gap-4'}`}>
                {/* Map */}
                <Card className="order-1">
                  <CardHeader className={`${isMobile ? 'px-3 py-2' : 'pb-2'}`}>
                    <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-center gap-2`}>
                      <Route className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                      {t('si_optimized_route')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-0">
                    <div
                      ref={mapRef}
                      className="w-full rounded-b-lg"
                      style={{ height: isMobile ? '250px' : '500px', zIndex: 0 }}
                    />
                  </CardContent>
                </Card>

                {/* Route Schedule + Stops List */}
                <div className={`order-2 space-y-${isMobile ? '3' : '4'}`}>
                  {/* Route Schedule Timeline */}
                  <Card>
                    <CardHeader className={`${isMobile ? 'px-3 py-2' : 'pb-2'}`}>
                      <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-center gap-2`}>
                        <Clock className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                        {t('si_route_schedule')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
                      <div className={`space-y-1.5 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        {routeData.departureTime && routeData.startPoint && (
                          <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground">
                            <span className={`font-mono ${isMobile ? 'text-[10px] w-10' : 'text-xs w-12'} text-right`}>{routeData.departureTime}</span>
                            <div className={`${isMobile ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'} rounded-full bg-green-500 text-white flex items-center justify-center font-bold shrink-0`}>S</div>
                            <span className="truncate">{(t('si_depart_from') || '').replace('{{address}}', routeData.startPoint.address)}</span>
                          </div>
                        )}

                        {routeData.stops.map((stop) => (
                          <div key={stop.assignmentId} className="flex items-center gap-2 sm:gap-3">
                            <span className={`font-mono ${isMobile ? 'text-[10px] w-10' : 'text-xs w-12'} text-right`}>{stop.estimatedArrival || '--:--'}</span>
                            <div
                              className={`${isMobile ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'} rounded-full text-white flex items-center justify-center font-bold shrink-0`}
                              style={{ backgroundColor: teamColor }}
                            >
                              {stop.serviceOrder}
                            </div>
                            <span className="truncate flex-1">
                              {stop.fixedTime && <Pin className="h-3 w-3 inline mr-0.5 text-primary" />}
                              {!stop.isServiceTicket && <span className="mr-0.5">📦</span>}
                              {stop.projectName}{' '}
                              <span className="text-muted-foreground">({stop.client})</span>
                            </span>
                            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground shrink-0`}>{stop.serviceHours}h</span>
                            {stop.estimatedDeparture && !isMobile && (
                              <span className="text-xs text-muted-foreground shrink-0">→ {stop.estimatedDeparture}</span>
                            )}
                          </div>
                        ))}

                        {routeData.returnTime && routeData.startPoint && (
                          <div className={`flex items-center gap-2 sm:gap-3 ${isOvertime ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            <span className={`font-mono ${isMobile ? 'text-[10px] w-10' : 'text-xs w-12'} text-right`}>{routeData.returnTime}</span>
                            <div className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-green-500 text-white flex items-center justify-center font-bold shrink-0`}>
                              <Home className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                            </div>
                            <span className="truncate">
                              {t('si_return_to_base')}
                              {isOvertime && ` (${(t('si_exceeds_end_of_day') || '').replace('{{time}}', routeData.workEndTime || '')})`}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stops Detail List */}
                  <Card className="overflow-hidden">
                    <CardHeader className={`${isMobile ? 'px-3 py-2' : 'pb-2'}`}>
                      <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-center gap-2`}>
                        <MapPin className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                        {(t('si_service_stops') || '').replace('{{count}}', String(routeData.stops.length))}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className={isMobile ? 'h-[calc(100vh-380px)]' : 'h-[calc(100vh-400px)]'}>
                        <div className="divide-y divide-border">
                          {routeData.stops.map((stop) => (
                            <div key={stop.assignmentId} className={`${isMobile ? 'p-3' : 'p-4'} hover:bg-muted/50 transition-colors`}>
                              <div className={`flex items-start ${isMobile ? 'gap-2.5' : 'gap-3'}`}>
                                <div
                                  className={`flex-shrink-0 ${isMobile ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'} rounded-full flex items-center justify-center text-white font-bold`}
                                  style={{ backgroundColor: teamColor }}
                                >
                                  {stop.serviceOrder}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4 className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'} truncate flex items-center gap-1`}>
                                      {stop.fixedTime && (
                                        <Badge variant="default" className="text-[10px] px-1 gap-0.5 shrink-0">
                                          <Pin className="h-2 w-2" />{stop.fixedTime}
                                        </Badge>
                                      )}
                                      {!stop.isServiceTicket && (
                                        <Badge variant="outline" className="text-[10px] px-1 shrink-0">📦</Badge>
                                      )}
                                      {stop.projectName}
                                    </h4>
                                    {stop.estimatedArrival && (
                                      <Badge variant="outline" className={`${isMobile ? 'text-[10px] px-1.5 py-0' : 'text-xs'} shrink-0`}>
                                        {stop.estimatedArrival}{!isMobile && ` — ${stop.estimatedDeparture}`}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>{stop.client}</p>

                                  <div className={`flex items-center gap-1 mt-1 ${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                    <MapPin className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} flex-shrink-0`} />
                                    <span className="truncate">{stop.address}</span>
                                  </div>

                                  <div className={`flex items-center gap-1 mt-0.5 ${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                    <Clock className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} flex-shrink-0`} />
                                    <span>{stop.serviceHours}h {t('si_estimated')}</span>
                                    {teamHourlyCost > 0 && (
                                      <span className="ml-1">• €{(stop.serviceHours * teamHourlyCost).toFixed(2)}</span>
                                    )}
                                  </div>

                                  {stop.serviceNotes && (
                                    <div className={`mt-1.5 ${isMobile ? 'p-1.5 text-[10px]' : 'p-2 text-xs'} bg-muted rounded whitespace-pre-wrap`}>
                                      {stop.serviceNotes}
                                    </div>
                                  )}

                                  <Button
                                    size="sm"
                                    className={`mt-2 w-full ${isMobile ? 'h-8 text-xs' : ''}`}
                                    onClick={() => handleStartTimeRegistration(stop)}
                                    disabled={startingTimer === stop.assignmentId}
                                  >
                                    {startingTimer === stop.assignmentId ? (
                                      <Loader2 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1 animate-spin`} />
                                    ) : (
                                      <Play className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                                    )}
                                    {t('start_time_registration')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceInstallation;
