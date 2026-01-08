import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { format, parseISO } from 'date-fns';
import { User, Briefcase, Clock, Trash2 } from 'lucide-react';

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

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  // Initialize form data when registration changes
  useEffect(() => {
    if (registration) {
      setStartTime(registration.start_time ? format(parseISO(registration.start_time), "yyyy-MM-dd'T'HH:mm") : '');
      setEndTime(registration.end_time ? format(parseISO(registration.end_time), "yyyy-MM-dd'T'HH:mm") : '');
      setDurationMinutes(registration.duration_minutes?.toString() || '');
    }
  }, [registration]);

  // Calculate duration when start and end times change
  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationMs = end.getTime() - start.getTime();
      if (durationMs > 0) {
        setDurationMinutes(Math.floor(durationMs / (1000 * 60)).toString());
      }
    }
  }, [startTime, endTime]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('time_registrations')
        .update({
          start_time: startTime,
          end_time: endTime || null,
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
        })
        .eq('id', registration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTimeRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['myTimeRegistrations'] });
      toast({ title: t("success"), description: t("time_registration_updated_successfully") });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
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
      toast({ title: t("success"), description: t("time_registration_deleted_successfully") });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) {
      toast({ title: t("error"), description: t("please_enter_start_time"), variant: "destructive" });
      return;
    }
    updateMutation.mutate();
  };

  const handleDelete = () => {
    if (window.confirm(t("confirm_delete_time_registration"))) {
      deleteMutation.mutate();
    }
  };

  if (!registration) return null;

  // Get display info
  const employeeName = registration.employees?.name || t("unknown_employee");
  const projectName = registration.tasks?.phases?.projects?.name || 
    (registration.workstation_tasks?.workstations ? `${t("workstation_prefix")}${registration.workstation_tasks.workstations.name}` : t("unknown_project"));
  const taskName = registration.tasks?.title || registration.workstation_tasks?.task_name || t("unknown_task");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("edit_time_registration")}</DialogTitle>
        </DialogHeader>
        
        {/* Read-only info display */}
        <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{employeeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span>{projectName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{taskName}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-time" className="text-xs">{t("start_time")}</Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-time" className="text-xs">{t("end_time")}</Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-xs">{t("duration_minutes")}</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder={t("enter_duration_minutes")}
              className="text-sm"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button 
              type="button" 
              variant="destructive" 
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t("updating") : t("save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};