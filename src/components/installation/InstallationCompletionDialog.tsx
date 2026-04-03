import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, PartyPopper, Wrench } from 'lucide-react';

interface InstallationCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string;
  projectName: string;
  assignmentId: string;
  onCompleted: () => void;
  onServiceTicketNeeded: () => void;
}

const InstallationCompletionDialog: React.FC<InstallationCompletionDialogProps> = ({
  open, onOpenChange, taskId, projectId, projectName, assignmentId, onCompleted, onServiceTicketNeeded,
}) => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceDescription, setServiceDescription] = useState('');

  const completeTask = async () => {
    if (!currentEmployee?.id) return false;
    try {
      if (taskId) {
        await supabase.from('tasks').update({
          status: 'COMPLETED',
          completed_by: currentEmployee.id,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', taskId);

        // Close active time registration
        await supabase
          .from('time_registrations')
          .update({ end_time: new Date().toISOString(), is_active: false })
          .eq('task_id', taskId)
          .eq('employee_id', currentEmployee.id)
          .eq('is_active', true);
      }
      return true;
    } catch (err) {
      console.error('Error completing task:', err);
      return false;
    }
  };

  const updateProjectStatus = async (status: 'completed' | 'completed_with_service') => {
    try {
      await supabase
        .from('projects')
        .update({ installation_status: status, updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (err) {
      console.error('Error updating project status:', err);
    }
  };

  const sendNotification = async (type: 'installation_completed' | 'installation_service_needed', extraBody?: string) => {
    try {
      const { data: emailConfigs, error: configError } = await supabase
        .from('email_configurations')
        .select('recipient_emails')
        .eq('function_name', type)
        .eq('tenant_id', tenant?.id || '');

      if (configError) {
        console.error('Error fetching email configs:', configError);
      }

      const recipients = emailConfigs?.flatMap(c => c.recipient_emails) || [];
      
      if (recipients.length === 0) {
        console.warn('No recipients found for', type);
        toast({ 
          title: t('inst_no_recipients'), 
          description: t('inst_no_recipients_desc'),
          variant: 'destructive' 
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-installation-notification', {
        body: {
          type,
          projectName,
          projectId,
          employeeName: currentEmployee?.name || '',
          recipients,
          tenantId: tenant?.id,
          serviceDescription: extraBody || undefined,
        }
      });

      if (error) {
        console.error('Edge function invocation error:', error);
        toast({ 
          title: t('inst_email_error'), 
          description: error.message,
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      toast({ 
        title: t('inst_email_error'), 
        description: String(err),
        variant: 'destructive' 
      });
    }
  };

  const handleFullyCompleted = async () => {
    setProcessing(true);
    const success = await completeTask();
    if (success) {
      await updateProjectStatus('completed');
      await sendNotification('installation_completed');
      toast({ title: t('inst_completion_email_sent'), description: t('inst_completion_email_sent_desc') });
      onOpenChange(false);
      onCompleted();
    }
    setProcessing(false);
  };

  const handleServiceNeeded = async () => {
    if (!showServiceForm) {
      // First click: show the form
      setShowServiceForm(true);
      return;
    }
    
    // Second click: validate and submit
    if (!serviceDescription.trim()) {
      toast({ title: t('inst_service_desc_required'), variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const success = await completeTask();
    if (success) {
      await updateProjectStatus('completed_with_service');
      await sendNotification('installation_service_needed', serviceDescription);
      toast({ title: t('inst_service_email_sent'), description: t('inst_service_email_sent_desc') });
      onOpenChange(false);
      onServiceTicketNeeded();
    }
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {t('inst_completion_title')}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {t('inst_completion_question')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            className="w-full h-16 text-base bg-green-600 hover:bg-green-700"
            onClick={handleFullyCompleted}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <PartyPopper className="h-5 w-5 mr-2" />
            )}
            {t('inst_fully_completed')}
          </Button>

          {showServiceForm && (
            <div className="space-y-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <Label className="text-sm font-medium">{t('inst_service_description')}</Label>
              <Textarea
                placeholder={t('inst_service_description_placeholder')}
                value={serviceDescription}
                onChange={e => setServiceDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          <Button
            className="w-full h-16 text-base"
            variant="outline"
            onClick={handleServiceNeeded}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Wrench className="h-5 w-5 mr-2" />
            )}
            {showServiceForm ? t('inst_send_service_ticket') : t('inst_open_items')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallationCompletionDialog;
