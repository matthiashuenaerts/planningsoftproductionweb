import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO, isToday, isSameDay } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import {
  MapPin, Camera, ChevronLeft, ChevronRight, ExternalLink, CalendarDays,
  Clock, Wrench, ClipboardList, Navigation, Zap, AlertTriangle, CheckCircle2,
  FileText, Play, Truck, AlertCircle, Route as RouteIcon
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import InstallationPhotoCapture from './InstallationPhotoCapture';
import ServiceTicketItemsPanel from './ServiceTicketItemsPanel';
import NewRushOrderForm from '@/components/rush-orders/NewRushOrderForm';
import InstallationTaskList from './InstallationTaskList';
import InstallationCompletionDialog from './InstallationCompletionDialog';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import BrokenPartForm from '@/components/broken-parts/BrokenPartForm';
import RouteMapDialog, { RouteWaypoint } from '@/components/service/RouteMapDialog';
import { workingHoursService } from '@/services/workingHoursService';

// Fix Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface InstallationAssignment {
  id: string;
  project_id: string;
  team_id: string | null;
  team: string;
  start_date: string | null;
  duration: number;
  is_service_ticket: boolean;
  service_hours: number | null;
  service_notes: string | null;
  order_index?: number;
  project: {
    id: string;
    name: string;
    client: string;
    description: string | null;
    address_street: string | null;
    address_number: string | null;
    address_postal_code: string | null;
    address_city: string | null;
    installation_date: string | null;
    progress: number | null;
    status: string;
    installation_status: string | null;
  };
  team_info?: {
    name: string;
    color: string;
  };
  truck_number?: string | null;
  driving_time_text?: string | null;
  co_assigned_names?: string[];
  service_ticket_items?: any[];
}

