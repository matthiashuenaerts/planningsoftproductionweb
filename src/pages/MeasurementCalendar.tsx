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
import { ChevronLeft, ChevronRight, Ruler, Plus } from 'lucide-react';
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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newMeasurerId, setNewMeasurerId] = useState('');
  const [newStatus, setNewStatus] = useState('scheduled');
  const [newNotes, setNewNotes] = useState('');
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

      // Fetch project names
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
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name');
      return (data ?? []) as unknown as { id: string; name: string; project_number: string | null }[];
    },
    enabled: !!tenant?.id && addDialogOpen,
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
    enabled: !!tenant?.id && addDialogOpen,
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

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const openAddDialog = (date?: Date) => {
    setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '');
    setNewProjectId('');
    setNewMeasurerId('');
    setNewStatus('scheduled');
    setNewNotes('');
    setAddDialogOpen(true);
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
        tenant_id: tenant.id,
      });
      queryClient.invalidateQueries({ queryKey: ['measurement-calendar'] });
      setAddDialogOpen(false);
      toast({ title: t('measurement_added') || 'Measurement added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
              {t('new_measurement') || 'Nieuwe opmeting'}
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              <span>{t('status_scheduled') || 'Gepland'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300 border-dashed" />
              <span>{t('status_provisional') || 'Voorlopig'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
              <span>{t('status_completed') || 'Afgerond'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
              <span>{t('status_cancelled') || 'Geannuleerd'}</span>
            </div>
          </div>

          {/* Month navigation */}
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
                <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {/* Week day headers */}
                  {weekDays.map(day => (
                    <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}

                  {/* Calendar cells */}
                  {calendarDays.map(day => {
                    const dayMeasurements = getMeasurementsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "bg-background min-h-[100px] p-1.5 transition-colors group relative",
                          !isCurrentMonth && "opacity-40",
                          isToday && "ring-2 ring-primary ring-inset"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-xs font-medium",
                            isToday && "text-primary font-bold"
                          )}>
                            {format(day, 'd')}
                          </span>
                          {isCurrentMonth && (
                            <button
                              onClick={() => openAddDialog(day)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                              title={t('add_measurement') || 'Opmeting toevoegen'}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {dayMeasurements.map(m => (
                            <button
                              key={m.id}
                              onClick={() => navigate(createLocalizedPath(`/projects/${m.project_id}`))}
                              className={cn(
                                "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity",
                                statusColor(m.status)
                              )}
                              title={`${m.project_name || m.project_id} — ${m.measurer_name || ''}\n${m.status === 'provisional' ? '(Voorlopig)' : ''}`}
                            >
                              <div className="flex items-center gap-1">
                                <Ruler className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate font-medium">
                                  {m.project_number ? `${m.project_number} - ` : ''}{m.project_name || m.project_id}
                                </span>
                              </div>
                              {m.measurer_name && (
                                <div className="truncate text-[9px] opacity-75 mt-0.5">{m.measurer_name}</div>
                              )}
                            </button>
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
      </div>

      {/* Add Measurement Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new_measurement') || 'Nieuwe opmeting'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('project') || 'Project'}</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_project') || 'Selecteer project'} />
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
              <Label>{t('measurement_date') || 'Datum'}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('measurer') || 'Opmeter'}</Label>
              <Select value={newMeasurerId} onValueChange={setNewMeasurerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_measurer') || 'Selecteer opmeter'} />
                </SelectTrigger>
                <SelectContent>
                  {measurers.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('status') || 'Status'}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">{t('status_scheduled') || 'Gepland'}</SelectItem>
                  <SelectItem value="provisional">{t('status_provisional') || 'Voorlopig'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('notes') || 'Notities'}</Label>
              <Textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder={t('measurement_notes_placeholder') || 'Optionele notities...'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t('cancel') || 'Annuleren'}
            </Button>
            <Button onClick={handleSave} disabled={!newProjectId || !selectedDate || saving}>
              {saving ? '...' : t('save') || 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeasurementCalendar;
