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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Plus, X, Edit3, Trash2, Loader2, HeadphonesIcon, Clock, CheckCircle, AlertCircle, Package, Wrench, Building2, ClipboardList } from 'lucide-react';
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
  start_date: string | null;
  duration: number;
  service_hours: number | null;
  service_notes: string | null;
  service_order: number | null;
  service_possible_week: string | null;
  created_at: string;
}

interface TicketItem {
  id: string;
  assignment_id: string;
  item_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order_article_code?: string | null;
  order_supplier?: string | null;
  order_quantity?: number | null;
}

const ITEM_TYPE_CONFIG: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  todo: { label: 'To-do', icon: ClipboardList, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  order_request: { label: 'Bestelling', icon: Package, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  production_task: { label: 'Productie', icon: Wrench, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  office_task: { label: 'Kantoor', icon: Building2, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
};

const AfterSalesTab: React.FC<AfterSalesTabProps> = ({ projectId, projectName }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [serviceTeams, setServiceTeams] = useState<ServiceTeam[]>([]);
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [serviceDate, setServiceDate] = useState<Date | undefined>();
  const [serviceHours, setServiceHours] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [todos, setTodos] = useState<string[]>(['']);
  const [possibleWeek, setPossibleWeek] = useState('');
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

      // Load service assignments for this project (only from service teams OR unassigned)
      const { data: serviceTeamIds } = await (supabase
        .from('placement_teams')
        .select('id') as any)
        .eq('team_type', 'service')
        .eq('is_active', true);
      
      const teamIds = (serviceTeamIds || []).map((t: any) => t.id);
      
      // Get assignments: those with a service team OR those with no team (unassigned after sales)
      let query = supabase
        .from('project_team_assignments')
        .select('*')
        .eq('project_id', projectId);
      
      if (teamIds.length > 0) {
        // Get assignments that are in service teams OR have no team_id (unassigned)
        query = query.or(`team_id.in.(${teamIds.join(',')}),team_id.is.null`);
      } else {
        query = query.is('team_id', null);
      }
      
      const { data: assignmentsData } = await query.order('created_at', { ascending: true });
      
      // Only show actual service tickets (is_service_ticket = true)
      const filtered = (assignmentsData || []).filter((a: any) => {
        return a.is_service_ticket === true;
      });
      setAssignments(filtered as ServiceAssignment[]);
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
    setPossibleWeek('');
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (assignment: ServiceAssignment) => {
    setEditingId(assignment.id);
    setSelectedTeamId(assignment.team_id || '');
    setServiceDate(assignment.start_date ? new Date(assignment.start_date) : undefined);
    setServiceHours(assignment.service_hours || 2);
    setPossibleWeek((assignment as any).service_possible_week || '');

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
    setSaving(true);
    try {
      const team = serviceTeams.find(t => t.id === selectedTeamId);
      const dateStr = serviceDate ? format(serviceDate, 'yyyy-MM-dd') : null;

      // Build notes from description + todos
      const todoLines = todos.filter(t => t.trim()).map(t => `☐ ${t.trim()}`);
      const notes = [description, todoLines.length > 0 ? '\nTodos:\n' + todoLines.join('\n') : ''].filter(Boolean).join('\n');

      if (editingId) {
        const { error } = await supabase
          .from('project_team_assignments')
          .update({
            team_id: selectedTeamId || null,
            team: team?.name || '',
            start_date: dateStr,
            service_hours: serviceHours,
            service_notes: notes.trim() || null,
            service_possible_week: possibleWeek.trim() || null,
          } as any)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: t('success'), description: t('as_updated') });
      } else {
        const { error } = await supabase
          .from('project_team_assignments')
          .insert({
            project_id: projectId,
            team_id: selectedTeamId || null,
            team: team?.name || '',
            start_date: dateStr,
            duration: 1,
            service_hours: serviceHours,
            service_order: 1,
            service_notes: notes.trim() || null,
            service_possible_week: possibleWeek.trim() || null,
            is_service_ticket: true,
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
            const isUnplanned = !assignment.start_date || !assignment.team_id;

            return (
              <Card key={assignment.id} className={cn("rounded-2xl border-border/60 overflow-hidden", isUnplanned && "border-orange-300 dark:border-orange-700")}>
                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {team ? (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                      )}
                      <CardTitle className="text-sm font-semibold truncate">
                        {assignment.team || t('as_no_team')}
                      </CardTitle>
                      {isUnplanned && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 dark:text-orange-400">
                          {t('as_unplanned')}
                        </Badge>
                      )}
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
                    {assignment.start_date ? (
                      <Badge variant="outline" className="rounded-lg gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(assignment.start_date), 'dd/MM/yyyy')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-lg gap-1 border-orange-300 text-orange-600 dark:text-orange-400">
                        <CalendarIcon className="h-3 w-3" />
                        {t('as_no_date')}
                      </Badge>
                    )}
                    {(assignment as any).service_possible_week && (
                      <Badge variant="secondary" className="rounded-lg gap-1 text-xs">
                        📅 {(assignment as any).service_possible_week}
                      </Badge>
                    )}
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
              <Label>{t('as_service_team')}</Label>
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
              <Label>{t('as_service_date')}</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('flex-1 justify-start text-left font-normal', !serviceDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : t('as_pick_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={serviceDate} onSelect={setServiceDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {serviceDate && (
                  <Button variant="ghost" size="icon" onClick={() => setServiceDate(undefined)} className="flex-shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('as_possible_week')}</Label>
              <Input
                placeholder={t('as_possible_week_placeholder')}
                value={possibleWeek}
                onChange={e => setPossibleWeek(e.target.value)}
              />
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
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? t('as_saving') : editingId ? t('as_save_changes') : t('as_schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AfterSalesTab;