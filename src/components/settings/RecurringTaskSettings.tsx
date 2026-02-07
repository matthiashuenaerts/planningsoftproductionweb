import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Edit, Clock, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { recurringTaskService, RecurringTaskSchedule, RecurringTaskScheduleInsert } from '@/services/recurringTaskService';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { supabase } from '@/integrations/supabase/client';
import { workstationService, Workstation } from '@/services/workstationService';

interface Employee {
  id: string;
  name: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RecurringTaskSettings: React.FC = () => {
  const [schedules, setSchedules] = useState<RecurringTaskSchedule[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringTaskSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<{
    standard_task_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    employee_ids: string[];
    workstation_id: string;
    notes: string;
  }>({
    standard_task_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
    employee_ids: [],
    workstation_id: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

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

  const openAddDialog = () => {
    setEditingSchedule(null);
    setFormData({
      standard_task_id: '',
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:00',
      employee_ids: [],
      workstation_id: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (schedule: RecurringTaskSchedule) => {
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.standard_task_id) {
      toast({ title: 'Error', description: 'Please select a standard task', variant: 'destructive' });
      return;
    }
    if (formData.employee_ids.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one employee', variant: 'destructive' });
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
        toast({ title: 'Success', description: 'Recurring task updated' });
      } else {
        await recurringTaskService.create(payload);
        toast({ title: 'Success', description: 'Recurring task created' });
      }

      setDialogOpen(false);
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
      toast({ title: 'Success', description: 'Recurring task deleted' });
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

  const getEmployeeNames = (ids: string[]) => {
    return ids
      .map(id => employees.find(e => e.id === id)?.name || 'Unknown')
      .join(', ');
  };

  const getWorkstationName = (id: string | null) => {
    if (!id) return '-';
    return workstations.find(w => w.id === id)?.name || 'Unknown';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recurring Task Schedules</h3>
            <p className="text-sm text-muted-foreground">
              Configure standard tasks that automatically get scheduled at fixed days and times during optimization.
            </p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Recurring Task
          </Button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No recurring tasks configured yet.</p>
            <p className="text-sm mt-1">Add recurring tasks to have them automatically scheduled during optimization.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Active</TableHead>
                  <TableHead>Standard Task</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Workstation</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map(schedule => (
                  <TableRow key={schedule.id} className={!schedule.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={(checked) => handleToggleActive(schedule.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{getTaskName(schedule.standard_task_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Calendar className="w-3 h-3 mr-1" />
                        {DAY_NAMES[schedule.day_of_week]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {schedule.start_time} - {schedule.end_time}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(schedule.employee_ids || []).map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {employees.find(e => e.id === id)?.name || 'Unknown'}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getWorkstationName(schedule.workstation_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {schedule.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(schedule)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Edit Recurring Task' : 'Add Recurring Task'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Standard Task */}
              <div className="space-y-2">
                <Label>Standard Task *</Label>
                <Select
                  value={formData.standard_task_id}
                  onValueChange={v => setFormData(prev => ({ ...prev, standard_task_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a standard task" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardTasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.task_number} - {task.task_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day of Week */}
              <div className="space-y-2">
                <Label>Day of Week *</Label>
                <Select
                  value={String(formData.day_of_week)}
                  onValueChange={v => setFormData(prev => ({ ...prev, day_of_week: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Workstation */}
              <div className="space-y-2">
                <Label>Workstation (optional)</Label>
                <Select
                  value={formData.workstation_id || 'none'}
                  onValueChange={v => setFormData(prev => ({ ...prev, workstation_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select workstation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific workstation</SelectItem>
                    {workstations.map(ws => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employees */}
              <div className="space-y-2">
                <Label>
                  <Users className="w-4 h-4 inline mr-1" />
                  Employees * ({formData.employee_ids.length} selected)
                </Label>
                <ScrollArea className="h-[200px] border rounded-md p-3">
                  <div className="space-y-2">
                    {employees.map(emp => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={formData.employee_ids.includes(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <label
                          htmlFor={`emp-${emp.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {emp.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default RecurringTaskSettings;
