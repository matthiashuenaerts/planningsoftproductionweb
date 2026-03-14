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
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Route, Loader2, Map, Plus, X, Search, Check, AlertCircle, Edit3, Pin } from 'lucide-react';
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
  is_service_ticket?: boolean;
  fixed_time?: string | null;
}

interface SavedRouteData {
  waypoints: RouteWaypoint[];
  geometry: [number, number][];
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
  unrecognizedAddresses?: string[];
  departureTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  returnTime?: string;
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
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ServiceAssignment | null>(null);
  const [editTeamId, setEditTeamId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHours, setEditHours] = useState(2);
  const [editDescription, setEditDescription] = useState('');
  const [editTodos, setEditTodos] = useState<string[]>(['']);
  const [editPossibleWeek, setEditPossibleWeek] = useState('');
  const [editFixedTime, setEditFixedTime] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapWaypoints, setMapWaypoints] = useState<RouteWaypoint[]>([]);
  const [mapRouteGeometry, setMapRouteGeometry] = useState<[number, number][]>([]);
  const [mapStartPoint, setMapStartPoint] = useState<{ lat: number; lng: number; address: string } | undefined>();
  const [mapTeamName, setMapTeamName] = useState('');
  const [mapDateLabel, setMapDateLabel] = useState('');
  const [optimizedRoutes, setOptimizedRoutes] = useState<Record<string, SavedRouteData>>({});

  const weekDays = useMemo(() => eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6), [currentWeekStart]);

  // Load saved routes from DB
  const loadSavedRoutes = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) return;
    const startDate = format(weekDays[0], 'yyyy-MM-dd');
    const endDate = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd');
    
    const { data } = await supabase
      .from('service_routes')
      .select('*')
      .in('team_id', teamIds)
      .gte('route_date', startDate)
      .lte('route_date', endDate);
    
    if (data && data.length > 0) {
      const routes: Record<string, SavedRouteData> = {};
      data.forEach((r: any) => {
        const key = `${r.team_id}_${r.route_date}`;
        routes[key] = r.route_data as SavedRouteData;
      });
      setOptimizedRoutes(prev => ({ ...prev, ...routes }));
    }
  }, [weekDays]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      let teamsQuery = (supabase
        .from('placement_teams')
        .select('*') as any)
        .eq('team_type', 'service')
        .eq('is_active', true)
        .order('name');
      teamsQuery = applyTenantFilter(teamsQuery, tenant?.id);
      const { data: teamsData } = await teamsQuery;
      setServiceTeams((teamsData as any) || []);

      let projQuery = supabase
        .from('projects')
        .select(`*, project_team_assignments!left(*)`)
        .not('installation_date', 'is', null)
        .order('installation_date');
      projQuery = applyTenantFilter(projQuery, tenant?.id);
      const { data: projData } = await projQuery;
      setProjects((projData as any) || []);

      if (teamsData && teamsData.length > 0) {
        const teamIds = teamsData.map((t: any) => t.id);
        const { data: assignByTeam } = await supabase
          .from('project_team_assignments')
          .select('*')
          .in('team_id', teamIds);
        const { data: unassignedTickets } = await supabase
          .from('project_team_assignments')
          .select('*')
          .eq('is_service_ticket', true)
          .is('team_id', null);
        const combined = [...(assignByTeam || []), ...(unassignedTickets || [])];
        const seen: Record<string, boolean> = {};
        const unique = combined.filter((a: any) => {
          if (seen[a.id]) return false;
          seen[a.id] = true;
          return true;
        });
        setAssignments(unique as any);
        
        // Load saved routes
        await loadSavedRoutes(teamIds);
      }
    } catch (error: any) {
      console.error('Error loading service calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, loadSavedRoutes]);

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
          is_service_ticket: true,
        } as any);

      if (error) throw error;

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

  const openEditDialog = (assignment: ServiceAssignment) => {
    setEditingAssignment(assignment);
    setEditTeamId(assignment.team_id || '');
    setEditDate(assignment.start_date || '');
    setEditHours(assignment.service_hours || 2);
    setEditPossibleWeek(assignment.service_possible_week || '');
    setEditFixedTime(assignment.fixed_time || '');
    const notes = assignment.service_notes || '';
    const todoIdx = notes.indexOf('\nTodos:\n');
    if (todoIdx >= 0) {
      setEditDescription(notes.substring(0, todoIdx).trim());
      const todoItems = notes.substring(todoIdx + '\nTodos:\n'.length).split('\n').map(l => l.replace(/^☐\s?/, '').trim()).filter(Boolean);
      setEditTodos(todoItems.length > 0 ? todoItems : ['']);
    } else {
      setEditDescription(notes);
      setEditTodos(['']);
    }
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingAssignment) return;
    setEditSaving(true);
    try {
      const team = serviceTeams.find(t => t.id === editTeamId);
      const todoLines = editTodos.filter(t => t.trim()).map(t => `☐ ${t.trim()}`);
      const notes = [editDescription, todoLines.length > 0 ? '\nTodos:\n' + todoLines.join('\n') : ''].filter(Boolean).join('\n');

      const { error } = await supabase
        .from('project_team_assignments')
        .update({
          team_id: editTeamId || null,
          team: team?.name || '',
          start_date: editDate || null,
          service_hours: editHours,
          service_notes: notes.trim() || null,
          service_possible_week: editPossibleWeek.trim() || null,
          fixed_time: editFixedTime.trim() || null,
        } as any)
        .eq('id', editingAssignment.id);
      if (error) throw error;
      toast({ title: t('svc_success'), description: t('as_updated') });
      setIsEditDialogOpen(false);
      setEditingAssignment(null);
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

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

  const saveRouteToDb = async (teamId: string, dateStr: string, routeData: SavedRouteData) => {
    try {
      await supabase
        .from('service_routes')
        .upsert({
          team_id: teamId,
          route_date: dateStr,
          route_data: routeData as any,
        } as any, { onConflict: 'team_id,route_date' });
    } catch (err) {
      console.error('Failed to save route:', err);
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

      const targetDate = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = targetDate.getDay();
      const allWorkingHours = await workingHoursService.getWorkingHours(tenant?.id);
      const installationHours = workingHoursService.getWorkingHoursForDay(allWorkingHours, 'installation', dayOfWeek);
      
      const workStartTime = installationHours?.start_time || '08:00';
      const workEndTime = installationHours?.end_time || '17:00';

      // Separate fixed-time items from flexible ones
      const fixedItems = dayProjects.filter(p => p.assignment.fixed_time);
      const flexibleItems = dayProjects.filter(p => !p.assignment.fixed_time);

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

      const unrecognizedAddresses = geocodedProjects
        .filter(p => p.coords === null && p.fullAddress !== t('svc_no_address'))
        .map(p => `${p.name}: ${p.fullAddress}`);
      geocodedProjects
        .filter(p => p.fullAddress === t('svc_no_address'))
        .forEach(p => unrecognizedAddresses.push(`${p.name}: ${t('svc_no_address_set')}`));

      // If we have fixed items, we need a different approach
      // Optimize flexible items with OSRM, then insert fixed items at their time slots
      const flexGeo = geocodedProjects.filter(p => !p.assignment.fixed_time && p.coords);
      const fixedGeo = geocodedProjects.filter(p => p.assignment.fixed_time);

      let orderedAll: typeof geocodedProjects = [];

      if (flexGeo.length >= 2 && startCoords) {
        // Use OSRM Trip API only for flexible items
        const coordinates: string[] = [`${startCoords.lng},${startCoords.lat}`];
        flexGeo.forEach(p => coordinates.push(`${p.coords!.lng},${p.coords!.lat}`));
        coordinates.push(`${startCoords.lng},${startCoords.lat}`);

        const sourceParam = '&source=first&destination=last';
        const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordinates.join(';')}?overview=false&geometries=geojson&steps=false&annotations=duration${sourceParam}&roundtrip=false`;
        
        const osrmResp = await fetch(osrmUrl);
        const osrmData = await osrmResp.json();

        if (osrmData.code === 'Ok' && osrmData.trips?.length > 0) {
          const waypointOrder = osrmData.waypoints.map((wp: any) => wp.waypoint_index);
          const projectWaypoints = waypointOrder.slice(1, waypointOrder.length - 1);
          const optimizedFlex = projectWaypoints
            .map((wpIdx: number) => flexGeo[wpIdx - 1])
            .filter(Boolean);
          orderedAll = [...optimizedFlex];
        } else {
          orderedAll = [...flexGeo];
        }
      } else {
        orderedAll = [...flexGeo];
      }

      // Insert fixed-time items at appropriate positions
      // Sort fixed items by their fixed_time
      const sortedFixed = [...fixedGeo].sort((a, b) => {
        const timeA = a.assignment.fixed_time || '00:00';
        const timeB = b.assignment.fixed_time || '00:00';
        return timeA.localeCompare(timeB);
      });

      // Merge: build timeline, insert fixed items where they belong
      // Simple approach: add all, then sort by computed arrival (fixed items pinned)
      orderedAll = [...orderedAll, ...sortedFixed];

      // Now compute times and reorder to respect fixed times
      const [workStartH, workStartM] = workStartTime.split(':').map(Number);
      const workStartTotalMin = workStartH * 60 + workStartM;

      // Build final order respecting fixed times
      // Place fixed items first, then fill gaps with flexible items
      const finalOrder: typeof geocodedProjects = [];
      const usedFlex = new Set<string>();
      const remainingFlex = orderedAll.filter(p => !p.assignment.fixed_time);
      
      // Create time slots for fixed items
      interface TimeSlot { item: typeof geocodedProjects[0]; startMin: number; endMin: number; }
      const fixedSlots: TimeSlot[] = sortedFixed.map(p => {
        const [fh, fm] = (p.assignment.fixed_time || '08:00').split(':').map(Number);
        const startMin = fh * 60 + fm;
        const endMin = startMin + (p.assignment.service_hours || 1) * 60;
        return { item: p, startMin, endMin };
      });

      // Fill schedule: start from work start, add flex items, insert fixed items at their time
      let currentMin = workStartTotalMin;
      let flexIdx = 0;

      // Sort all events (fixed slots) by start time
      const allEvents = [...fixedSlots].sort((a, b) => a.startMin - b.startMin);
      let eventIdx = 0;

      while (flexIdx < remainingFlex.length || eventIdx < allEvents.length) {
        // Check if next fixed event is coming up
        if (eventIdx < allEvents.length && (flexIdx >= remainingFlex.length || allEvents[eventIdx].startMin <= currentMin + (remainingFlex[flexIdx]?.assignment.service_hours || 1) * 60)) {
          // Check if we can fit a flex item before this fixed slot
          if (flexIdx < remainingFlex.length) {
            const flexDuration = (remainingFlex[flexIdx].assignment.service_hours || 1) * 60;
            if (currentMin + flexDuration <= allEvents[eventIdx].startMin) {
              finalOrder.push(remainingFlex[flexIdx]);
              currentMin += flexDuration;
              flexIdx++;
              continue;
            }
          }
          // Place the fixed item
          finalOrder.push(allEvents[eventIdx].item);
          currentMin = allEvents[eventIdx].endMin;
          eventIdx++;
        } else if (flexIdx < remainingFlex.length) {
          finalOrder.push(remainingFlex[flexIdx]);
          currentMin += (remainingFlex[flexIdx].assignment.service_hours || 1) * 60;
          flexIdx++;
        } else {
          break;
        }
      }

      // Update service_order in DB
      for (let i = 0; i < finalOrder.length; i++) {
        await supabase
          .from('project_team_assignments')
          .update({ service_order: i + 1 } as any)
          .eq('id', finalOrder[i].assignment.id);
      }

      // Now get the full route geometry with the final order
      const finalWithCoords = finalOrder.filter(p => p.coords);
      let routeGeometry: [number, number][] = [];
      let totalDrivingMinutes: number | undefined;
      let legDurations: number[] = [];

      if (finalWithCoords.length >= 1 && startCoords) {
        const coords: string[] = [`${startCoords.lng},${startCoords.lat}`];
        finalWithCoords.forEach(p => coords.push(`${p.coords!.lng},${p.coords!.lat}`));
        coords.push(`${startCoords.lng},${startCoords.lat}`);

        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration`;
        const routeResp = await fetch(routeUrl);
        const routeData = await routeResp.json();

        if (routeData.code === 'Ok' && routeData.routes?.[0]) {
          const route = routeData.routes[0];
          routeGeometry = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          totalDrivingMinutes = route.duration ? route.duration / 60 : undefined;
          legDurations = route.legs?.map((leg: any) => (leg.duration || 0) / 60) || [];
        }
      }

      // Calculate arrival/departure times
      const firstLegMinutes = legDurations.length > 0 ? legDurations[0] : 0;
      const departureTotalMin = Math.max(0, workStartTotalMin - Math.ceil(firstLegMinutes));
      const departureTimeStr = `${String(Math.floor(departureTotalMin / 60)).padStart(2, '0')}:${String(departureTotalMin % 60).padStart(2, '0')}`;

      let calcTimeMin = workStartTotalMin;
      const mapWps: RouteWaypoint[] = finalOrder.map((p, i) => {
        // If fixed time, use that as arrival
        let arrivalMin = calcTimeMin;
        if (p.assignment.fixed_time) {
          const [fh, fm] = p.assignment.fixed_time.split(':').map(Number);
          arrivalMin = fh * 60 + fm;
        }
        const serviceMin = (p.assignment.service_hours || 0) * 60;
        const departureMin = arrivalMin + serviceMin;
        
        const wp: RouteWaypoint = {
          name: p.name,
          client: p.client,
          address: p.fullAddress,
          lat: p.coords?.lat || 0,
          lng: p.coords?.lng || 0,
          order: i + 1,
          serviceHours: p.assignment.service_hours,
          estimatedArrival: `${String(Math.floor(arrivalMin / 60)).padStart(2, '0')}:${String(Math.round(arrivalMin % 60)).padStart(2, '0')}`,
          estimatedDeparture: `${String(Math.floor(departureMin / 60)).padStart(2, '0')}:${String(Math.round(departureMin % 60)).padStart(2, '0')}`,
        };

        const nextLegIdx = i + 1;
        const drivingToNext = nextLegIdx < legDurations.length ? legDurations[nextLegIdx] : 0;
        calcTimeMin = departureMin + Math.ceil(drivingToNext);

        return wp;
      });

      // Calculate return time
      const lastWp = mapWps[mapWps.length - 1];
      let returnTimeStr = '';
      if (lastWp?.estimatedDeparture) {
        const [h, m] = lastWp.estimatedDeparture.split(':').map(Number);
        const lastDepMin = h * 60 + m;
        const returnLegMin = legDurations.length > 0 ? legDurations[legDurations.length - 1] : 0;
        const returnTotalMin = lastDepMin + Math.ceil(returnLegMin);
        returnTimeStr = `${String(Math.floor(returnTotalMin / 60)).padStart(2, '0')}:${String(returnTotalMin % 60).padStart(2, '0')}`;
      }

      const routeKey = `${teamId}_${dateStr}`;
      const startPt = startCoords ? { ...startCoords, address: teamStartAddress } : undefined;
      
      const savedRoute: SavedRouteData = {
        waypoints: mapWps,
        geometry: routeGeometry,
        startPoint: startPt,
        totalDrivingMinutes,
        unrecognizedAddresses,
        departureTime: departureTimeStr,
        workStartTime,
        workEndTime,
        returnTime: returnTimeStr || undefined,
      };

      setOptimizedRoutes(prev => ({ ...prev, [routeKey]: savedRoute }));

      // Save to DB
      await saveRouteToDb(teamId, dateStr, savedRoute);

      const [workEndH, workEndM] = workEndTime.split(':').map(Number);
      const workEndTotalMin = workEndH * 60 + workEndM;
      const returnMin = returnTimeStr ? (() => { const [h, m] = returnTimeStr.split(':').map(Number); return h * 60 + m; })() : 0;
      const overtime = returnMin > workEndTotalMin;

      toast({ 
        title: t('svc_route_optimized'), 
        description: `${t('svc_depart_stops', { time: departureTimeStr, count: String(finalOrder.length) })}${overtime ? ` ⚠️ Return ${returnTimeStr} > ${workEndTime}` : ` Return by ${returnTimeStr}`}`,
        variant: overtime ? 'destructive' : 'default',
      });
      loadData();
    } catch (error: any) {
      toast({ title: t('svc_error'), description: error.message, variant: 'destructive' });
    } finally {
      setOptimizing(false);
    }
  };

  const [mapDrivingMinutes, setMapDrivingMinutes] = useState<number | undefined>();
  const [mapUnrecognized, setMapUnrecognized] = useState<string[]>([]);
  const [mapDepartureTime, setMapDepartureTime] = useState<string | undefined>();
  const [mapWorkStartTime, setMapWorkStartTime] = useState<string | undefined>();
  const [mapWorkEndTime, setMapWorkEndTime] = useState<string | undefined>();
  const [mapReturnTime, setMapReturnTime] = useState<string | undefined>();

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
                        {dayProjects.map((project) => {
                          const isTicket = project.assignment.is_service_ticket === true;
                          return (
                            <div
                              key={`${project.id}-${project.assignment.id}`}
                              className={cn(
                                "border rounded cursor-pointer hover:bg-accent/50 transition-colors",
                                isMobile ? "p-1.5 text-[11px]" : "p-2 text-xs",
                                !isTicket && "bg-primary/5"
                              )}
                              style={{ borderLeftColor: isTicket ? team.color : 'hsl(var(--primary))', borderLeftWidth: '3px' }}
                              onClick={() => openEditDialog(project.assignment)}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-medium truncate flex-1">
                                  {project.assignment.service_order && (
                                    <Badge variant="secondary" className="mr-1 text-[10px] px-1">
                                      #{project.assignment.service_order}
                                    </Badge>
                                  )}
                                  {!isTicket && (
                                    <Badge variant="outline" className="mr-1 text-[10px] px-1">
                                      📦
                                    </Badge>
                                  )}
                                  {project.assignment.fixed_time && (
                                    <Badge variant="default" className="mr-1 text-[10px] px-1 gap-0.5">
                                      <Pin className="h-2 w-2" />{project.assignment.fixed_time}
                                    </Badge>
                                  )}
                                  {project.name}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Edit3 className="h-3 w-3 text-muted-foreground" />
                                  <button
                                    className="text-destructive hover:text-destructive/80"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(project.assignment.id); }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-muted-foreground truncate">{project.client}</div>
                              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{getProjectAddress(project)}</span>
                              </div>
                              {/* Hours input for ALL items (service tickets and regular projects) */}
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
                          );
                        })}
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

      {/* Still to Plan Section */}
      {(() => {
        const unplanned = assignments.filter(a => a.is_service_ticket === true && (!a.start_date || !a.team_id));
        if (unplanned.length === 0) return null;
        return (
          <Card className="border-orange-300 dark:border-orange-700">
            <CardHeader className={cn("pb-3", isMobile && "p-3 pb-2")}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <CardTitle className={isMobile ? "text-sm" : "text-lg"}>{t('as_still_to_plan')}</CardTitle>
                <Badge variant="secondary" className="text-xs">{unplanned.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t('as_still_to_plan_desc')}</p>
            </CardHeader>
            <CardContent className={isMobile ? "p-2 pt-0" : ""}>
              <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3")}>
                {unplanned.map(a => {
                  const project = projects.find(p => p.id === a.project_id);
                  if (!project) return null;
                  const team = serviceTeams.find(t => t.id === a.team_id);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "border border-orange-200 dark:border-orange-800 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors",
                        isMobile ? "p-2 text-[11px]" : "p-3 text-xs"
                      )}
                      onClick={() => openEditDialog(a)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate flex-1">{project.name}</span>
                        <button
                          className="text-destructive hover:text-destructive/80 ml-1"
                          onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(a.id); }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-muted-foreground truncate">{project.client}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {team ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 dark:text-orange-400">
                            {t('as_no_team')}
                          </Badge>
                        )}
                        {!a.start_date && (
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 dark:text-orange-400">
                            {t('as_no_date')}
                          </Badge>
                        )}
                        {a.service_possible_week && (
                          <Badge variant="secondary" className="text-[10px]">
                            📅 {a.service_possible_week}
                          </Badge>
                        )}
                        {a.service_hours && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Clock className="h-2.5 w-2.5" />{a.service_hours}h
                          </Badge>
                        )}
                      </div>
                      {a.service_notes && (
                        <p className="text-muted-foreground mt-1 line-clamp-2">{a.service_notes.split('\nTodos:')[0].trim()}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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

      {/* Edit Assignment Dialog (works for both service tickets and regular projects) */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditDialogOpen(false); setEditingAssignment(null); } }}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", isMobile ? "max-w-[95vw] p-4" : "sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-base" : ""}>{t('as_edit_service')}</DialogTitle>
            {editingAssignment && (
              <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                {projects.find(p => p.id === editingAssignment.project_id)?.name}
              </p>
            )}
          </DialogHeader>
          <div className={cn("py-2", isMobile ? "space-y-3" : "space-y-4")}>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('as_service_team')}</Label>
              <Select value={editTeamId} onValueChange={setEditTeamId}>
                <SelectTrigger className={isMobile ? "h-8 text-xs" : ""}>
                  <SelectValue placeholder={t('as_select_team')} />
                </SelectTrigger>
                <SelectContent>
                  {serviceTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('as_service_date')}</Label>
              <Input
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className={isMobile ? "h-8 text-xs" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('as_possible_week')}</Label>
              <Input
                placeholder={t('as_possible_week_placeholder')}
                value={editPossibleWeek}
                onChange={e => setEditPossibleWeek(e.target.value)}
                className={isMobile ? "h-8 text-xs" : ""}
              />
            </div>
            <div className={cn(isMobile ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-4")}>
              <div className="space-y-1">
                <Label className={isMobile ? "text-xs" : ""}>{t('svc_estimated_hours')}</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="12"
                  step="0.5"
                  value={editHours}
                  onChange={e => setEditHours(parseFloat(e.target.value) || 2)}
                  className={isMobile ? "h-8 text-xs" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label className={cn("flex items-center gap-1", isMobile ? "text-xs" : "")}>
                  <Pin className="h-3 w-3" /> Fixed arrival time
                </Label>
                <Input
                  type="time"
                  value={editFixedTime}
                  onChange={e => setEditFixedTime(e.target.value)}
                  placeholder="--:--"
                  className={isMobile ? "h-8 text-xs" : ""}
                />
                {editFixedTime && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => setEditFixedTime('')}>
                    Clear fixed time
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_description')}</Label>
              <Textarea
                placeholder={t('svc_describe_service')}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={isMobile ? 2 : 3}
                className={isMobile ? "text-xs" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={isMobile ? "text-xs" : ""}>{t('svc_todos')}</Label>
              {editTodos.map((todo, index) => (
                <div key={index} className="flex gap-1.5">
                  <Input
                    placeholder={t('svc_todo_item', { index: String(index + 1) })}
                    value={todo}
                    onChange={e => {
                      const updated = [...editTodos];
                      updated[index] = e.target.value;
                      setEditTodos(updated);
                    }}
                    className={isMobile ? "h-8 text-xs" : ""}
                  />
                  {editTodos.length > 1 && (
                    <Button variant="ghost" size="icon" className={cn("flex-shrink-0", isMobile && "h-8 w-8")} onClick={() => setEditTodos(editTodos.filter((_, i) => i !== index))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEditTodos([...editTodos, ''])} className={cn("w-full", isMobile && "h-7 text-xs")}>
                <Plus className="h-4 w-4 mr-1" /> {t('svc_add_todo')}
              </Button>
            </div>
          </div>
          <div className={cn("flex gap-2", isMobile ? "flex-col-reverse" : "justify-end")}>
            <DialogClose asChild>
              <Button variant="outline" className={isMobile ? "w-full" : ""}>{t('svc_cancel')}</Button>
            </DialogClose>
            <Button onClick={handleEditSave} disabled={editSaving} className={isMobile ? "w-full" : ""}>
              {editSaving ? t('as_saving') : t('as_save_changes')}
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
