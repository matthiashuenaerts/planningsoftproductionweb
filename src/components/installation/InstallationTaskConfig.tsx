import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, X, Loader2 } from 'lucide-react';

const InstallationTaskConfig: React.FC = () => {
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [standardTasks, setStandardTasks] = useState<{ id: string; name: string }[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Email configs
  const [completionEmails, setCompletionEmails] = useState<string[]>([]);
  const [serviceEmails, setServiceEmails] = useState<string[]>([]);
  const [newCompletionEmail, setNewCompletionEmail] = useState('');
  const [newServiceEmail, setNewServiceEmail] = useState('');

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      // Load standard tasks
      const query = supabase.from('standard_tasks').select('id, task_name').order('task_name');
      const { data: tasks } = await applyTenantFilter(query, tenant.id);
      setStandardTasks((tasks || []).map(t => ({ id: t.id, name: t.task_name })));

      // Load current setting from tenant settings
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant.id)
        .single();

      const settings = (tenantData?.settings as any) || {};
      setSelectedTaskId(settings.installation_standard_task_id || '');

      // Load email configs
      const { data: emailConfigs } = await supabase
        .from('email_configurations')
        .select('function_name, recipient_emails')
        .eq('tenant_id', tenant.id)
        .in('function_name', ['installation_completed', 'installation_service_needed']);

      for (const config of emailConfigs || []) {
        if (config.function_name === 'installation_completed') {
          setCompletionEmails(config.recipient_emails || []);
        } else if (config.function_name === 'installation_service_needed') {
          setServiceEmails(config.recipient_emails || []);
        }
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveTaskSetting = async (taskId: string) => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenant.id)
        .single();

      const settings = (tenantData?.settings as any) || {};
      settings.installation_standard_task_id = taskId || null;

      await supabase
        .from('tenants')
        .update({ settings })
        .eq('id', tenant.id);

      setSelectedTaskId(taskId);
      toast({ title: t('inst_task_saved'), description: t('inst_task_saved_desc') });
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveEmailConfig = async (functionName: string, emails: string[]) => {
    if (!tenant?.id) return;
    try {
      // Upsert
      const { data: existing } = await supabase
        .from('email_configurations')
        .select('id')
        .eq('function_name', functionName)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('email_configurations')
          .update({ recipient_emails: emails, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('email_configurations').insert({
          function_name: functionName,
          tenant_id: tenant.id,
          recipient_emails: emails,
          description: functionName === 'installation_completed' ? 'Installation completion notifications' : 'Installation service ticket notifications',
        });
      }

      toast({ title: t('inst_email_saved') });
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    }
  };

  const addEmail = async (type: 'completion' | 'service') => {
    const email = type === 'completion' ? newCompletionEmail : newServiceEmail;
    if (!email || !email.includes('@')) return;

    if (type === 'completion') {
      const updated = [...completionEmails, email];
      setCompletionEmails(updated);
      setNewCompletionEmail('');
      await saveEmailConfig('installation_completed', updated);
    } else {
      const updated = [...serviceEmails, email];
      setServiceEmails(updated);
      setNewServiceEmail('');
      await saveEmailConfig('installation_service_needed', updated);
    }
  };

  const removeEmail = async (type: 'completion' | 'service', email: string) => {
    if (type === 'completion') {
      const updated = completionEmails.filter(e => e !== email);
      setCompletionEmails(updated);
      await saveEmailConfig('installation_completed', updated);
    } else {
      const updated = serviceEmails.filter(e => e !== email);
      setServiceEmails(updated);
      await saveEmailConfig('installation_service_needed', updated);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> {t('inst_configure_task')}
          </CardTitle>
          <CardDescription>{t('inst_configure_task_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTaskId} onValueChange={saveTaskSetting} disabled={saving}>
            <SelectTrigger>
              <SelectValue placeholder={t('inst_select_task')} />
            </SelectTrigger>
            <SelectContent>
              {standardTasks.map(task => (
                <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Completion email config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('inst_completion_email_config')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {completionEmails.map(email => (
            <div key={email} className="flex items-center gap-2">
              <span className="text-sm flex-1">{email}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEmail('completion', email)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder={t('inst_email_placeholder')}
              value={newCompletionEmail}
              onChange={e => setNewCompletionEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail('completion')}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={() => addEmail('completion')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service email config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('inst_service_email_config')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {serviceEmails.map(email => (
            <div key={email} className="flex items-center gap-2">
              <span className="text-sm flex-1">{email}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEmail('service', email)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder={t('inst_email_placeholder')}
              value={newServiceEmail}
              onChange={e => setNewServiceEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail('service')}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={() => addEmail('service')}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallationTaskConfig;