const InstallationTeamDashboard: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [assignments, setAssignments] = useState<InstallationAssignment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [serviceTicketOpen, setServiceTicketOpen] = useState(false);
  const [rushOrderOpen, setRushOrderOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [brokenPartOpen, setBrokenPartOpen] = useState(false);
  const [selectedAssignmentForTicket, setSelectedAssignmentForTicket] = useState<string | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionTaskId, setCompletionTaskId] = useState<string>('');
  const [installationStandardTaskIds, setInstallationStandardTaskIds] = useState<string[]>([]);
  const [drivingTime, setDrivingTime] = useState<string | null>(null);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState<RouteWaypoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routeStartPoint, setRouteStartPoint] = useState<{ lat: number; lng: number; address: string } | undefined>();
  const [routeTotalDrivingMin, setRouteTotalDrivingMin] = useState<number | undefined>();
  const [routeDepartureTime, setRouteDepartureTime] = useState<string | undefined>();
  const [routeReturnTime, setRouteReturnTime] = useState<string | undefined>();
  const [routeWorkStartTime, setRouteWorkStartTime] = useState<string | undefined>();
  const [routeWorkEndTime, setRouteWorkEndTime] = useState<string | undefined>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const dateFnsLocale = lang === 'nl' ? nl : lang === 'fr' ? fr : enUS;

  // Load installation tasks from standard_tasks where is_installation_task = true
  useEffect(() => {
    const loadInstallationTasks = async () => {
      if (!tenant?.id) return;
      try {
        let query = supabase
          .from('standard_tasks')
          .select('id')
          .eq('is_installation_task', true);
        query = applyTenantFilter(query, tenant.id);
        const { data } = await query;
        setInstallationStandardTaskIds((data || []).map((t: any) => t.id));
      } catch { /* ignore */ }
    };
    loadInstallationTasks();
  }, [tenant?.id]);

  // Also check the old tenant setting as fallback
  useEffect(() => {
    const loadOldSetting = async () => {
      if (!tenant?.id || installationStandardTaskIds.length > 0) return;
      try {
        const { data } = await supabase
          .from('tenants')
          .select('settings')
          .eq('id', tenant.id)
          .single();
        const settings = (data?.settings as any) || {};
        if (settings.installation_standard_task_id) {
          setInstallationStandardTaskIds([settings.installation_standard_task_id]);
        }
      } catch { /* ignore */ }
    };
    loadOldSetting();
  }, [tenant?.id, installationStandardTaskIds.length]);

  const loadAssignments = useCallback(async () => {
    if (!currentEmployee?.id) return;
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Get daily_team_assignments for this employee from today onwards (ONLY personal assignments)
      const { data: dailyAssignments } = await supabase
        .from('daily_team_assignments' as any)
        .select('team_id, date')
        .eq('employee_id', currentEmployee.id)
        .gte('date', today)
        .eq('is_available', true);

      // Build date->team_ids map
      const dailyTeamDates = new Map<string, Set<string>>();
      for (const da of (dailyAssignments as any[] || [])) {
        if (!dailyTeamDates.has(da.date)) dailyTeamDates.set(da.date, new Set());
        dailyTeamDates.get(da.date)!.add(da.team_id);
      }

      const allTeamIds = new Set<string>();
      for (const teams of dailyTeamDates.values()) {
        for (const tid of teams) allTeamIds.add(tid);
      }

      if (allTeamIds.size === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // 2. Get project_team_assignments for these teams
      const { data: assignmentsData } = await supabase
        .from('project_team_assignments')
        .select(`
          id, project_id, team_id, team, start_date, duration,
          is_service_ticket, service_hours, service_notes
        `)
        .in('team_id', [...allTeamIds])
        .gte('start_date', today)
        .order('start_date', { ascending: true });

      if (!assignmentsData || assignmentsData.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // 3. Filter: only include if employee has daily assignment for this date + team
      const filteredAssignments = assignmentsData.filter(a => {
        if (!a.start_date || !a.team_id) return false;
        const assignDate = a.start_date;
        
        const dailyTeams = dailyTeamDates.get(assignDate);
        if (dailyTeams && dailyTeams.has(a.team_id)) return true;
        
        // For multi-day assignments, check each day
        const startDate = parseISO(assignDate);
        for (let d = 1; d < a.duration; d++) {
          const checkDate = format(addDays(startDate, d), 'yyyy-MM-dd');
          const checkTeams = dailyTeamDates.get(checkDate);
          if (checkTeams && checkTeams.has(a.team_id)) return true;
        }
        
        return false;
      });

      // 4. Enrich with project + team + truck data
      const projectIds = [...new Set(filteredAssignments.map(a => a.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, client, description, address_street, address_number, address_postal_code, address_city, installation_date, progress, status, installation_status')
        .in('id', projectIds);

      const teamIdsArr = [...allTeamIds];
      const { data: teams } = await (supabase
        .from('placement_teams')
        .select('id, name, color, start_street, start_number, start_postal_code, start_city') as any)
        .in('id', teamIdsArr);

      // Load truck assignments
      const { data: truckAssignments } = await supabase
        .from('project_truck_assignments')
        .select('project_id, truck_id')
        .in('project_id', projectIds);

      let truckMap: Record<string, string> = {};
      if (truckAssignments && truckAssignments.length > 0) {
        const truckIds = [...new Set(truckAssignments.map(ta => ta.truck_id))];
        const { data: trucksData } = await supabase
          .from('trucks')
          .select('id, truck_number')
          .in('id', truckIds);
        const truckNameMap = Object.fromEntries((trucksData || []).map((t: any) => [t.id, t.truck_number]));
        for (const ta of truckAssignments) {
          truckMap[ta.project_id] = truckNameMap[ta.truck_id] || null;
        }
      }

      const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p]));
      const teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, t]));

      // Load co-assigned employees for each project
      const coAssignedMap: Record<string, string[]> = {};
      for (const projectId of projectIds) {
        const relevantAssignments = filteredAssignments.filter(a => a.project_id === projectId);
        for (const a of relevantAssignments) {
          if (!a.team_id || !a.start_date) continue;
          const { data: coAssigned } = await supabase
            .from('daily_team_assignments' as any)
            .select('employee_id')
            .eq('team_id', a.team_id)
            .eq('date', a.start_date)
            .eq('is_available', true)
            .neq('employee_id', currentEmployee.id);
          if (coAssigned && coAssigned.length > 0) {
            const empIds = (coAssigned as any[]).map(c => c.employee_id);
            const { data: empNames } = await supabase
              .from('employees')
              .select('id, name')
              .in('id', empIds);
            coAssignedMap[a.id] = (empNames || []).map((e: any) => e.name);
          }
        }
      }

      // Load service ticket items for service ticket assignments
      const serviceAssignmentIds = filteredAssignments.filter(a => a.is_service_ticket).map(a => a.id);
      let serviceItemsMap: Record<string, any[]> = {};
      if (serviceAssignmentIds.length > 0) {
        const { data: items } = await supabase
          .from('service_ticket_items' as any)
          .select('*')
          .in('assignment_id', serviceAssignmentIds);
        if (items) {
          for (const item of items as any[]) {
            if (!serviceItemsMap[item.assignment_id]) serviceItemsMap[item.assignment_id] = [];
            serviceItemsMap[item.assignment_id].push(item);
          }
        }
      }

      const enriched: InstallationAssignment[] = filteredAssignments
        .filter(a => projectMap[a.project_id])
        .map(a => ({
          ...a,
          order_index: (a as any).order_index ?? 999,
          project: projectMap[a.project_id],
          team_info: a.team_id ? teamMap[a.team_id] : undefined,
          truck_number: truckMap[a.project_id] || null,
          co_assigned_names: coAssignedMap[a.id] || [],
          service_ticket_items: serviceItemsMap[a.id] || [],
        }));

      // Sort: by date, then by order_index for same-day items
      enriched.sort((a, b) => {
        const dateA = a.start_date || '9999';
        const dateB = b.start_date || '9999';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.order_index || 999) - (b.order_index || 999);
      });

      setAssignments(enriched);
      const todayIdx = enriched.findIndex(a => a.start_date && isToday(parseISO(a.start_date)));
      setCurrentIndex(todayIdx >= 0 ? todayIdx : 0);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEmployee?.id]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const currentAssignment = assignments[currentIndex];
  const address = currentAssignment?.project
    ? [
        currentAssignment.project.address_street,
        currentAssignment.project.address_number,
        currentAssignment.project.address_postal_code,
        currentAssignment.project.address_city,
      ].filter(Boolean).join(' ')
    : null;

  // Find other assignments on the same day as current
  const sameDayAssignments = currentAssignment?.start_date
    ? assignments.filter(a =>
        a.id !== currentAssignment.id &&
        a.start_date &&
        isSameDay(parseISO(a.start_date), parseISO(currentAssignment.start_date!))
      )
    : [];

  // All same-day items (including current) sorted by order_index
  const allSameDayItems = currentAssignment?.start_date
    ? assignments
        .filter(a => a.start_date && isSameDay(parseISO(a.start_date), parseISO(currentAssignment.start_date!)))
        .sort((a, b) => (a.order_index || 999) - (b.order_index || 999))
    : [];

  // Route optimization for multi-stop days
  const computeOptimizedRoute = useCallback(async () => {
    if (allSameDayItems.length < 2 || !currentAssignment?.start_date) return;

    try {
      // Get team info for start address
      const teamInfo = (allSameDayItems[0] as any).team_info;
      const teamAddress = teamInfo?.start_street
        ? [teamInfo.start_street, teamInfo.start_number, teamInfo.start_postal_code, teamInfo.start_city].filter(Boolean).join(' ')
        : null;

      if (!teamAddress) return;

      // Get working hours
      const dayOfWeek = parseISO(currentAssignment.start_date).getDay();
      const allWorkingHours = await workingHoursService.getWorkingHours(tenant?.id);
      const installationHours = workingHoursService.getWorkingHoursForDay(allWorkingHours, 'installation', dayOfWeek);
      const workStart = installationHours?.start_time || '08:00';
      const workEnd = installationHours?.end_time || '17:00';

      // Geocode all addresses
      const geocodeAddr = async (addr: string) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`);
          const data = await res.json();
          if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch {}
        return null;
      };

      const startCoords = await geocodeAddr(teamAddress);
      if (!startCoords) return;

      const unrecognized: string[] = [];
      const stopsWithCoords = await Promise.all(
        allSameDayItems.map(async (a, idx) => {
          const addr = [a.project.address_street, a.project.address_number, a.project.address_postal_code, a.project.address_city].filter(Boolean).join(' ');
          const coords = addr ? await geocodeAddr(addr) : null;
          if (!coords && addr) unrecognized.push(`${a.project.name}: ${addr}`);
          return {
            ...a,
            _addr: addr,
            _lat: coords?.lat,
            _lng: coords?.lng,
            _serviceHours: a.is_service_ticket ? (a.service_hours || 0) : (a.duration * 8),
          };
        })
      );

      const validStops = stopsWithCoords.filter(s => s._lat && s._lng);
      if (validStops.length === 0) return;

      // Build OSRM route
      const coords: string[] = [`${startCoords.lng},${startCoords.lat}`];
      validStops.forEach(s => coords.push(`${s._lng},${s._lat}`));
      coords.push(`${startCoords.lng},${startCoords.lat}`);

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson&steps=false&annotations=duration`;
      const resp = await fetch(osrmUrl);
      const data = await resp.json();

      let geometry: [number, number][] = [];
      let totalDrivingMin: number | undefined;
      let depTime: string | undefined;
      let retTime: string | undefined;

      const waypoints: RouteWaypoint[] = validStops.map((s, idx) => ({
        name: s.project.name,
        client: s.project.client,
        address: s._addr,
        lat: s._lat!,
        lng: s._lng!,
        order: idx + 1,
        serviceHours: s.is_service_ticket ? (s.service_hours || 0) : undefined,
      }));

      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        geometry = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
        totalDrivingMin = route.duration ? route.duration / 60 : undefined;
        const legDurations = route.legs?.map((leg: any) => (leg.duration || 0) / 60) || [];

        const [wH, wM] = workStart.split(':').map(Number);
        const workStartMin = wH * 60 + wM;
        const firstLegMin = legDurations.length > 0 ? legDurations[0] : 0;
        const departureMin = Math.max(0, workStartMin - Math.ceil(firstLegMin));
        depTime = `${String(Math.floor(departureMin / 60)).padStart(2, '0')}:${String(departureMin % 60).padStart(2, '0')}`;

        let currentTimeMin = workStartMin;
        waypoints.forEach((wp, i) => {
          const arrivalMin = currentTimeMin;
          const serviceMin = (wp.serviceHours || 0) * 60;
          const departureMin = arrivalMin + serviceMin;
          wp.estimatedArrival = `${String(Math.floor(arrivalMin / 60)).padStart(2, '0')}:${String(Math.round(arrivalMin % 60)).padStart(2, '0')}`;
          wp.estimatedDeparture = `${String(Math.floor(departureMin / 60)).padStart(2, '0')}:${String(Math.round(departureMin % 60)).padStart(2, '0')}`;
          const nextLegIdx = i + 1;
          const drivingToNext = nextLegIdx < legDurations.length ? legDurations[nextLegIdx] : 0;
          currentTimeMin = departureMin + Math.ceil(drivingToNext);
        });

        // Return time
        const lastWp = waypoints[waypoints.length - 1];
        if (lastWp?.estimatedDeparture) {
          const lastLeg = legDurations[legDurations.length - 1] || 0;
          const [lh, lm] = lastWp.estimatedDeparture.split(':').map(Number);
          const returnMin = lh * 60 + lm + Math.ceil(lastLeg);
          retTime = `${String(Math.floor(returnMin / 60)).padStart(2, '0')}:${String(returnMin % 60).padStart(2, '0')}`;
        }
      }

      setRouteWaypoints(waypoints);
      setRouteGeometry(geometry);
      setRouteStartPoint({ ...startCoords, address: teamAddress });
      setRouteTotalDrivingMin(totalDrivingMin);
      setRouteDepartureTime(depTime);
      setRouteReturnTime(retTime);
      setRouteWorkStartTime(workStart);
      setRouteWorkEndTime(workEnd);
    } catch (err) {
      console.error('Route optimization error:', err);
    }
  }, [allSameDayItems.length, currentAssignment?.start_date, tenant?.id]);

  // Auto-compute route when multi-stop day detected
  useEffect(() => {
    if (allSameDayItems.length >= 2) {
      computeOptimizedRoute();
    } else {
      setRouteWaypoints([]);
      setRouteGeometry([]);
    }
  }, [allSameDayItems.length, computeOptimizedRoute]);

  useEffect(() => {
    if (!address || !mapContainerRef.current) return;
    setDrivingTime(null);

    const geocode = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        if (data.length === 0) return;

        const destLat = parseFloat(data[0].lat);
        const destLng = parseFloat(data[0].lon);

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = L.map(mapContainerRef.current!, { zoomControl: !isMobile }).setView([destLat, destLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
        }).addTo(map);

        L.marker([destLat, destLng]).addTo(map).bindPopup(
          `<strong>${currentAssignment?.project.name}</strong><br/>${address}`
        ).openPopup();

        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);

        // Calculate driving time from team's base address
        if (currentAssignment?.team_id) {
          const teamInfo = (currentAssignment as any).team_info;
          const teamAddress = teamInfo?.start_street
            ? [teamInfo.start_street, teamInfo.start_number, teamInfo.start_postal_code, teamInfo.start_city].filter(Boolean).join(' ')
            : null;

          if (teamAddress) {
            try {
              const teamRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(teamAddress)}&limit=1`);
              const teamGeo = await teamRes.json();
              if (teamGeo.length > 0) {
                const teamLat = parseFloat(teamGeo[0].lat);
                const teamLng = parseFloat(teamGeo[0].lon);

                const routeRes = await fetch(
                  `https://router.project-osrm.org/route/v1/driving/${teamLng},${teamLat};${destLng},${destLat}?overview=false`
                );
                const routeData = await routeRes.json();
                if (routeData.routes && routeData.routes.length > 0) {
                  const durationMin = Math.round(routeData.routes[0].duration / 60);
                  const distKm = (routeData.routes[0].distance / 1000).toFixed(1);
                  setDrivingTime(`~${durationMin} min (${distKm} km)`);
                }
              }
            } catch (err) {
              console.error('Driving time calculation error:', err);
            }
          }
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    };

    const timer = setTimeout(geocode, 300);
    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [address, currentIndex, isMobile]);

  const getEndDate = (assignment: InstallationAssignment) => {
    if (!assignment.start_date) return null;
    return addDays(parseISO(assignment.start_date), assignment.duration - 1);
  };

  const openNavigation = () => {
    if (address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  const handleInstallationTaskComplete = (taskId: string) => {
    setCompletionTaskId(taskId);
    setCompletionDialogOpen(true);
  };

  const isCompleted = currentAssignment?.project?.installation_status === 'completed';
  const isCompletedWithService = currentAssignment?.project?.installation_status === 'completed_with_service';
  const hasCompletionStatus = isCompleted || isCompletedWithService;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        <Navbar />
        <div className="w-full px-3 pt-16 pb-4 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t('inst_loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Navbar />
      <div className="w-full px-3 pt-16 pb-4">
        <div className="w-full mx-auto space-y-4">
          {/* Header */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {getGreeting()}, {currentEmployee?.name?.split(' ')[0]}
            </p>
            <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-2xl'}`}>
              {t('inst_dashboard')}
            </h1>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">{t('inst_no_installations_planned')}</p>
                <p className="text-sm">{t('inst_no_installations_assigned')}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Navigation between assignments */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(i => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> {t('inst_previous')}
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  {currentIndex + 1} / {assignments.length} {t('inst_installations')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === assignments.length - 1}
                  onClick={() => setCurrentIndex(i => i + 1)}
                >
                  {t('inst_next')} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {currentAssignment && (
                <>
                  {/* Multi-task day indicator with timeline */}
                  {sameDayAssignments.length > 0 && (
                    <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              {allSameDayItems.length} {t('inst_tasks_same_day')}
                            </span>
                          </div>
                          {routeWaypoints.length >= 2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => setRouteDialogOpen(true)}
                            >
                              <RouteIcon className="h-3.5 w-3.5 mr-1" /> {t('inst_show_route') || 'Show Route'}
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {allSameDayItems.map((a, idx) => (
                            <button
                              key={a.id}
                              onClick={() => setCurrentIndex(assignments.indexOf(a))}
                              className={`flex items-center gap-2 text-sm w-full text-left rounded px-2 py-1.5 ${
                                a.id === currentAssignment.id
                                  ? 'bg-amber-200/60 dark:bg-amber-800/30 font-semibold'
                                  : 'hover:bg-amber-100 dark:hover:bg-amber-900/20'
                              }`}
                            >
                              <span className="text-xs font-bold text-amber-600 w-5">{idx + 1}.</span>
                              <Badge variant={a.id === currentAssignment.id ? 'default' : 'secondary'} className="text-[10px]">
                                {a.is_service_ticket ? '🔧' : '📦'}
                              </Badge>
                              <span className="truncate flex-1">{a.project.name}</span>
                              {routeWaypoints[idx]?.estimatedArrival && (
                                <span className="text-[10px] text-primary flex-shrink-0 font-mono">🕐 {routeWaypoints[idx].estimatedArrival}</span>
                              )}
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {a.is_service_ticket ? `${a.service_hours || 0}h` : `${a.duration}d`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-6'}`}>
                    {/* Left column: Project info + Tasks */}
                    <div className="space-y-4">
                      {/* Project Info Card */}
                      <Card className={`relative overflow-hidden ${hasCompletionStatus ? 'opacity-90' : ''}`}>
                        {/* Completion watermark */}
                        {hasCompletionStatus && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className={`text-4xl font-black uppercase tracking-widest rotate-[-20deg] ${
                              isCompleted ? 'text-green-500/20' : 'text-amber-500/20'
                            }`}>
                              {isCompleted ? t('inst_watermark_completed') : t('inst_watermark_service')}
                            </div>
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'} truncate`}>{currentAssignment.project.name}</CardTitle>
                              <CardDescription className="truncate">{currentAssignment.project.client}</CardDescription>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                              {currentAssignment.is_service_ticket && (
                                <Badge variant="outline" className="border-amber-500 text-amber-700">🔧 Service</Badge>
                              )}
                              {currentAssignment.team_info && (
                                <Badge style={{ backgroundColor: currentAssignment.team_info.color, color: '#fff' }}>
                                  {currentAssignment.team_info.name}
                                </Badge>
                              )}
                              {currentAssignment.start_date && isToday(parseISO(currentAssignment.start_date)) && (
                                <Badge variant="default">{t('inst_today')}</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Truck + Co-assigned indicator */}
                          {(currentAssignment.truck_number || (currentAssignment.co_assigned_names && currentAssignment.co_assigned_names.length > 0)) && (
                            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2 flex-wrap">
                              {currentAssignment.truck_number && (
                                <span className="flex items-center gap-1.5">
                                  <Truck className="h-4 w-4 text-primary flex-shrink-0" />
                                  <span className="font-medium">{t('inst_truck')}: {currentAssignment.truck_number}</span>
                                </span>
                              )}
                              {currentAssignment.co_assigned_names && currentAssignment.co_assigned_names.length > 0 && (
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span>👥</span>
                                  <span>{currentAssignment.co_assigned_names.join(', ')}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Service ticket details */}
                          {currentAssignment.is_service_ticket && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-md p-3 space-y-2">
                              {currentAssignment.service_hours && (
                                <p className="text-sm"><strong>{t('inst_service_hours')}:</strong> {currentAssignment.service_hours}h</p>
                              )}
                              {currentAssignment.service_notes && (
                                <p className="text-sm text-muted-foreground">{currentAssignment.service_notes}</p>
                              )}
                              {/* Service ticket items */}
                              {currentAssignment.service_ticket_items && currentAssignment.service_ticket_items.length > 0 && (
                                <div className="border-t border-amber-200 dark:border-amber-800 pt-2 mt-2 space-y-1.5">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t('inst_service_items')}:</p>
                                  {currentAssignment.service_ticket_items.map((item: any) => (
                                    <div key={item.id} className="flex items-start gap-2 text-xs">
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">
                                        {item.item_type === 'order_request' ? '📦' : item.item_type === 'production_task' ? '🔨' : item.item_type === 'office_task' ? '🏢' : '☑️'}
                                      </Badge>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium">{item.title}</span>
                                        {item.description && <p className="text-muted-foreground truncate">{item.description}</p>}
                                      </div>
                                      <Badge className={`text-[9px] h-4 ${item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {item.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dates */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">{t('start_date')}</p>
                                <p className="font-medium truncate">
                                  {currentAssignment.start_date
                                    ? format(parseISO(currentAssignment.start_date), 'EEEE d MMMM', { locale: dateFnsLocale })
                                    : t('inst_not_planned')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground text-xs">{t('duration')}</p>
                                <p className="font-medium">
                                  {currentAssignment.is_service_ticket
                                    ? `${currentAssignment.service_hours || 0}h`
                                    : <>
                                        {currentAssignment.duration} {currentAssignment.duration === 1 ? t('inst_day') : t('inst_days')}
                                        {getEndDate(currentAssignment) && (
                                          <span className="text-muted-foreground ml-1">
                                            ({t('inst_until')} {format(getEndDate(currentAssignment)!, 'd MMM', { locale: dateFnsLocale })})
                                          </span>
                                        )}
                                      </>
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Address */}
                          {address && (
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-muted-foreground text-xs">{t('inst_address')}</p>
                                <p className="font-medium break-words">{address}</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={openNavigation} className="flex-shrink-0">
                                <Navigation className="h-4 w-4 mr-1" /> {t('inst_route')}
                              </Button>
                            </div>
                          )}

                          {/* Progress */}
                          {!currentAssignment.is_service_ticket && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{t('progress')}</span>
                              <div className="flex-1 bg-muted rounded-full h-2.5">
                                <div
                                  className="bg-primary h-2.5 rounded-full transition-all"
                                  style={{ width: `${currentAssignment.project.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">{currentAssignment.project.progress || 0}%</span>
                            </div>
                          )}

                          {/* Description */}
                          {currentAssignment.project.description && (
                            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                              {currentAssignment.project.description}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
                            <Button
                              variant="outline"
                              size={isMobile ? 'sm' : 'default'}
                              onClick={() => window.open(`/${tenant?.slug}/${lang}/projects/${currentAssignment.project.id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1.5" />
                              <span className="truncate">{t('inst_project_details')}</span>
                            </Button>
                            <Button
                              variant="outline"
                              size={isMobile ? 'sm' : 'default'}
                              onClick={() => setPhotoDialogOpen(true)}
                            >
                              <Camera className="h-4 w-4 mr-1.5" />
                              <span className="truncate">{t('inst_yard_photos')}</span>
                            </Button>
                            <Button
                              variant="outline"
                              size={isMobile ? 'sm' : 'default'}
                              onClick={() => setDocumentsOpen(true)}
                            >
                              <FileText className="h-4 w-4 mr-1.5" />
                              <span className="truncate">{t('inst_documents')}</span>
                            </Button>
                            {!isMobile && (
                              <Button
                                variant="outline"
                                onClick={openNavigation}
                              >
                                <Navigation className="h-4 w-4 mr-1.5" />
                                <span className="truncate">{t('inst_google_maps')}</span>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Task List */}
                      <InstallationTaskList
                        projectId={currentAssignment.project.id}
                        installationStandardTaskIds={installationStandardTaskIds}
                        onInstallationTaskComplete={handleInstallationTaskComplete}
                      />

                      {/* Large Complete Installation Button */}
                      {installationStandardTaskIds.length > 0 && !currentAssignment.is_service_ticket && !hasCompletionStatus && (
                        <Button
                          className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            handleInstallationTaskComplete('');
                          }}
                        >
                          <CheckCircle2 className="h-6 w-6 mr-2" />
                          {t('inst_complete_installation')}
                        </Button>
                      )}

                      {/* Service Start Button removed — service-installation page deprecated */}

                      {/* Service + Rush Order + Broken Part cards */}
                      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Wrench className="h-4 w-4" /> {t('inst_after_sales')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => {
                                setSelectedAssignmentForTicket(currentAssignment.id);
                                setServiceTicketOpen(true);
                              }}
                            >
                              <ClipboardList className="h-4 w-4 mr-2" /> {t('inst_new_service_ticket')}
                            </Button>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-500" /> {t('inst_rush_order')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => setRushOrderOpen(true)}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" /> {t('inst_create_rush_order')}
                            </Button>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive" /> {t('broken_parts')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => setBrokenPartOpen(true)}
                            >
                              <AlertCircle className="h-4 w-4 mr-2" /> {t('inst_add_broken_part')}
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Right column: Map + Upcoming */}
                    <div className="space-y-4">
                      {address && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4" /> {t('inst_location')}
                            </CardTitle>
                            <CardDescription className="text-xs truncate">{address}</CardDescription>
                            {drivingTime && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Navigation className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium text-primary">{t('inst_driving_time')}: {drivingTime}</span>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div
                              ref={mapContainerRef}
                              className={`w-full ${isMobile ? 'h-48' : 'h-72'} rounded-lg overflow-hidden border border-border`}
                            />
                          </CardContent>
                        </Card>
                      )}

                      {assignments.length > 1 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CalendarDays className="h-4 w-4" /> {t('inst_upcoming')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                            {assignments.map((a, idx) => {
                              const aCompleted = a.project?.installation_status === 'completed';
                              const aService = a.project?.installation_status === 'completed_with_service';
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => setCurrentIndex(idx)}
                                  className={`w-full text-left p-3 rounded-lg border transition-colors relative overflow-hidden ${
                                    idx === currentIndex
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:bg-muted/50'
                                  }`}
                                >
                                  {(aCompleted || aService) && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <span className={`text-lg font-black uppercase rotate-[-15deg] ${
                                        aCompleted ? 'text-green-500/15' : 'text-amber-500/15'
                                      }`}>
                                        {aCompleted ? '✓' : '🔧'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex items-center gap-1.5">
                                      {a.is_service_ticket && <span className="text-xs">🔧</span>}
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{a.project.name}</p>
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <p className="text-xs text-muted-foreground truncate">{a.project.client}</p>
                                          {a.truck_number && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                                              <Truck className="h-2.5 w-2.5 mr-0.5" />{a.truck_number}
                                            </Badge>
                                          )}
                                          {a.co_assigned_names && a.co_assigned_names.length > 0 && (
                                            <span className="text-[9px] text-muted-foreground">👥 {a.co_assigned_names.join(', ')}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      {a.start_date && (
                                        <p className="text-xs font-medium">
                                          {format(parseISO(a.start_date), 'd MMM', { locale: dateFnsLocale })}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        {a.is_service_ticket ? `${a.service_hours || 0}h` : `${a.duration}d`}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  {/* Dialogs */}
                  <InstallationPhotoCapture
                    open={photoDialogOpen}
                    onOpenChange={setPhotoDialogOpen}
                    projectId={currentAssignment.project.id}
                    projectName={currentAssignment.project.name}
                  />

                  <ProjectFilesPopup
                    isOpen={documentsOpen}
                    onClose={() => setDocumentsOpen(false)}
                    projectId={currentAssignment.project.id}
                    projectName={currentAssignment.project.name}
                  />

                  <ServiceTicketItemsPanel
                    open={serviceTicketOpen}
                    onOpenChange={setServiceTicketOpen}
                    projectId={currentAssignment.project.id}
                    projectName={currentAssignment.project.name}
                    assignmentId={selectedAssignmentForTicket}
                  />

                  <Dialog open={rushOrderOpen} onOpenChange={setRushOrderOpen}>
                    <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto' : 'max-w-2xl max-h-[85vh] overflow-y-auto'}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-amber-500" /> {t('inst_create_rush_order')}
                        </DialogTitle>
                      </DialogHeader>
                      <NewRushOrderForm
                        initialValues={{
                          title: `Spoed - ${currentAssignment.project.name}`,
                          description: `Project: ${currentAssignment.project.name}\nKlant: ${currentAssignment.project.client}\nAdres: ${address || '-'}`,
                          projectId: currentAssignment.project.id,
                        }}
                        onSuccess={() => {
                          setRushOrderOpen(false);
                          toast({ title: t('inst_create_rush_order') });
                        }}
                      />
                    </DialogContent>
                  </Dialog>

                  {/* Broken Part Dialog */}
                  <Dialog open={brokenPartOpen} onOpenChange={setBrokenPartOpen}>
                    <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto' : 'max-w-2xl max-h-[85vh] overflow-y-auto'}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive" /> {t('inst_add_broken_part')}
                        </DialogTitle>
                      </DialogHeader>
                      <BrokenPartForm
                        prefilledProjectId={currentAssignment.project.id}
                        onSuccess={() => {
                          setBrokenPartOpen(false);
                          toast({ title: t('inst_broken_part_added') });
                        }}
                        embedded
                      />
                    </DialogContent>
                  </Dialog>

                  {completionDialogOpen && (
                    <InstallationCompletionDialog
                      open={completionDialogOpen}
                      onOpenChange={setCompletionDialogOpen}
                      taskId={completionTaskId}
                      projectId={currentAssignment.project.id}
                      projectName={currentAssignment.project.name}
                      assignmentId={currentAssignment.id}
                      onCompleted={() => {
                        loadAssignments();
                      }}
                      onServiceTicketNeeded={() => {
                        setSelectedAssignmentForTicket(currentAssignment.id);
                        setServiceTicketOpen(true);
                      }}
                    />
                  )}

                  {/* Route Map Dialog for multi-stop days */}
                  <RouteMapDialog
                    open={routeDialogOpen}
                    onOpenChange={setRouteDialogOpen}
                    waypoints={routeWaypoints}
                    routeGeometry={routeGeometry}
                    teamName={currentAssignment?.team_info?.name || ''}
                    dateLabel={currentAssignment?.start_date ? format(parseISO(currentAssignment.start_date), 'EEEE d MMMM yyyy', { locale: dateFnsLocale }) : ''}
                    startPoint={routeStartPoint}
                    totalDrivingMinutes={routeTotalDrivingMin}
                    departureTime={routeDepartureTime}
                    workStartTime={routeWorkStartTime}
                    workEndTime={routeWorkEndTime}
                    returnTime={routeReturnTime}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallationTeamDashboard;
