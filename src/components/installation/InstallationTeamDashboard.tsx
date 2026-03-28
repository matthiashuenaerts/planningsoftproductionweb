import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO, isToday } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import {
  MapPin, Camera, ChevronLeft, ChevronRight, ExternalLink, CalendarDays,
  Phone, Clock, Wrench, Package, ClipboardList, Building2, Navigation, Image
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import L from 'leaflet';
import InstallationPhotoCapture from './InstallationPhotoCapture';
import ServiceTicketItemsPanel from './ServiceTicketItemsPanel';

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
  };
  team_info?: {
    name: string;
    color: string;
  };
}

const InstallationTeamDashboard: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [assignments, setAssignments] = useState<InstallationAssignment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [serviceTicketOpen, setServiceTicketOpen] = useState(false);
  const [selectedAssignmentForTicket, setSelectedAssignmentForTicket] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const dateFnsLocale = language === 'nl' ? nl : language === 'fr' ? fr : enUS;

  const loadAssignments = useCallback(async () => {
    if (!currentEmployee?.id) return;
    setLoading(true);
    try {
      // 1. Find teams this employee belongs to
      const { data: memberships } = await (supabase
        .from('placement_team_members' as any)
        .select('team_id')
        .eq('employee_id', currentEmployee.id));

      const teamIds = (memberships || []).map((m: any) => m.team_id);
      if (teamIds.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // 2. Get all assignments for those teams (today and future, non-service)
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: assignmentsData } = await supabase
        .from('project_team_assignments')
        .select(`
          id, project_id, team_id, team, start_date, duration,
          is_service_ticket, service_hours, service_notes
        `)
        .in('team_id', teamIds)
        .gte('start_date', today)
        .eq('is_service_ticket', false)
        .order('start_date', { ascending: true });

      if (!assignmentsData || assignmentsData.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // 3. Fetch project details
      const projectIds = [...new Set(assignmentsData.map(a => a.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, client, description, address_street, address_number, address_postal_code, address_city, installation_date, progress, status')
        .in('id', projectIds);

      // 4. Fetch team info
      const { data: teams } = await (supabase
        .from('placement_teams')
        .select('id, name, color') as any)
        .in('id', teamIds);

      const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p]));
      const teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, t]));

      const enriched: InstallationAssignment[] = assignmentsData
        .filter(a => projectMap[a.project_id])
        .map(a => ({
          ...a,
          project: projectMap[a.project_id],
          team_info: a.team_id ? teamMap[a.team_id] : undefined,
        }));

      setAssignments(enriched);
      // Set index to today's assignment if exists
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

  // Map rendering
  const currentAssignment = assignments[currentIndex];
  const address = currentAssignment?.project
    ? [
        currentAssignment.project.address_street,
        currentAssignment.project.address_number,
        currentAssignment.project.address_postal_code,
        currentAssignment.project.address_city,
      ].filter(Boolean).join(' ')
    : null;

  useEffect(() => {
    if (!address || !mapContainerRef.current) return;

    // Geocode the address using Nominatim
    const geocode = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        if (data.length === 0) return;

        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = L.map(mapContainerRef.current!, { zoomControl: !isMobile }).setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
        }).addTo(map);

        L.marker([lat, lng]).addTo(map).bindPopup(
          `<strong>${currentAssignment?.project.name}</strong><br/>${address}`
        ).openPopup();

        mapRef.current = map;

        setTimeout(() => map.invalidateSize(), 200);
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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
        {isMobile && <Navbar />}
        <div className={`w-full ${!isMobile ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'} flex items-center justify-center`}>
          <div className="animate-pulse text-muted-foreground">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {getGreeting()}, {currentEmployee?.name?.split(' ')[0]}
            </p>
            <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-2xl'}`}>
              Installatie Dashboard
            </h1>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Geen installaties gepland</p>
                <p className="text-sm">Er zijn momenteel geen installaties aan uw team toegewezen.</p>
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
                  <ChevronLeft className="h-4 w-4 mr-1" /> Vorige
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  {currentIndex + 1} / {assignments.length} installaties
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === assignments.length - 1}
                  onClick={() => setCurrentIndex(i => i + 1)}
                >
                  Volgende <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {currentAssignment && (
                <>
                  {/* Project Info Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{currentAssignment.project.name}</CardTitle>
                          <CardDescription className="truncate">{currentAssignment.project.client}</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {currentAssignment.team_info && (
                            <Badge
                              style={{ backgroundColor: currentAssignment.team_info.color, color: '#fff' }}
                            >
                              {currentAssignment.team_info.name}
                            </Badge>
                          )}
                          {currentAssignment.start_date && isToday(parseISO(currentAssignment.start_date)) && (
                            <Badge variant="default">Vandaag</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-muted-foreground text-xs">Startdatum</p>
                            <p className="font-medium">
                              {currentAssignment.start_date
                                ? format(parseISO(currentAssignment.start_date), 'EEEE d MMMM', { locale: dateFnsLocale })
                                : 'Niet gepland'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-muted-foreground text-xs">Duur</p>
                            <p className="font-medium">
                              {currentAssignment.duration} {currentAssignment.duration === 1 ? 'dag' : 'dagen'}
                              {getEndDate(currentAssignment) && (
                                <span className="text-muted-foreground ml-1">
                                  (t/m {format(getEndDate(currentAssignment)!, 'd MMM', { locale: dateFnsLocale })})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      {address && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="text-muted-foreground text-xs">Adres</p>
                            <p className="font-medium">{address}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={openNavigation}>
                            <Navigation className="h-4 w-4 mr-1" /> Route
                          </Button>
                        </div>
                      )}

                      {/* Progress */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Voortgang</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${currentAssignment.project.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{currentAssignment.project.progress || 0}%</span>
                      </div>

                      {/* Description */}
                      {currentAssignment.project.description && (
                        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                          {currentAssignment.project.description}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/${tenant?.slug}/${language}/projects/${currentAssignment.project.id}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" /> Projectdetails
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPhotoDialogOpen(true)}
                        >
                          <Camera className="h-4 w-4 mr-2" /> Werf Foto's
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Map */}
                  {address && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="h-4 w-4" /> Locatie
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          ref={mapContainerRef}
                          className="w-full h-64 rounded-lg overflow-hidden border border-border"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Service Ticket Creation */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wrench className="h-4 w-4" /> Naservice
                      </CardTitle>
                      <CardDescription>
                        Maak een naservice ticket aan voor dit project
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedAssignmentForTicket(currentAssignment.id);
                          setServiceTicketOpen(true);
                        }}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" /> Nieuw Service Ticket
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Upcoming installations overview */}
                  {assignments.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" /> Komende Installaties
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {assignments.map((a, idx) => (
                          <button
                            key={a.id}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              idx === currentIndex
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{a.project.name}</p>
                                <p className="text-xs text-muted-foreground">{a.project.client}</p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                {a.start_date && (
                                  <p className="text-xs font-medium">
                                    {format(parseISO(a.start_date), 'd MMM', { locale: dateFnsLocale })}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">{a.duration}d</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Photo capture dialog */}
                  <InstallationPhotoCapture
                    open={photoDialogOpen}
                    onOpenChange={setPhotoDialogOpen}
                    projectId={currentAssignment.project.id}
                    projectName={currentAssignment.project.name}
                  />

                  {/* Service Ticket Items */}
                  <ServiceTicketItemsPanel
                    open={serviceTicketOpen}
                    onOpenChange={setServiceTicketOpen}
                    projectId={currentAssignment.project.id}
                    projectName={currentAssignment.project.name}
                    assignmentId={selectedAssignmentForTicket}
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
