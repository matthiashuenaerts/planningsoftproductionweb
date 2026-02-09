import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Edit, Clock, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { recurringTaskService, RecurringTaskSchedule, RecurringTaskScheduleInsert } from '@/services/recurringTaskService';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';

interface Employee {
  id: string;
  name: string;
}

interface RecurringTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RecurringTasksDialog: React.FC<RecurringTasksDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<RecurringTaskSchedule[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringTaskSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    standard_task_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
    employee_ids: [] as string[],
    workstation_id: '',
    notes: '',
  });

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesData, tasksData, wsData] = await Promise.all([
        recurringTaskService.getAll(),
        standardTasksService.getAll(),
        workstationService.getAll(),
      ]);
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name')
        .order('name');
      setSchedules(schedulesData);
      setStandardTasks(tasksData);
      setEmployees(empData || []);
      setWorkstations(wsData || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingSchedule(null);
    setFormData({ standard_task_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', employee_ids: [], workstation_id: '', notes: '' });
    setEditMode(true);
  };

  const openEditForm = (schedule: RecurringTaskSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      standard_task_id: schedule.standard_task_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      employee_ids: schedule.employee_ids || [],
      workstation_id: schedule.workstation_id || '',
      notes: schedule.notes || '',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!formData.standard_task_id || formData.employee_ids.length === 0) {
      toast({ title: 'Error', description: t('timeline_fill_all_fields'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: RecurringTaskScheduleInsert = {
        standard_task_id: formData.standard_task_id,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        employee_ids: formData.employee_ids,
        workstation_id: formData.workstation_id || null,
        notes: formData.notes || null,
      };
      if (editingSchedule) {
        await recurringTaskService.update(editingSchedule.id, payload);
      } else {
        await recurringTaskService.create(payload);
      }
      setEditMode(false);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await recurringTaskService.delete(id);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await recurringTaskService.toggleActive(id, isActive);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: isActive } : s));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleEmployee = (empId: string) => {
    setFormData(prev => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(empId)
        ? prev.employee_ids.filter(id => id !== empId)
        : [...prev.employee_ids, empId],
    }));
  };

  const getTaskName = (taskId: string) => {
    const task = standardTasks.find(t => t.id === taskId);
    return task ? `${task.task_number} - ${task.task_name}` : 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('planning_recurring_tasks')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : editMode ? (
            /* Form view */
            <div className="space-y-4 p-1">
              <div className="space-y-2">
                <Label>{t('recurring_standard_task')} *</Label>
                <Select value={formData.standard_task_id} onValueChange={v => setFormData(prev => ({ ...prev, standard_task_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('recurring_select_task')} /></SelectTrigger>
                  <SelectContent>
                    {standardTasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>{task.task_number} - {task.task_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('recurring_day')} *</Label>
                <Select value={String(formData.day_of_week)} onValueChange={v => setFormData(prev => ({ ...prev, day_of_week: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('recurring_start_time')} *</Label>
                  <Input type="time" value={formData.start_time} onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('recurring_end_time')} *</Label>
                  <Input type="time" value={formData.end_time} onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('workstations')} ({t('recurring_optional')})</Label>
                <Select value={formData.workstation_id || 'none'} onValueChange={v => setFormData(prev => ({ ...prev, workstation_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {workstations.map(ws => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label><Users className="w-4 h-4 inline mr-1" />{t('recurring_employees')} * ({formData.employee_ids.length})</Label>
                <ScrollArea className="h-[150px] border rounded-md p-3">
                  <div className="space-y-2">
                    {employees.map(emp => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox id={`emp-${emp.id}`} checked={formData.employee_ids.includes(emp.id)} onCheckedChange={() => toggleEmployee(emp.id)} />
                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer">{emp.name}</label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>{t('recurring_notes')}</Label>
                <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder={t('recurring_optional')} />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditMode(false)}>{t('cancel')}</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? '...' : editingSchedule ? t('recurring_update') : t('recurring_create')}</Button>
              </div>
            </div>
          ) : (
            /* List view */
            <div className="space-y-4 p-1">
              <div className="flex justify-end">
                <Button onClick={openAddForm} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('recurring_add')}
                </Button>
              </div>

              {schedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>{t('recurring_none')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">{t('recurring_active')}</TableHead>
                        <TableHead>{t('recurring_task')}</TableHead>
                        <TableHead>{t('recurring_day')}</TableHead>
                        <TableHead>{t('recurring_time')}</TableHead>
                        <TableHead>{t('recurring_employees')}</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map(schedule => (
                        <TableRow key={schedule.id} className={!schedule.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <Switch checked={schedule.is_active} onCheckedChange={checked => handleToggleActive(schedule.id, checked)} />
                          </TableCell>
                          <TableCell className="font-medium text-sm">{getTaskName(schedule.standard_task_id)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {DAY_NAMES[schedule.day_of_week]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{schedule.start_time} - {schedule.end_time}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {(schedule.employee_ids || []).map(id => (
                                <Badge key={id} variant="secondary" className="text-[10px]">
                                  {employees.find(e => e.id === id)?.name || '?'}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditForm(schedule)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringTasksDialog;
