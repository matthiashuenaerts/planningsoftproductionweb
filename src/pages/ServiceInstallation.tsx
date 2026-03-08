import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MapPin, Clock, Play, Route, Loader2, CheckCircle, Navigation } from 'lucide-react';
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
}

interface RouteData {
  stops: ServiceStop[];
  geometry: [number, number][];
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
}

const ServiceInstallation: React.FC = () => {
  const isMobile = useIsMobile();
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
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
        setRouteData(null);
        setLoading(false);
        return;
      }

      const team = serviceTeams[0]; // Use the first service team
      setTeamName(team.name);
      setTeamColor(team.color || '#f73b3b');

      // Get today's assignments for this team
      const { data: assignments } = await supabase
        .from('project_team_assignments')
        .select('*')
        .eq('team_id', team.id)
        .eq('start_date', today);

      if (!assignments || assignments.length === 0) {
        setRouteData({ stops: [], geometry: [], totalDrivingMinutes: 0 });
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

      // Build stops sorted by service_order
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

      // Build route geometry via OSRM if we have coords
      const teamStartAddr = [team.start_street, team.start_number, team.start_postal_code, team.start_city].filter(Boolean).join(' ');
      const startCoords = teamStartAddr ? await geocodeAddress(teamStartAddr) : null;

      const stopsWithGeo = stopsWithCoords.filter(s => s.lat && s.lng);
      let geometry: [number, number][] = [];
      let totalDrivingMinutes: number | undefined;

      if (stopsWithGeo.length >= 2 || (stopsWithGeo.length >= 1 && startCoords)) {
        const coords: string[] = [];
        if (startCoords) coords.push(`${startCoords.lng},${startCoords.lat}`);
        stopsWithGeo.forEach(s => coords.push(`${s.lng},${s.lat}`));
        if (startCoords) coords.push(`${startCoords.lng},${startCoords.lat}`);

        const sourceParam = startCoords ? '&source=first&destination=last' : '';
        const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false${sourceParam}&roundtrip=false`;

        try {
          const resp = await fetch(osrmUrl);
          const data = await resp.json();
          if (data.code === 'Ok' && data.trips?.[0]) {
            geometry = data.trips[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            totalDrivingMinutes = data.trips[0].duration ? data.trips[0].duration / 60 : undefined;
          }
        } catch {
          // Silently fail on OSRM
        }
      }

      setRouteData({
        stops: stopsWithCoords,
        geometry,
        startPoint: startCoords ? { ...startCoords, address: teamStartAddr } : undefined,
        totalDrivingMinutes,
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

    // Clean up old map
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
        .bindPopup(`<strong>Start:</strong> ${routeData.startPoint.address}`);
      bounds.extend([routeData.startPoint.lat, routeData.startPoint.lng]);
    }

    // Add stop markers
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
        .bindPopup(`<strong>${stop.projectName}</strong><br/>${stop.client}<br/>${stop.address}`);
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
      // Stop any active registrations
      await timeRegistrationService.stopActiveRegistrations(currentEmployee.id);

      // Create a time registration with the service_assignment_id
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
        title: 'Timer Started',
        description: `Time registration started for ${stop.projectName}`,
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
              <h1 className="text-2xl font-bold">Service Installation</h1>
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
                <h3 className="text-lg font-semibold mb-2">No Service Stops Today</h3>
                <p className="text-muted-foreground">You have no service installations scheduled for today.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Map */}
              <Card className="order-1 lg:order-1">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Route Map
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {routeData.totalDrivingMinutes != null && (
                        <Badge variant="outline" className="text-xs">
                          🚗 {Math.round(routeData.totalDrivingMinutes)} min drive
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        🔧 {totalServiceHours.toFixed(1)}h service
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        ≈ {(totalServiceHours + drivingHours).toFixed(1)}h total
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 pb-0">
                  <div
                    ref={mapRef}
                    className="w-full rounded-b-lg"
                    style={{ height: isMobile ? '300px' : '500px', zIndex: 0 }}
                  />
                </CardContent>
              </Card>

              {/* Stops List */}
              <Card className="order-2 lg:order-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Service Stops ({routeData.stops.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className={isMobile ? 'max-h-[400px]' : 'max-h-[500px]'}>
                    <div className="divide-y divide-border">
                      {routeData.stops.map((stop, idx) => (
                        <div key={stop.assignmentId} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            {/* Order number */}
                            <div
                              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: teamColor }}
                            >
                              {stop.serviceOrder}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Project name & client */}
                              <h4 className="font-semibold text-sm truncate">{stop.projectName}</h4>
                              <p className="text-xs text-muted-foreground">{stop.client}</p>

                              {/* Address */}
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{stop.address}</span>
                              </div>

                              {/* Service hours */}
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span>{stop.serviceHours}h estimated</span>
                              </div>

                              {/* Service notes/description */}
                              {stop.serviceNotes && (
                                <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                                  {stop.serviceNotes}
                                </div>
                              )}

                              {/* Start Timer Button */}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceInstallation;
