import React, { useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Ruler, Plus, Edit3, CalendarCheck, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';
import { useToast } from '@/hooks/use-toast';
import { measurementService } from '@/services/measurementService';

interface MeasurementEntry {
  id: string;
  project_id: string;
  measurement_date: string | null;
  measurer_id: string | null;
  status: string;
  notes: string | null;
  customer_email: string | null;
  project_name?: string;
  project_number?: string;
  measurer_name?: string;
}

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

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['measurement-calendar', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('project_measurements' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .not('measurement_date', 'is', null);
      if (error) throw error;

      const entries = (data ?? []) as unknown as MeasurementEntry[];

      // Fetch project names from the projects table
      const projectIds = [...new Set(entries.map(e => e.project_id))];
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, project_number')
          .in('id', projectIds);
        const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
        entries.forEach(e => {
          const proj = projectMap.get(e.project_id);
          if (proj) {
            e.project_name = proj.name;
            e.project_number = proj.project_number;
          }
        });
      }

      // Fetch measurer names
      const measurerIds = [...new Set(entries.filter(e => e.measurer_id).map(e => e.measurer_id!))];
      if (measurerIds.length > 0) {
        const { data: employees } = await supabase
          .from('employees')
          .select('id, name')
          .in('id', measurerIds);
        const empMap = new Map((employees ?? []).map((e: any) => [e.id, e.name]));
        entries.forEach(e => {
          if (e.measurer_id) e.measurer_name = empMap.get(e.measurer_id);
        });
      }

      return entries;
    },
    enabled: !!tenant?.id,
  });

  // Projects list for the "add" dialog
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-measurement', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('projects')
        .select('id, name, project_number')
        .eq('tenant_id', tenant.id)
        .order('name');
      return (data ?? []) as unknown as { id: string; name: string; project_number: string | null }[];
    },
    enabled: !!tenant?.id && (addDialogOpen || editDialogOpen),
  });

  // Employees who can measure
  const { data: measurers = [] } = useQuery({
    queryKey: ['measurers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('tenant_id', tenant.id);
      return ((data ?? []) as any[]).filter(e => ['admin', 'manager', 'measurer'].includes(e.role));
    },
    enabled: !!tenant?.id && (addDialogOpen || editDialogOpen),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getMeasurementsForDay = (day: Date) =>
    measurements.filter(m => m.measurement_date && isSameDay(new Date(m.measurement_date), day));

  const statusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'provisional': return 'bg-amber-100 text-amber-800 border-amber-300 border-dashed';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const localizedWeekDays = lang === 'nl'
    ? ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
    : lang === 'fr'
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const openAddDialog = (date?: Date) => {
    setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '');
    setNewProjectId('');
    setNewMeasurerId('');
    setNewStatus('scheduled');
    setNewNotes('');
    setNewCustomerEmail('');
    setAddDialogOpen(true);
  };

  const openEditDialog = (m: MeasurementEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMeasurement(m);
    setNewProjectId(m.project_id);
    setSelectedDate(m.measurement_date || '');
    setNewMeasurerId(m.measurer_id || '');
    setNewStatus(m.status);
    setNewNotes(m.notes || '');
    setNewCustomerEmail(m.customer_email || '');
    setEditDialogOpen(true);
  };

  const handleScheduleDefinitive = async (m: MeasurementEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await measurementService.update(m.id, { status: 'scheduled' });
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] });
      toast({ title: t('mc_scheduled_definitively') || 'Definitief ingepland' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendOutlookMail = (m: MeasurementEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const projectName = m.project_name || m.project_id;
    const dateStr = m.measurement_date ? format(new Date(m.measurement_date), 'dd/MM/yyyy') : '';
    const measurerName = m.measurer_name || '';
    
    const subject = encodeURIComponent(
      lang === 'nl' ? `Opmeting ${projectName} - ${dateStr}` :
      lang === 'fr' ? `Mesurage ${projectName} - ${dateStr}` :
      `Measurement ${projectName} - ${dateStr}`
    );
    const body = encodeURIComponent(
      lang === 'nl'
        ? `Beste klant,\n\nHierbij bevestigen wij de opmeting voor project "${projectName}" op ${dateStr}.\n${measurerName ? `Opmeter: ${measurerName}\n` : ''}\nMet vriendelijke groeten`
        : lang === 'fr'
        ? `Cher client,\n\nNous confirmons le mesurage pour le projet "${projectName}" le ${dateStr}.\n${measurerName ? `Mesureur: ${measurerName}\n` : ''}\nCordialement`
        : `Dear customer,\n\nWe confirm the measurement for project "${projectName}" on ${dateStr}.\n${measurerName ? `Measurer: ${measurerName}\n` : ''}\nBest regards`
    );
    const email = m.customer_email || '';
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
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] });
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
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] });
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
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] });
      setEditDialogOpen(false);
      setEditingMeasurement(null);
      toast({ title: t('mc_measurement_deleted') || 'Opmeting verwijderd' });
    } catch (err: any) {
      toast({ title: t('error') || 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const MeasurementForm = ({ onSubmit, submitLabel, showDelete }: { onSubmit: () => void; submitLabel: string; showDelete?: boolean }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('project') || 'Project'}</Label>
        <Select value={newProjectId} onValueChange={setNewProjectId}>
          <SelectTrigger>
            <SelectValue placeholder={t('mc_select_project') || 'Selecteer project'} />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.project_number ? `${p.project_number} - ` : ''}{p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('mc_measurement_date') || 'Datum'}</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('mc_measurer') || 'Opmeter'}</Label>
        <Select value={newMeasurerId} onValueChange={setNewMeasurerId}>
          <SelectTrigger>
            <SelectValue placeholder={t('mc_select_measurer') || 'Selecteer opmeter'} />
          </SelectTrigger>
          <SelectContent>
            {measurers.map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('mc_customer_email') || 'E-mail klant'}</Label>
        <Input
          type="email"
          value={newCustomerEmail}
          onChange={e => setNewCustomerEmail(e.target.value)}
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
          onChange={e => setNewNotes(e.target.value)}
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
          {/* Header */}
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

          {/* Legend */}
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

          {/* Main layout: calendar + unassigned list */}
          <div className="flex gap-4">
            {/* Calendar */}
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
                    <div className="flex items-center justify-center py-20 text-muted-foreground">{t('loading') || 'Laden...'}</div>
                  ) : (
                    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                      {/* Week day headers */}
                      {localizedWeekDays.map(day => (
                        <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                          {day}
                        </div>
                      ))}

                      {/* Calendar cells */}
                      {calendarDays.map(day => {
                        const dayMeasurements = getMeasurementsForDay(day);
                        const isCurrentDay = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentMonth);

                        return (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "bg-background min-h-[100px] p-1.5 transition-colors group relative",
                              !isCurrentMonth && "opacity-40",
                              isCurrentDay && "ring-2 ring-primary ring-inset"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-xs font-medium",
                                isCurrentDay && "text-primary font-bold"
                              )}>
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
                              {dayMeasurements.map(m => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border truncate hover:opacity-80 transition-opacity relative group/item",
                                    statusColor(m.status)
                                  )}
                                >
                                  <button
                                    onClick={() => navigate(createLocalizedPath(`/projects/${m.project_id}`))}
                                    className="w-full text-left"
                                    title={`${m.project_name || m.project_id} — ${m.measurer_name || ''}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Ruler className="h-2.5 w-2.5 shrink-0" />
                                      <span className="truncate font-medium">
                                        {m.project_number ? `${m.project_number} - ` : ''}{m.project_name || '...'}
                                      </span>
                                    </div>
                                    {m.measurer_name && (
                                      <div className="truncate text-[9px] opacity-75 mt-0.5">{m.measurer_name}</div>
                                    )}
                                  </button>
                                  {/* Action buttons for provisional/all entries */}
                                  <div className="absolute top-0 right-0 opacity-0 group-hover/item:opacity-100 flex gap-0.5 bg-background/80 rounded p-0.5">
                                    <button
                                      onClick={(e) => openEditDialog(m, e)}
                                      className="p-0.5 hover:bg-muted rounded"
                                      title={t('mc_edit') || 'Bewerken'}
                                    >
                                      <Edit3 className="h-2.5 w-2.5" />
                                    </button>
                                    {m.status === 'provisional' && (
                                      <button
                                        onClick={(e) => handleScheduleDefinitive(m, e)}
                                        className="p-0.5 hover:bg-muted rounded text-blue-600"
                                        title={t('mc_schedule_definitively') || 'Definitief inplannen'}
                                      >
                                        <CalendarCheck className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => handleSendOutlookMail(m, e)}
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

            {/* Unassigned projects list (right side) */}
            <UnassignedProjectsList tenant={tenant} t={t} navigate={navigate} createLocalizedPath={createLocalizedPath} measurements={measurements} openAddDialog={openAddDialog} />
          </div>
        </div>
      </div>

      {/* Add Measurement Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mc_new_measurement') || 'Nieuwe opmeting'}</DialogTitle>
          </DialogHeader>
          <MeasurementForm onSubmit={handleSave} submitLabel={t('save') || 'Opslaan'} />
        </DialogContent>
      </Dialog>

      {/* Edit Measurement Dialog */}
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
