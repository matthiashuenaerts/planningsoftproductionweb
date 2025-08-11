import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { format, parseISO } from 'date-fns';

interface EditTimeRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: any;
}

export const EditTimeRegistrationDialog: React.FC<EditTimeRegistrationDialogProps> = ({
  open,
  onOpenChange,
  registration
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    employee_id: '',
    task_id: '',
    workstation_task_id: '',
    start_time: '',
    end_time: '',
    duration_minutes: '',
    task_type: 'project'
  });

  // Initialize form data when registration changes
  useEffect(() => {
    if (registration) {
      const startTime = registration.start_time ? format(parseISO(registration.start_time), "yyyy-MM-dd'T'HH:mm") : '';
      const endTime = registration.end_time ? format(parseISO(registration.end_time), "yyyy-MM-dd'T'HH:mm") : '';
      
      setFormData({
        employee_id: registration.employee_id || '',
        task_id: registration.task_id || '',
        workstation_task_id: registration.workstation_task_id || '',
        start_time: startTime,
        end_time: endTime,
        duration_minutes: registration.duration_minutes?.toString() || '',
        task_type: registration.task_id ? 'project' : 'workstation'
      });
    }
  }, [registration]);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch project tasks
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          phases(
            id,
            name,
            projects(
              id,
              name
            )
          )
        `)
        .order('title');
      if (error) throw error;
      return data;
    }
  });

  // Fetch workstation tasks
  const { data: workstationTasks = [] } = useQuery({
    queryKey: ['workstation-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('id, task_name, task_number')
        .order('task_name');
      if (error) throw error;
      return data;
    }
  });

  const updateTimeRegistrationMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData: any = {
        employee_id: data.employee_id,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : null,
        task_id: data.task_type === 'project' ? data.task_id : null,
        workstation_task_id: data.task_type === 'workstation' ? data.workstation_task_id : null
      };

      const { data: result, error } = await supabase
        .from('time_registrations')
        .update(updateData)
        .eq('id', registration.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTimeRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['myTimeRegistrations'] });
      toast({
        title: t("success"),
        description: t("time_registration_updated_successfully"),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_to_update_time_registration"),
        variant: "destructive"
      });
    }
  });

  const deleteTimeRegistrationMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('time_registrations')
        .delete()
        .eq('id', registration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTimeRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['myTimeRegistrations'] });
      toast({
        title: t("success"),
        description: t("time_registration_deleted_successfully"),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_to_delete_time_registration"),
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_id) {
      toast({
        title: t("error"),
        description: t("please_select_employee"),
        variant: "destructive"
      });
      return;
    }

    if (formData.task_type === 'project' && !formData.task_id) {
      toast({
        title: t("error"),
        description: t("please_select_task"),
        variant: "destructive"
      });
      return;
    }

    if (formData.task_type === 'workstation' && !formData.workstation_task_id) {
      toast({
        title: t("error"),
        description: t("please_select_workstation_task"),
        variant: "destructive"
      });
      return;
    }

    if (!formData.start_time) {
      toast({
        title: t("error"),
        description: t("please_enter_start_time"),
        variant: "destructive"
      });
      return;
    }

    updateTimeRegistrationMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (window.confirm(t("confirm_delete_time_registration"))) {
      deleteTimeRegistrationMutation.mutate();
    }
  };

  // Calculate duration when start and end times are set
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      const durationMs = end.getTime() - start.getTime();
      if (durationMs > 0) {
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        setFormData(prev => ({ ...prev, duration_minutes: durationMinutes.toString() }));
      }
    }
  }, [formData.start_time, formData.end_time]);

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_time_registration")}</DialogTitle>
          <DialogDescription>
            {t("modify_time_registration_details")}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">{t("employee")}</Label>
            <Select value={formData.employee_id} onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_employee")} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-type">{t("task_type")}</Label>
            <Select value={formData.task_type} onValueChange={(value) => setFormData(prev => ({ ...prev, task_type: value, task_id: '', workstation_task_id: '' }))}>
              <SelectTrigger>
                <SelectValue placeholder={t("select_task_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">{t("project_task")}</SelectItem>
                <SelectItem value="workstation">{t("workstation_task")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.task_type === 'project' && (
            <div className="space-y-2">
              <Label htmlFor="task">{t("project_task")}</Label>
              <Select value={formData.task_id} onValueChange={(value) => setFormData(prev => ({ ...prev, task_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_task")} />
                </SelectTrigger>
                <SelectContent>
                  {projectTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.phases?.projects?.name} - {task.phases?.name} - {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.task_type === 'workstation' && (
            <div className="space-y-2">
              <Label htmlFor="workstation-task">{t("workstation_task")}</Label>
              <Select value={formData.workstation_task_id} onValueChange={(value) => setFormData(prev => ({ ...prev, workstation_task_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_workstation_task")} />
                </SelectTrigger>
                <SelectContent>
                  {workstationTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.task_number} - {task.task_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="start-time">{t("start_time")}</Label>
            <Input
              id="start-time"
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-time">{t("end_time")}</Label>
            <Input
              id="end-time"
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">{t("duration_minutes")}</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={formData.duration_minutes}
              onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
              placeholder={t("enter_duration_minutes")}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteTimeRegistrationMutation.isPending}
            >
              {deleteTimeRegistrationMutation.isPending ? t("deleting") : t("delete")}
            </Button>
            <Button type="submit" disabled={updateTimeRegistrationMutation.isPending}>
              {updateTimeRegistrationMutation.isPending ? t("updating") : t("update")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};