import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, X, Edit3, Trash2, Loader2, HeadphonesIcon, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';

interface AfterSalesTabProps {
  projectId: string;
  projectName: string;
}

interface ServiceTeam {
  id: string;
  name: string;
  color: string;
}

interface ServiceAssignment {
  id: string;
  project_id: string;
  team_id: string | null;
  team: string;
  start_date: string;
  duration: number;
  service_hours: number | null;
  service_notes: string | null;
  service_order: number | null;
  created_at: string;
}

const AfterSalesTab: React.FC<AfterSalesTabProps> = ({ projectId, projectName }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [serviceTeams, setServiceTeams] = useState<ServiceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [serviceDate, setServiceDate] = useState<Date | undefined>();
  const [serviceHours, setServiceHours] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [todos, setTodos] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load service teams
      let teamsQuery = (supabase
        .from('placement_teams')
        .select('id, name, color') as any)
        .eq('team_type', 'service')
        .eq('is_active', true)
        .order('name');
      teamsQuery = applyTenantFilter(teamsQuery, tenant?.id);
      const { data: teamsData } = await teamsQuery;
      setServiceTeams(teamsData || []);

      // Load service assignments for this project (only from service teams)
      const { data: serviceTeamIds } = await (supabase
        .from('placement_teams')
        .select('id') as any)
        .eq('team_type', 'service')
        .eq('is_active', true);
      
      const teamIds = (serviceTeamIds || []).map((t: any) => t.id);
      
      if (teamIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('project_team_assignments')
          .select('*')
          .eq('project_id', projectId)
          .in('team_id', teamIds)
          .order('start_date', { ascending: true });
        setAssignments((assignmentsData || []) as ServiceAssignment[]);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error loading after sales data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, tenant?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setSelectedTeamId('');
    setServiceDate(undefined);
    setServiceHours(2);
    setDescription('');
    setTodos(['']);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (assignment: ServiceAssignment) => {
    setEditingId(assignment.id);
    setSelectedTeamId(assignment.team_id || '');
    setServiceDate(new Date(assignment.start_date));
    setServiceHours(assignment.service_hours || 2);

    // Parse notes back to description + todos
    const notes = assignment.service_notes || '';
    const todoIndex = notes.indexOf('\nTodos:\n');
    if (todoIndex >= 0) {
      setDescription(notes.substring(0, todoIndex).trim());
      const todoSection = notes.substring(todoIndex + '\nTodos:\n'.length);
      const todoItems = todoSection.split('\n').map(line => line.replace(/^☐\s?/, '').trim()).filter(Boolean);
      setTodos(todoItems.length > 0 ? todoItems : ['']);
    } else {
      setDescription(notes);
      setTodos(['']);
    }
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('as_confirm_delete'))) return;
    try {
      await supabase.from('project_team_assignments').delete().eq('id', id);
      toast({ title: t('success'), description: t('as_deleted') });
      loadData();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const addTodo = () => setTodos([...todos, '']);
  const removeTodo = (index: number) => setTodos(todos.filter((_, i) => i !== index));
  const updateTodo = (index: number, value: string) => {
    const updated = [...todos];
    updated[index] = value;
    setTodos(updated);
  };

  const handleSubmit = async () => {
    if (!selectedTeamId || !serviceDate) {
      toast({ title: t('as_missing_fields'), description: t('as_select_team_and_date'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const team = serviceTeams.find(t => t.id === selectedTeamId);
      const dateStr = format(serviceDate, 'yyyy-MM-dd');

      // Build notes from description + todos
      const todoLines = todos.filter(t => t.trim()).map(t => `☐ ${t.trim()}`);
      const notes = [description, todoLines.length > 0 ? '\nTodos:\n' + todoLines.join('\n') : ''].filter(Boolean).join('\n');

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('project_team_assignments')
          .update({
            team_id: selectedTeamId,
            team: team?.name || '',
            start_date: dateStr,
            service_hours: serviceHours,
            service_notes: notes.trim() || null,
          } as any)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: t('success'), description: t('as_updated') });
      } else {
        // Get max service_order
        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('service_order')
          .eq('team_id', selectedTeamId)
          .eq('start_date', dateStr);
        const maxOrder = existing?.reduce((max, a) => Math.max(max, (a as any).service_order || 0), 0) || 0;

        const { error } = await supabase
          .from('project_team_assignments')
          .insert({
            project_id: projectId,
            team_id: selectedTeamId,
            team: team?.name || '',
            start_date: dateStr,
            duration: 1,
            service_hours: serviceHours,
            service_order: maxOrder + 1,
            service_notes: notes.trim() || null,
          } as any);
        if (error) throw error;
        toast({ title: t('success'), description: t('as_created') });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
          <HeadphonesIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          {t('as_title')}
        </h3>
        <Button size="sm" onClick={openCreateDialog} className="h-8 text-xs sm:text-sm rounded-xl">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('as_add_service')}
        </Button>
      </div>

      {assignments.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HeadphonesIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">{t('as_no_services')}</p>
            <Button variant="outline" size="sm" onClick={openCreateDialog} className="rounded-xl">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('as_schedule_first')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((assignment) => {
            const team = serviceTeams.find(t => t.id === assignment.team_id);
            const notes = assignment.service_notes || '';
            const todoIndex = notes.indexOf('\nTodos:\n');
            const descPart = todoIndex >= 0 ? notes.substring(0, todoIndex).trim() : notes;
            const todosPart = todoIndex >= 0
              ? notes.substring(todoIndex + '\nTodos:\n'.length).split('\n').filter(Boolean)
              : [];

            return (
              <Card key={assignment.id} className="rounded-2xl border-border/60 overflow-hidden">
                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {team && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                      )}
                      <CardTitle className="text-sm font-semibold truncate">
                        {assignment.team || t('as_unknown_team')}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(assignment)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(assignment.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="rounded-lg gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(assignment.start_date), 'dd/MM/yyyy')}
                    </Badge>
                    {assignment.service_hours && (
                      <Badge variant="outline" className="rounded-lg gap-1">
                        <Clock className="h-3 w-3" />
                        {assignment.service_hours}h
                      </Badge>
                    )}
                  </div>
                  {descPart && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{descPart}</p>
                  )}
                  {todosPart.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('as_todos')}:</p>
                      {todosPart.map((todo, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{todo.replace(/^☐\s?/, '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('as_edit_service') : t('as_add_service')}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t('as_schedule_for')} <span className="font-medium text-foreground">{projectName}</span>
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('as_service_team')} *</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
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
                  {serviceTeams.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t('as_no_teams')}</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('as_service_date')} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !serviceDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : t('as_pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={serviceDate} onSelect={setServiceDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{t('as_estimated_hours')}</Label>
              <Input type="number" min={0.5} step={0.5} value={serviceHours} onChange={e => setServiceHours(parseFloat(e.target.value) || 1)} />
            </div>

            <div className="space-y-2">
              <Label>{t('as_description')}</Label>
              <Textarea placeholder={t('as_description_placeholder')} value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>{t('as_todos')}</Label>
              {todos.map((todo, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`${t('as_todo_item')} ${index + 1}...`}
                    value={todo}
                    onChange={e => updateTodo(index, e.target.value)}
                  />
                  {todos.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeTodo(index)} className="flex-shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTodo} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> {t('as_add_todo')}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={saving || !selectedTeamId || !serviceDate}>
              {saving ? t('as_saving') : editingId ? t('as_save_changes') : t('as_schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AfterSalesTab;
