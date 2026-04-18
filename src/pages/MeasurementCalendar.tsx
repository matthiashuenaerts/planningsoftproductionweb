import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Ruler, Plus, Edit3, CalendarCheck, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';
import { useToast } from '@/hooks/use-toast';
import { measurementService } from '@/services/measurementService';
import { applyTenantFilter } from '@/lib/tenantQuery';

interface MeasurementEntry {
  id: string;
  project_id: string;
  measurement_date: string | null;
  measurer_id: string | null;
  status: string;
  notes: string | null;
  customer_email: string | null;
  project_name?: string;
  project_link_id?: string | null;
  measurer_name?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  project_link_id: string | null;
  client?: string | null;
  installation_date?: string | null;
  installation_status?: string | null;
}

const getProjectDisplayLabel = ({
  name,
  project_name,
  project_link_id,
  project_id,
}: {
  name?: string | null;
  project_name?: string | null;
  project_link_id?: string | null;
  project_id?: string;
}) => {
  const resolvedName = name ?? project_name ?? project_id ?? 'Unknown project';
  return project_link_id ? `${project_link_id} - ${resolvedName}` : resolvedName;
};

const UnassignedProjectsList: React.FC<{
  tenant: any;
  t: (key: string) => string;
  navigate: any;
  createLocalizedPath: (p: string) => string;
  measurements: MeasurementEntry[];
  openAddDialog: (date?: Date, projectId?: string) => void;
}> = ({ tenant, t, navigate, createLocalizedPath, measurements, openAddDialog }) => {
  const measurementProjectIdsKey = useMemo(
    () => [...new Set(measurements.map((measurement) => measurement.project_id).filter(Boolean))].sort().join('|'),
    [measurements]
  );

  const { data: unassignedProjects = [], isLoading } = useQuery({
    queryKey: ['unassigned-measurement-projects', tenant?.id, measurementProjectIdsKey],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('projects')
        .select('id, name, project_link_id, client, installation_date, installation_status')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);

      const { data, error } = await query;
      if (error) throw error;

      const projectsWithMeasurement = new Set(measurements.map((measurement) => measurement.project_id));

      return ((data ?? []) as ProjectOption[]).filter(
        (project) => project.installation_status !== 'completed' && !projectsWithMeasurement.has(project.id)
      );
    },
    enabled: !!tenant?.id,
  });

  const handleDragStart = (e: React.DragEvent, project: ProjectOption) => {
    e.dataTransfer.setData('application/measurement-project', JSON.stringify({ id: project.id, name: project.name }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-full xl:w-80 xl:flex-shrink-0 self-start xl:sticky xl:top-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {t('mc_unassigned_projects') || 'Zonder opmeting'} ({unassignedProjects.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t('loading') || 'Laden...'}</div>
        ) : unassignedProjects.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {t('mc_all_projects_assigned') || 'Alle projecten hebben een opmeting'}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto divide-y">
            {unassignedProjects.map((project) => (
              <div
                key={project.id}
                draggable
                onDragStart={(e) => handleDragStart(e, project)}
                className="px-3 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
              >
                <button
                  onClick={() => navigate(createLocalizedPath(`/projects/${project.id}`))}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-xs font-medium text-foreground truncate">
                    {getProjectDisplayLabel({
                      name: project.name,
                      project_link_id: project.project_link_id,
                      project_id: project.id,
                    })}
                  </div>
                  {project.client && (
                    <div className="text-[10px] text-muted-foreground truncate">{project.client}</div>
                  )}
                </button>
                <button
                  onClick={() => openAddDialog(undefined, project.id)}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                  title={t('mc_add_measurement') || 'Opmeting toevoegen'}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MeasurementCalendar = () => {
  const { t, lang, createLocalizedPath } = useLanguage();
  const { tenant } = useTenant();
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<MeasurementEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newMeasurerId, setNewMeasurerId] = useState('');
  const [newStatus, setNewStatus] = useState('scheduled');
  const [newNotes, setNewNotes] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const dateLocale = lang === 'nl' ? nl : lang === 'fr' ? fr : enUS;

  const refreshMeasurementQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] }),
      queryClient.invalidateQueries({ queryKey: ['unassigned-measurement-projects'] }),
    ]);
  };

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['measurement-calendar', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let measurementsQuery = supabase
        .from('project_measurements' as any)
        .select('*')
        .not('measurement_date', 'is', null)
        .order('measurement_date', { ascending: true });
      measurementsQuery = applyTenantFilter(measurementsQuery, tenant?.id);

      const { data, error } = await measurementsQuery;
      if (error) throw error;

      const entries = ((data ?? []) as unknown as MeasurementEntry[]).map((entry) => ({ ...entry }));
      const projectIds = [...new Set(entries.map((entry) => entry.project_id).filter(Boolean))];

      if (projectIds.length > 0) {
        let projectsQuery = supabase
          .from('projects')
          .select('id, name, project_link_id')
          .in('id', projectIds);
        projectsQuery = applyTenantFilter(projectsQuery, tenant?.id);

        const { data: projectsData, error: projectsError } = await projectsQuery;
        if (projectsError) throw projectsError;

        const projectMap = new Map((projectsData ?? []).map((project: any) => [project.id, project]));

        entries.forEach((entry) => {
          const project = projectMap.get(entry.project_id);
          entry.project_name = project?.name || entry.project_id;
          entry.project_link_id = project?.project_link_id ?? null;
        });
      }

      const measurerIds = [...new Set(entries.filter((entry) => entry.measurer_id).map((entry) => entry.measurer_id!))];
      if (measurerIds.length > 0) {
        let employeesQuery = supabase
          .from('employees')
          .select('id, name')
          .in('id', measurerIds);
        employeesQuery = applyTenantFilter(employeesQuery, tenant?.id);

        const { data: employees, error: employeesError } = await employeesQuery;
        if (employeesError) throw employeesError;

        const employeeMap = new Map((employees ?? []).map((employee: any) => [employee.id, employee.name]));
        entries.forEach((entry) => {
          if (entry.measurer_id) {
            entry.measurer_name = employeeMap.get(entry.measurer_id);
          }
        });
      }

      return entries;
    },
    enabled: !!tenant?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-measurement', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('projects')
        .select('id, name, project_link_id')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []) as ProjectOption[];
    },
    enabled: !!tenant?.id && (addDialogOpen || editDialogOpen),
  });

  const { data: measurers = [] } = useQuery({
    queryKey: ['measurers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('employees')
        .select('id, name, role');
      query = applyTenantFilter(query, tenant?.id);

      const { data, error } = await query;
      if (error) throw error;

      return ((data ?? []) as any[]).filter((employee) => ['admin', 'manager', 'measurer'].includes(employee.role));
    },
    enabled: !!tenant?.id && (addDialogOpen || editDialogOpen),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getMeasurementsForDay = (day: Date) =>
    measurements.filter((measurement) => measurement.measurement_date && isSameDay(new Date(measurement.measurement_date), day));

  const statusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'provisional':
        return 'bg-amber-100 text-amber-800 border-amber-300 border-dashed';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const localizedWeekDays =
    lang === 'nl'
      ? ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
      : lang === 'fr'
        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const openAddDialog = (date?: Date, projectId?: string) => {
    setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '');
    setNewProjectId(projectId ?? '');
    setNewMeasurerId('');
    setNewStatus('scheduled');
    setNewNotes('');
    setNewCustomerEmail('');
    setAddDialogOpen(true);
  };

  const openEditDialog = (measurement: MeasurementEntry, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingMeasurement(measurement);
    setNewProjectId(measurement.project_id);
    setSelectedDate(measurement.measurement_date || '');
    setNewMeasurerId(measurement.measurer_id || '');
    setNewStatus(measurement.status);
    setNewNotes(measurement.notes || '');
    setNewCustomerEmail(measurement.customer_email || '');
    setEditDialogOpen(true);
  };

  const handleScheduleDefinitive = async (measurement: MeasurementEntry, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await measurementService.update(measurement.id, { status: 'scheduled' });
      await refreshMeasurementQueries();
      toast({ title: t('mc_scheduled_definitively') || 'Definitief ingepland' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendOutlookMail = (measurement: MeasurementEntry, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectName = getProjectDisplayLabel({
      project_name: measurement.project_name,
      project_link_id: measurement.project_link_id,
      project_id: measurement.project_id,
    });
    const dateStr = measurement.measurement_date ? format(new Date(measurement.measurement_date), 'dd/MM/yyyy') : '';
    const measurerName = measurement.measurer_name || '';

    const subject = encodeURIComponent(
      lang === 'nl'
        ? `Opmeting ${projectName} - ${dateStr}`
        : lang === 'fr'
          ? `Mesurage ${projectName} - ${dateStr}`
          : `Measurement ${projectName} - ${dateStr}`
    );
    const body = encodeURIComponent(
      lang === 'nl'
        ? `Beste klant,\n\nHierbij bevestigen wij de opmeting voor project "${projectName}" op ${dateStr}.\n${measurerName ? `Opmeter: ${measurerName}\n` : ''}\nMet vriendelijke groeten`
        : lang === 'fr'
          ? `Cher client,\n\nNous confirmons le mesurage pour le projet "${projectName}" le ${dateStr}.\n${measurerName ? `Mesureur: ${measurerName}\n` : ''}\nCordialement`
          : `Dear customer,\n\nWe confirm the measurement for project "${projectName}" on ${dateStr}.\n${measurerName ? `Measurer: ${measurerName}\n` : ''}\nBest regards`
    );
    const email = measurement.customer_email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSave = async () => {
    if (!newProjectId || !selectedDate || !tenant?.id) return;
    setSaving(true);
    try {
      await measurementService.create({
        project_id: newProjectId,
        measurement_date: selectedDate,
        measurer_id: newMeasurerId || null,
        status: newStatus,
        notes: newNotes || null,
        customer_email: newCustomerEmail || null,
        tenant_id: tenant.id,
      });
      await refreshMeasurementQueries();
      setAddDialogOpen(false);
      toast({ title: t('mc_measurement_added') || 'Opmeting toegevoegd' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingMeasurement || !newProjectId || !selectedDate) return;
    setSaving(true);
    try {
      await measurementService.update(editingMeasurement.id, {
        project_id: newProjectId,
        measurement_date: selectedDate,
        measurer_id: newMeasurerId || null,
        status: newStatus,
        notes: newNotes || null,
        customer_email: newCustomerEmail || null,
      });
      await refreshMeasurementQueries();
      setEditDialogOpen(false);
      setEditingMeasurement(null);
      toast({ title: t('mc_measurement_updated') || 'Opmeting bijgewerkt' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingMeasurement) return;
    try {
      await measurementService.delete(editingMeasurement.id);
      await refreshMeasurementQueries();
      setEditDialogOpen(false);
      setEditingMeasurement(null);
      toast({ title: t('mc_measurement_deleted') || 'Opmeting verwijderd' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const MeasurementForm = ({
    onSubmit,
    submitLabel,
    showDelete,
  }: {
    onSubmit: () => void;
    submitLabel: string;
    showDelete?: boolean;
  }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('project') || 'Project'}</Label>
        <Select value={newProjectId} onValueChange={setNewProjectId}>
          <SelectTrigger>
            <SelectValue placeholder={t('mc_select_project') || 'Selecteer project'} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {getProjectDisplayLabel({
                  name: project.name,
                  project_link_id: project.project_link_id,
                  project_id: project.id,
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('mc_measurement_date') || 'Datum'}</Label>
        <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>{t('mc_measurer') || 'Opmeter'}</Label>
        <Select value={newMeasurerId} onValueChange={setNewMeasurerId}>
          <SelectTrigger>
            <SelectValue placeholder={t('mc_select_measurer') || 'Selecteer opmeter'} />
          </SelectTrigger>
          <SelectContent>
            {measurers.map((employee: any) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('mc_customer_email') || 'E-mail klant'}</Label>
        <Input
          type="email"
          value={newCustomerEmail}
          onChange={(event) => setNewCustomerEmail(event.target.value)}
          placeholder={t('mc_customer_email_placeholder') || 'klant@voorbeeld.be'}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('status') || 'Status'}</Label>
        <Select value={newStatus} onValueChange={setNewStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">{t('mc_status_scheduled') || 'Gepland'}</SelectItem>
            <SelectItem value="provisional">{t('mc_status_provisional') || 'Voorlopig'}</SelectItem>
            <SelectItem value="completed">{t('mc_status_completed') || 'Afgerond'}</SelectItem>
            <SelectItem value="cancelled">{t('mc_status_cancelled') || 'Geannuleerd'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('notes') || 'Notities'}</Label>
        <Textarea
          value={newNotes}
          onChange={(event) => setNewNotes(event.target.value)}
          placeholder={t('mc_notes_placeholder') || 'Optionele notities...'}
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        {showDelete && (
          <Button variant="destructive" onClick={handleDelete} type="button" className="mr-auto">
            {t('delete') || 'Verwijderen'}
          </Button>
        )}
        <Button onClick={onSubmit} disabled={!newProjectId || !selectedDate || saving} className={showDelete ? '' : 'w-full'}>
          {saving ? '...' : submitLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {!drawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {drawerLayout && <Navbar />}
      <div className={`w-full ${!drawerLayout ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                {t('measurement_calendar') || 'Opmeetkalender'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('measurement_calendar_desc') || 'Overzicht van alle geplande inmetingen'}
              </p>
            </div>
            <Button onClick={() => openAddDialog()} className="rounded-xl">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('mc_new_measurement') || 'Nieuwe opmeting'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              <span>{t('mc_status_scheduled') || 'Gepland'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300 border-dashed" />
              <span>{t('mc_status_provisional') || 'Voorlopig'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
              <span>{t('mc_status_completed') || 'Afgerond'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
              <span>{t('mc_status_cancelled') || 'Geannuleerd'}</span>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <CardTitle className="text-lg capitalize">
                      {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground">
                      {t('loading') || 'Laden...'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {localizedWeekDays.map((day) => (
                        <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                          {day}
                        </div>
                      ))}

                      {calendarDays.map((day) => {
                        const dayMeasurements = getMeasurementsForDay(day);
                        const isCurrentDay = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentMonth);

                        const handleDragOver = (e: React.DragEvent) => {
                          if (
                            e.dataTransfer.types.includes('application/measurement-project') ||
                            e.dataTransfer.types.includes('application/measurement-entry')
                          ) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        };

                        const handleDrop = async (e: React.DragEvent) => {
                          e.preventDefault();
                          const dropDate = format(day, 'yyyy-MM-dd');

                          // Existing measurement → move to this day
                          const moveData = e.dataTransfer.getData('application/measurement-entry');
                          if (moveData) {
                            try {
                              const entry = JSON.parse(moveData) as { id: string; current_date: string };
                              if (entry.current_date === dropDate) return;
                              await measurementService.update(entry.id, { measurement_date: dropDate });
                              await refreshMeasurementQueries();
                              toast({ title: t('mc_measurement_updated') || 'Opmeting verplaatst' });
                            } catch (err: any) {
                              toast({ title: t('error') || 'Error', description: err?.message, variant: 'destructive' });
                            }
                            return;
                          }

                          // New project from sidebar → open the add dialog
                          const data = e.dataTransfer.getData('application/measurement-project');
                          if (!data) return;
                          try {
                            const project = JSON.parse(data);
                            openAddDialog(day, project.id);
                          } catch {}
                        };

                        return (
                          <div
                            key={day.toISOString()}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={cn(
                              'bg-background min-h-[100px] p-1.5 transition-colors group relative',
                              !isCurrentMonth && 'opacity-40',
                              isCurrentDay && 'ring-2 ring-primary ring-inset'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className={cn('text-xs font-medium', isCurrentDay && 'text-primary font-bold')}>
                                {format(day, 'd')}
                              </span>
                              {isCurrentMonth && (
                                <button
                                  onClick={() => openAddDialog(day)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                  title={t('mc_add_measurement') || 'Opmeting toevoegen'}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {dayMeasurements.map((measurement) => (
                                <div
                                  key={measurement.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData(
                                      'application/measurement-entry',
                                      JSON.stringify({ id: measurement.id, current_date: measurement.measurement_date }),
                                    );
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  className={cn(
                                    'w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border truncate hover:opacity-80 transition-opacity relative group/item cursor-grab active:cursor-grabbing',
                                    statusColor(measurement.status)
                                  )}
                                >
                                  <button
                                    onClick={() => navigate(createLocalizedPath(`/projects/${measurement.project_id}`))}
                                    className="w-full text-left"
                                    title={`${measurement.project_name || measurement.project_id} — ${measurement.measurer_name || ''}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Ruler className="h-2.5 w-2.5 shrink-0" />
                                      <span className="truncate font-medium">
                                        {getProjectDisplayLabel({
                                          project_name: measurement.project_name,
                                          project_link_id: measurement.project_link_id,
                                          project_id: measurement.project_id,
                                        })}
                                      </span>
                                    </div>
                                    {measurement.measurer_name && (
                                      <div className="truncate text-[9px] opacity-75 mt-0.5">{measurement.measurer_name}</div>
                                    )}
                                  </button>
                                  <div className="absolute top-0 right-0 opacity-0 group-hover/item:opacity-100 flex gap-0.5 bg-background/80 rounded p-0.5">
                                    <button
                                      onClick={(event) => openEditDialog(measurement, event)}
                                      className="p-0.5 hover:bg-muted rounded"
                                      title={t('mc_edit') || 'Bewerken'}
                                    >
                                      <Edit3 className="h-2.5 w-2.5" />
                                    </button>
                                    {measurement.status === 'provisional' && (
                                      <button
                                        onClick={(event) => handleScheduleDefinitive(measurement, event)}
                                        className="p-0.5 hover:bg-muted rounded text-blue-600"
                                        title={t('mc_schedule_definitively') || 'Definitief inplannen'}
                                      >
                                        <CalendarCheck className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(event) => handleSendOutlookMail(measurement, event)}
                                      className="p-0.5 hover:bg-muted rounded text-primary"
                                      title={t('mc_send_mail') || 'Mail versturen via Outlook'}
                                    >
                                      <Mail className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <UnassignedProjectsList
              tenant={tenant}
              t={t}
              navigate={navigate}
              createLocalizedPath={createLocalizedPath}
              measurements={measurements}
              openAddDialog={openAddDialog}
            />
          </div>
        </div>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mc_new_measurement') || 'Nieuwe opmeting'}</DialogTitle>
          </DialogHeader>
          <MeasurementForm onSubmit={handleSave} submitLabel={t('save') || 'Opslaan'} />
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mc_edit_measurement') || 'Opmeting bewerken'}</DialogTitle>
          </DialogHeader>
          <MeasurementForm onSubmit={handleUpdate} submitLabel={t('mc_save_changes') || 'Wijzigingen opslaan'} showDelete />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeasurementCalendar;
