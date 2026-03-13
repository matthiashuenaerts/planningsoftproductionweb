import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';

interface AfterSalesServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface ServiceTeam {
  id: string;
  name: string;
  color: string;
}

const AfterSalesServiceDialog: React.FC<AfterSalesServiceDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [serviceTeams, setServiceTeams] = useState<ServiceTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [serviceDate, setServiceDate] = useState<Date | undefined>();
  const [serviceHours, setServiceHours] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [todos, setTodos] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadServiceTeams();
      // Reset form
      setSelectedTeamId('');
      setServiceDate(undefined);
      setServiceHours(2);
      setDescription('');
      setTodos(['']);
    }
  }, [isOpen]);

  const loadServiceTeams = async () => {
    let query = (supabase
      .from('placement_teams')
      .select('id, name, color') as any)
      .eq('team_type', 'service')
      .eq('is_active', true)
      .order('name');
    query = applyTenantFilter(query, tenant?.id);
    const { data } = await query;
    setServiceTeams(data || []);
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
      toast({ title: 'Missing fields', description: 'Please select a team and date.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const team = serviceTeams.find(t => t.id === selectedTeamId);
      const dateStr = format(serviceDate, 'yyyy-MM-dd');

      // Get current max service_order for this team+date
      const { data: existing } = await supabase
        .from('project_team_assignments')
        .select('service_order')
        .eq('team_id', selectedTeamId)
        .eq('start_date', dateStr);
      const maxOrder = existing?.reduce((max, a) => Math.max(max, (a as any).service_order || 0), 0) || 0;

      // Build notes from description + todos
      const todoLines = todos.filter(t => t.trim()).map(t => `☐ ${t.trim()}`);
      const notes = [description, todoLines.length > 0 ? '\nTodos:\n' + todoLines.join('\n') : ''].filter(Boolean).join('\n');

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
          is_service_ticket: true,
        } as any);

      if (error) throw error;

      // Store the service notes in project_notes or as a chat message
      if (notes.trim()) {
        await supabase.from('chat_messages').insert({
          chat_room_id: projectId,
          employee_id: (await supabase.from('employees').select('id').limit(1).single()).data?.id || '',
          message: `📋 After Sales Service scheduled:\n${notes}`,
        } as any);
      }

      toast({ title: 'Service scheduled', description: `After sales service for "${projectName}" has been scheduled on ${format(serviceDate, 'dd/MM/yyyy')}.` });
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add After Sales Service</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Schedule a service visit for <span className="font-medium text-foreground">{projectName}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Service Team */}
          <div className="space-y-2">
            <Label>Service Team *</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service team..." />
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
                  <div className="px-3 py-2 text-sm text-muted-foreground">No service teams found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Service Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !serviceDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={serviceDate}
                  onSelect={setServiceDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hours */}
          <div className="space-y-2">
            <Label>Estimated Hours</Label>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={serviceHours}
              onChange={e => setServiceHours(parseFloat(e.target.value) || 1)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the service needed..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Todos */}
          <div className="space-y-2">
            <Label>Todos</Label>
            {todos.map((todo, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Todo item ${index + 1}...`}
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
              <Plus className="h-4 w-4 mr-1" /> Add Todo
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedTeamId || !serviceDate}>
            {saving ? 'Scheduling...' : 'Schedule Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AfterSalesServiceDialog;
