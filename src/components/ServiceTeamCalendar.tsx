import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Route, Loader2, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
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
  start_date: string;
  duration: number;
  service_hours?: number;
  service_order?: number;
}

const ServiceTeamCalendar: React.FC = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
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
    return parts.length > 0 ? parts.join(' ') : 'No address';
  };

  const handleAssignProject = async () => {
    if (!assignProjectId || !selectedTeamId || !selectedDate) return;
    try {
      const team = serviceTeams.find(t => t.id === selectedTeamId);
      const existingForDay = getProjectsForTeamAndDate(selectedTeamId, selectedDate);
      
      const { error } = await supabase
        .from('project_team_assignments')
        .insert({
          project_id: assignProjectId,
          team_id: selectedTeamId,
          team: team?.name || '',
          start_date: selectedDate,
          duration: 1,
          service_hours: assignHours,
          service_order: existingForDay.length + 1
        } as any);

      if (error) throw error;
      toast({ title: 'Success', description: 'Service scheduled successfully' });
      setIsAssignDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
        toast({ title: 'Info', description: 'Need at least 2 projects to optimize route' });
        setOptimizing(false);
        return;
      }

      // Geocode team start address
      const teamStartAddress = [team?.start_street, team?.start_number, team?.start_postal_code, team?.start_city].filter(Boolean).join(' ');
      const startCoords = teamStartAddress ? await geocodeAddress(teamStartAddress) : null;

      // Geocode all project addresses
      const geocodedProjects = await Promise.all(
        dayProjects.map(async (p) => {
          const addr = getProjectAddress(p);
          const coords = addr !== 'No address' ? await geocodeAddress(addr) : null;
          return { ...p, coords, fullAddress: addr };
        })
      );

      const projectsWithCoords = geocodedProjects.filter(p => p.coords !== null);
      
      if (projectsWithCoords.length < 2) {
        // Fallback to postal code heuristic if geocoding fails
        toast({ title: 'Warning', description: 'Could not geocode enough addresses. Using postal code fallback.' });
        await fallbackPostalOptimize(team, dayProjects, teamId, dateStr);
        return;
      }

      // Build OSRM coordinates string: start + all projects
      const coordinates: string[] = [];
      if (startCoords) {
        coordinates.push(`${startCoords.lng},${startCoords.lat}`);
      }
      projectsWithCoords.forEach(p => {
        coordinates.push(`${p.coords!.lng},${p.coords!.lat}`);
      });

      // Use OSRM Trip API for Travelling Salesman optimization
      const sourceParam = startCoords ? '&source=first' : '';
      const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordinates.join(';')}?overview=full&geometries=geojson&steps=false${sourceParam}&roundtrip=false`;
      
      const osrmResp = await fetch(osrmUrl);
      const osrmData = await osrmResp.json();

      if (osrmData.code !== 'Ok' || !osrmData.trips || osrmData.trips.length === 0) {
        toast({ title: 'Warning', description: 'Route optimization service unavailable. Using postal code fallback.' });
        await fallbackPostalOptimize(team, dayProjects, teamId, dateStr);
        return;
      }

      const trip = osrmData.trips[0];
      const waypointOrder = osrmData.waypoints.map((wp: any) => wp.waypoint_index);
      
      // Map OSRM waypoint order back to projects (skip index 0 if start point was included)
      const offset = startCoords ? 1 : 0;
      const orderedProjects = waypointOrder
        .filter((_: number, i: number) => i >= offset)
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

      // Build route geometry (GeoJSON coords are [lng, lat], Leaflet needs [lat, lng])
      const routeGeometry: [number, number][] = trip.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );

      // Build waypoints for map
      const mapWps: RouteWaypoint[] = orderedProjects.map((p: any, i: number) => ({
        name: p.name,
        client: p.client,
        address: p.fullAddress,
        lat: p.coords!.lat,
        lng: p.coords!.lng,
        order: i + 1,
        serviceHours: p.assignment.service_hours,
      }));

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
        }
      }));

      toast({ title: 'Route Optimized', description: `Optimized route for ${orderedProjects.length} stops based on real road distances` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

    toast({ title: 'Route Optimized', description: `Optimized order for ${sorted.length} service visits (postal code approximation)` });
    loadData();
  };

  const [mapDrivingMinutes, setMapDrivingMinutes] = useState<number | undefined>();

  const handleShowMap = (teamId: string, dateStr: string, teamName: string) => {
    const routeKey = `${teamId}_${dateStr}`;
    const route = optimizedRoutes[routeKey];
    if (!route) return;
    
    setMapWaypoints(route.waypoints);
    setMapRouteGeometry(route.geometry);
    setMapStartPoint(route.startPoint);
    setMapDrivingMinutes(route.totalDrivingMinutes);
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
          <h3 className="text-lg font-semibold mb-2">No Service Teams</h3>
          <p className="text-muted-foreground">Create service teams in Settings → Installation Teams to use the service calendar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            <Calendar className="h-4 w-4 mr-1" /> Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground ml-2">
            {format(weekDays[0], 'MMM d')} - {format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      {/* Service Teams Grid */}
      {serviceTeams.map(team => {
        const teamStartAddr = [team.start_street, team.start_number, team.start_postal_code, team.start_city].filter(Boolean).join(', ');
        
        return (
          <Card key={team.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: team.color }} />
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <Badge variant="secondary">Service</Badge>
                </div>
                {teamStartAddr && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Start: {teamStartAddr}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isToday = isSameDay(day, new Date());
                  const dayProjects = getProjectsForTeamAndDate(team.id, dateStr);
                  const totalHours = dayProjects.reduce((sum, p) => sum + (p.assignment.service_hours || 0), 0);
                  const routeData = optimizedRoutes[`${team.id}_${dateStr}`];
                  const drivingMin = routeData?.totalDrivingMinutes;
                  const grandTotal = drivingMin != null ? totalHours + drivingMin / 60 : totalHours;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'border rounded-lg p-2 min-h-[200px]',
                        isToday ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn('text-sm font-medium', isToday && 'text-primary')}>
                          <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                          <div className="text-lg">{format(day, 'd')}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {totalHours > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />{totalHours}h
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Projects for this day */}
                      <div className="space-y-1">
                        {dayProjects.map((project, idx) => (
                          <div
                            key={project.id}
                            className="border rounded p-2 text-xs cursor-pointer hover:bg-accent/50 transition-colors"
                            style={{ borderLeftColor: team.color, borderLeftWidth: '3px' }}
                            onClick={() => navigate(`/projects/${project.id}`)}
                          >
                            <div className="flex items-center justify-between mb-1">
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
                                ×
                              </button>
                            </div>
                            <div className="text-muted-foreground truncate">{project.client}</div>
                            <div className="flex items-center gap-1 text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{getProjectAddress(project)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                min="0.5"
                                max="12"
                                step="0.5"
                                value={project.assignment.service_hours || 2}
                                onChange={(e) => { e.stopPropagation(); handleUpdateHours(project.assignment.id, parseFloat(e.target.value) || 2); }}
                                className="h-5 w-14 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-muted-foreground">hrs</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-2 space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-6 text-xs"
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedTeamId(team.id);
                            setIsAssignDialogOpen(true);
                          }}
                        >
                          + Add Service
                        </Button>
                        {dayProjects.length >= 2 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-6 text-xs"
                              disabled={optimizing}
                              onClick={() => handleOptimizeRoute(team.id, dateStr)}
                            >
                              {optimizing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Route className="h-3 w-3 mr-1" />}
                              Optimize Route
                            </Button>
                            {optimizedRoutes[`${team.id}_${dateStr}`] && (
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full h-6 text-xs"
                                onClick={() => handleShowMap(team.id, dateStr, team.name)}
                              >
                                <Map className="h-3 w-3 mr-1" />
                                Show on Map
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
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Service Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input value={selectedDate ? format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMM d yyyy') : ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Input value={serviceTeams.find(t => t.id === selectedTeamId)?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects
                    .filter(p => p.installation_date)
                    .slice(0, 50)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.client} — {getProjectAddress(p)}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Hours</Label>
              <Input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={assignHours}
                onChange={(e) => setAssignHours(parseFloat(e.target.value) || 2)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAssignProject} disabled={!assignProjectId}>
              Schedule
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
      />
    </div>
  );
};

export default ServiceTeamCalendar;
