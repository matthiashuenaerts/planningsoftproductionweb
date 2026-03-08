import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
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
import { MapPin, Clock, Play, Route, Loader2, Navigation, Home } from 'lucide-react';
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
  const [startingTimer, setStartingTimer] = useState<string | null>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

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

  const loadTodaysRoute = useCallback(async () => {
    if (!currentEmployee) return;
    setLoading(true);

    try {
      // Find service team(s) the employee belongs to
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

      // Find which of those are service teams
      const { data: serviceTeams } = await (supabase
        .from('placement_teams')
        .select('id, name, color, start_street, start_number, start_postal_code, start_city') as any)
        .eq('team_type', 'service')
        .eq('is_active', true)
        .in('id', memberTeamIds);

      if (!serviceTeams || serviceTeams.length === 0) {
        // For admins/teamleaders not in a service team, show first service team's data
        const { data: allServiceTeams } = await (supabase
          .from('placement_teams')
          .select('id, name, color, start_street, start_number, start_postal_code, start_city') as any)
          .eq('team_type', 'service')
          .eq('is_active', true)
          .limit(1);
        
        if (!allServiceTeams || allServiceTeams.length === 0) {
          setRouteData(null);
          setLoading(false);
          return;
        }
        // Use the first available service team for admin/teamleader view
        serviceTeams?.push?.(...allServiceTeams);
        if (!serviceTeams || serviceTeams.length === 0) {
          setRouteData(null);
          setLoading(false);
          return;
        }
      }

      const team = serviceTeams![0];
      setTeamName(team.name);
      setTeamColor(team.color || '#f73b3b');

      // Fetch installation working hours for today
      const targetDate = new Date();
      const dayOfWeek = targetDate.getDay();
      const allWorkingHours = await workingHoursService.getWorkingHours(tenant?.id);
      const installationHours = workingHoursService.getWorkingHoursForDay(allWorkingHours, 'installation', dayOfWeek);
      const workStartTime = installationHours?.start_time || '08:00';
      const workEndTime = installationHours?.end_time || '17:00';

      // Get today's assignments for this team (sorted by service_order - the optimized order)
      const { data: assignments } = await supabase
        .from('project_team_assignments')
        .select('*')
        .eq('team_id', team.id)
        .eq('start_date', today);

      if (!assignments || assignments.length === 0) {
        setRouteData({ stops: [], geometry: [], totalDrivingMinutes: 0, workStartTime, workEndTime });
        setLoading(false);
        return;
      }

      // Fetch project details
      const projectIds = assignments.map((a: any) => a.project_id);
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client, address_street, address_number, address_postal_code, address_city')
        .in('id', projectIds);

      const projectsMap = new Map((projectsData || []).map((p: any) => [p.id, p]));

      // Build stops sorted by service_order (the optimized order from the calendar)
      const sortedAssignments = [...assignments].sort((a: any, b: any) => (a.service_order || 0) - (b.service_order || 0));

      const stopsWithCoords = await Promise.all(
        sortedAssignments.map(async (a: any, idx: number) => {
          const proj = projectsMap.get(a.project_id);
          const address = proj
            ? [proj.address_street, proj.address_number, proj.address_postal_code, proj.address_city].filter(Boolean).join(' ')
            : 'No address';
          const coords = address !== 'No address' ? await geocodeAddress(address) : null;

          return {
            assignmentId: a.id,
            projectId: a.project_id,
            projectName: proj?.name || 'Unknown',
            client: proj?.client || '',
            address,
            serviceHours: a.service_hours || 0,
            serviceOrder: a.service_order || idx + 1,
            serviceNotes: a.service_notes || null,
            lat: coords?.lat,
            lng: coords?.lng,
          } as ServiceStop;
        })
      );

      // Build route geometry via OSRM using the optimized order
      const teamStartAddr = [team.start_street, team.start_number, team.start_postal_code, team.start_city].filter(Boolean).join(' ');
      const startCoords = teamStartAddr ? await geocodeAddress(teamStartAddr) : null;

      const stopsWithGeo = stopsWithCoords.filter(s => s.lat && s.lng);
      let geometry: [number, number][] = [];
      let totalDrivingMinutes: number | undefined;
      let legDurations: number[] = [];

      if (stopsWithGeo.length >= 1 && startCoords) {
        // Use OSRM route API (not trip) to follow the exact optimized order
        const coords: string[] = [];
        coords.push(`${startCoords.lng},${startCoords.lat}`);
        stopsWithGeo.forEach(s => coords.push(`${s.lng},${s.lat}`));
        coords.push(`${startCoords.lng},${startCoords.lat}`); // return home

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration`;

        try {
          const resp = await fetch(osrmUrl);
          const data = await resp.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            const route = data.routes[0];
            geometry = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            totalDrivingMinutes = route.duration ? route.duration / 60 : undefined;
            legDurations = route.legs?.map((leg: any) => (leg.duration || 0) / 60) || [];
          }
        } catch {
          // Silently fail on OSRM
        }
      } else if (stopsWithGeo.length >= 2) {
        // No start point, just route between stops
        const coords: string[] = [];
        stopsWithGeo.forEach(s => coords.push(`${s.lng},${s.lat}`));
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration`;
        try {
          const resp = await fetch(osrmUrl);
          const data = await resp.json();
          if (data.code === 'Ok' && data.routes?.[0]) {
            geometry = data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            totalDrivingMinutes = data.routes[0].duration ? data.routes[0].duration / 60 : undefined;
            legDurations = data.routes[0].legs?.map((leg: any) => (leg.duration || 0) / 60) || [];
          }
        } catch {}
      }

      // Calculate departure time and arrival/departure per stop
      const [workStartH, workStartM] = workStartTime.split(':').map(Number);
      const workStartTotalMin = workStartH * 60 + workStartM;
      const firstLegMin = legDurations.length > 0 ? legDurations[0] : 0;
      const departureTotalMin = Math.max(0, workStartTotalMin - Math.ceil(firstLegMin));
      const departureTime = `${String(Math.floor(departureTotalMin / 60)).padStart(2, '0')}:${String(departureTotalMin % 60).padStart(2, '0')}`;

      // Calculate per-stop arrival/departure times
      let currentTimeMin = workStartTotalMin; // arrive at first stop at work start
      const stopsWithTimes = stopsWithCoords.map((stop, i) => {
        const arrivalMin = currentTimeMin;
        const serviceMin = (stop.serviceHours || 0) * 60;
        const departureMin = arrivalMin + serviceMin;

        stop.estimatedArrival = `${String(Math.floor(arrivalMin / 60)).padStart(2, '0')}:${String(Math.round(arrivalMin % 60)).padStart(2, '0')}`;
        stop.estimatedDeparture = `${String(Math.floor(departureMin / 60)).padStart(2, '0')}:${String(Math.round(departureMin % 60)).padStart(2, '0')}`;

        // Next: departure from this stop + driving to next
        const nextLegIdx = i + 1; // leg from this stop to next (or to home)
        const drivingToNext = nextLegIdx < legDurations.length ? legDurations[nextLegIdx] : 0;
        currentTimeMin = departureMin + Math.ceil(drivingToNext);

        return stop;
      });

      // Calculate return home time
      const lastStop = stopsWithTimes[stopsWithTimes.length - 1];
      let returnTime: string | undefined;
      if (lastStop?.estimatedDeparture) {
        const [depH, depM] = lastStop.estimatedDeparture.split(':').map(Number);
        const lastDepMin = depH * 60 + depM;
        const returnLegMin = legDurations.length > 0 ? legDurations[legDurations.length - 1] : 0;
        // Only add return leg if it's the actual return-to-start leg (we added start coords at end)
        const returnMin = startCoords ? lastDepMin + Math.ceil(returnLegMin) : lastDepMin;
        returnTime = `${String(Math.floor(returnMin / 60)).padStart(2, '0')}:${String(Math.round(returnMin % 60)).padStart(2, '0')}`;
      }

      setRouteData({
        stops: stopsWithTimes,
        geometry,
        startPoint: startCoords ? { ...startCoords, address: teamStartAddr } : undefined,
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
  }, [currentEmployee, tenant?.id, today]);

  useEffect(() => {
    loadTodaysRoute();
  }, [loadTodaysRoute]);

  // Initialize/update map when routeData changes
  useEffect(() => {
    if (!mapRef.current || !routeData) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([50.85, 4.35], 9);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    // Add start point
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

    // Add stop markers with arrival times
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

    // Draw route
    if (routeData.geometry.length > 0) {
      L.polyline(routeData.geometry, {
        color: teamColor,
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
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

  // Check if return exceeds work end
  const isOvertime = (() => {
    if (!routeData?.returnTime || !routeData?.workEndTime) return false;
    const [rh, rm] = routeData.returnTime.split(':').map(Number);
    const [eh, em] = routeData.workEndTime.split(':').map(Number);
    return rh * 60 + rm > eh * 60 + em;
  })();

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{t('si_title')}</h1>
              <p className="text-muted-foreground text-sm">
                {teamName && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: teamColor }} />
                    {teamName}
                  </span>
                )}
                {' · '}
                {format(new Date(), 'EEEE, MMMM d yyyy')}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !routeData || routeData.stops.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Navigation className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('si_no_stops_today')}</h3>
                <p className="text-muted-foreground">{t('si_no_stops_desc')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Time summary badges */}
              <div className="flex flex-wrap items-center gap-2">
                {routeData.departureTime && (
                  <Badge variant="default" className="gap-1 font-semibold">
                    🚗 {t('si_depart')}: {routeData.departureTime}
                  </Badge>
                )}
                {routeData.workStartTime && (
                  <Badge variant="outline" className="gap-1">
                    🏁 {t('si_first_stop')}: {routeData.workStartTime}
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {t('si_service')}: {totalServiceHours.toFixed(1)}h
                </Badge>
                {routeData.totalDrivingMinutes != null && (
                  <Badge variant="outline" className="gap-1">
                    <Route className="h-3 w-3" />
                    {t('si_driving')}: {Math.round(routeData.totalDrivingMinutes)}min
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1 font-semibold">
                  ≈ {(totalServiceHours + drivingHours).toFixed(1)}h {t('si_total')}
                </Badge>
                {routeData.returnTime && (
                  <Badge variant={isOvertime ? 'destructive' : 'outline'} className="gap-1 font-semibold">
                    <Home className="h-3 w-3" />
                    Return: {routeData.returnTime}
                    {isOvertime && ' ⚠️'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Map */}
                <Card className="order-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Optimized Route
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-0">
                    <div
                      ref={mapRef}
                      className="w-full rounded-b-lg"
                      style={{ height: isMobile ? '300px' : '500px', zIndex: 0 }}
                    />
                  </CardContent>
                </Card>

                {/* Route Schedule + Stops List */}
                <div className="order-2 space-y-4">
                  {/* Route Schedule Timeline */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Route Schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {/* Departure */}
                        {routeData.departureTime && routeData.startPoint && (
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="font-mono text-xs w-12 text-right">{routeData.departureTime}</span>
                            <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">S</div>
                            <span className="truncate">Depart from {routeData.startPoint.address}</span>
                          </div>
                        )}

                        {/* Each stop */}
                        {routeData.stops.map((stop) => (
                          <div key={stop.assignmentId} className="flex items-center gap-3">
                            <span className="font-mono text-xs w-12 text-right">{stop.estimatedArrival || '--:--'}</span>
                            <div
                              className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0"
                              style={{ backgroundColor: teamColor }}
                            >
                              {stop.serviceOrder}
                            </div>
                            <span className="truncate flex-1">
                              {stop.projectName}{' '}
                              <span className="text-muted-foreground">({stop.client})</span>
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">{stop.serviceHours}h</span>
                            {stop.estimatedDeparture && (
                              <span className="text-xs text-muted-foreground shrink-0">→ {stop.estimatedDeparture}</span>
                            )}
                          </div>
                        ))}

                        {/* Return home */}
                        {routeData.returnTime && routeData.startPoint && (
                          <div className={`flex items-center gap-3 ${isOvertime ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            <span className="font-mono text-xs w-12 text-right">{routeData.returnTime}</span>
                            <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">
                              <Home className="h-3 w-3" />
                            </div>
                            <span className="truncate">
                              Return to base
                              {isOvertime && ` (exceeds ${routeData.workEndTime} end of day)`}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stops Detail List */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Service Stops ({routeData.stops.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className={isMobile ? 'max-h-[400px]' : 'max-h-[420px]'}>
                        <div className="divide-y divide-border">
                          {routeData.stops.map((stop) => (
                            <div key={stop.assignmentId} className="p-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div
                                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                  style={{ backgroundColor: teamColor }}
                                >
                                  {stop.serviceOrder}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm truncate">{stop.projectName}</h4>
                                    {stop.estimatedArrival && (
                                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                                        {stop.estimatedArrival} — {stop.estimatedDeparture}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{stop.client}</p>

                                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{stop.address}</span>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                    <span>{stop.serviceHours}h estimated</span>
                                  </div>

                                  {stop.serviceNotes && (
                                    <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                                      {stop.serviceNotes}
                                    </div>
                                  )}

                                  <Button
                                    size="sm"
                                    className="mt-2 w-full"
                                    onClick={() => handleStartTimeRegistration(stop)}
                                    disabled={startingTimer === stop.assignmentId}
                                  >
                                    {startingTimer === stop.assignmentId ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Play className="h-4 w-4 mr-1" />
                                    )}
                                    Start Time Registration
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
