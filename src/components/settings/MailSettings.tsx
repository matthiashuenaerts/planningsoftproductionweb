import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X, Mail, Clock, Calendar, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface EmailConfiguration {
  id: string;
  function_name: string;
  recipient_emails: string[];
  description: string;
  language: string | null;
}

interface ScheduleConfig {
  id: string;
  function_name: string;
  schedule_day: string;
  schedule_time: string;
  timezone: string;
  forecast_weeks: number;
  is_active: boolean;
  language: string;
}

const MailSettings: React.FC = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EmailConfiguration[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<{ [key: string]: ScheduleConfig }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [newEmails, setNewEmails] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      let query = supabase
        .from('email_configurations')
        .select('*')
        .order('function_name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;

      if (error) throw error;
      setConfigs(data || []);

      // Fetch schedule configurations
      let schedQuery = supabase
        .from('email_schedule_configs')
        .select('*');
      schedQuery = applyTenantFilter(schedQuery, tenant?.id);
      const { data: schedules, error: schedError } = await schedQuery;

      if (schedError) throw schedError;
      
      const scheduleMap: { [key: string]: ScheduleConfig } = {};
      (schedules || []).forEach(schedule => {
        scheduleMap[schedule.function_name] = schedule;
      });
      setScheduleConfigs(scheduleMap);
    } catch (error) {
      console.error('Error fetching email configurations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async (configId: string, functionName: string) => {
    const email = newEmails[configId]?.trim();
    if (!email) return;

    // More permissive email validation
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address (e.g., user@example.com)',
        variant: 'destructive',
      });
      return;
    }

    setSaving(configId);
    try {
      const config = configs.find(c => c.id === configId);
      if (!config) return;

      const updatedEmails = [...config.recipient_emails, email];

      const { error } = await supabase
        .from('email_configurations')
        .update({ recipient_emails: updatedEmails })
        .eq('id', configId);

      if (error) throw error;

      setConfigs(prev =>
        prev.map(c => c.id === configId ? { ...c, recipient_emails: updatedEmails } : c)
      );
      setNewEmails(prev => ({ ...prev, [configId]: '' }));

      toast({
        title: 'Success',
        description: 'Email address added successfully',
      });
    } catch (error) {
      console.error('Error adding email:', error);
      toast({
        title: 'Error',
        description: 'Failed to add email address',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveEmail = async (configId: string, emailToRemove: string) => {
    setSaving(configId);
    try {
      const config = configs.find(c => c.id === configId);
      if (!config) return;

      const updatedEmails = config.recipient_emails.filter(e => e !== emailToRemove);

      const { error } = await supabase
        .from('email_configurations')
        .update({ recipient_emails: updatedEmails })
        .eq('id', configId);

      if (error) throw error;

      setConfigs(prev =>
        prev.map(c => c.id === configId ? { ...c, recipient_emails: updatedEmails } : c)
      );

      toast({
        title: 'Success',
        description: 'Email address removed successfully',
      });
    } catch (error) {
      console.error('Error removing email:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove email address',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateSchedule = async (functionName: string, field: string, value: any) => {
    try {
      const schedule = scheduleConfigs[functionName];
      if (!schedule) return;

      const { error } = await supabase
        .from('email_schedule_configs')
        .update({ [field]: value })
        .eq('function_name', functionName);

      if (error) throw error;

      setScheduleConfigs(prev => ({
        ...prev,
        [functionName]: { ...prev[functionName], [field]: value }
      }));

      toast({
        title: 'Success',
        description: 'Schedule updated successfully',
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateLanguage = async (configId: string, language: string) => {
    setSaving(configId);
    try {
      const { error } = await supabase
        .from('email_configurations')
        .update({ language })
        .eq('id', configId);

      if (error) throw error;

      setConfigs(prev =>
        prev.map(c => c.id === configId ? { ...c, language } : c)
      );

      toast({
        title: 'Success',
        description: 'Language updated successfully',
      });
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: 'Error',
        description: 'Failed to update language',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleTriggerEmail = async (functionName: string) => {
    setTriggering(functionName);
    try {
      const { data, error } = await supabase.functions.invoke(functionName.replace(/_/g, '-'), {
        body: { tenantId: tenant?.id },
      });

      if (error) throw error;

      toast({
        title: 'Email Sent',
        description: data?.projectCount 
          ? `Successfully sent forecast for ${data.projectCount} project(s) to ${data.recipients} recipient(s)`
          : 'Email sent successfully',
      });
    } catch (error) {
      console.error('Error triggering email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send email. Please check the logs for details.',
        variant: 'destructive',
      });
    } finally {
      setTriggering(null);
    }
  };

  const createDefaultConfigs = async () => {
    if (!tenant?.id) return;
    try {
      const defaults = [
        { function_name: 'holiday_request', description: 'Email addresses to notify when a new holiday request is created', recipient_emails: [], language: 'nl' },
        { function_name: 'holiday_status', description: 'Email addresses to notify when a holiday request status changes', recipient_emails: [], language: 'nl' },
        { function_name: 'send_project_forecast', description: 'Weekly project forecast with installation dates and undelivered orders', recipient_emails: [], language: 'nl' },
      ];

      const { data, error } = await supabase
        .from('email_configurations')
        .insert(defaults)
        .select();

      if (error) throw error;
      setConfigs(data || []);

      // Create default schedule config for project forecast
      await supabase
        .from('email_schedule_configs')
        .insert({
          function_name: 'send_project_forecast',
          schedule_day: 'monday',
          schedule_time: '08:00',
          forecast_weeks: 4,
          is_active: false,
          language: 'nl',
          timezone: 'Europe/Brussels',
          tenant_id: tenant.id,
        });

      // Refetch to get schedule configs
      await fetchConfigurations();

      toast({
        title: 'Success',
        description: 'Default email configurations created',
      });
    } catch (error) {
      console.error('Error creating default configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to create default email configurations',
        variant: 'destructive',
      });
    }
  };

  // Auto-create default configs for new tenants if none exist
  useEffect(() => {
    if (!loading && configs.length === 0 && tenant?.id) {
      createDefaultConfigs();
    }
  }, [loading, configs.length, tenant?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Manage email recipients for different system notifications
        </p>
      </div>

      {configs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Configurations</h3>
            <p className="text-muted-foreground mb-4">
              Set up default email configurations for holiday requests and project forecasts.
            </p>
            <Button onClick={createDefaultConfigs}>
              <Plus className="h-4 w-4 mr-2" />
              Create Default Configurations
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {config.function_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing emails */}
              <div className="space-y-2">
                <Label>Current Recipients</Label>
                {config.recipient_emails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recipients configured</p>
                ) : (
                  <div className="space-y-2">
                    {config.recipient_emails.map((email, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-muted rounded-md px-3 py-2"
                      >
                        <span className="text-sm font-mono">{email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEmail(config.id, email)}
                          disabled={saving === config.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new email */}
              <div className="space-y-2">
                <Label htmlFor={`email-${config.id}`}>Add New Recipient</Label>
                <div className="flex gap-2">
                  <Input
                    id={`email-${config.id}`}
                    type="email"
                    placeholder="email@example.com"
                    value={newEmails[config.id] || ''}
                    onChange={(e) =>
                      setNewEmails(prev => ({ ...prev, [config.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail(config.id, config.function_name);
                      }
                    }}
                  />
                  <Button
                    onClick={() => handleAddEmail(config.id, config.function_name)}
                    disabled={saving === config.id || !newEmails[config.id]}
                  >
                    {saving === config.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Language configuration for holiday functions */}
              {(config.function_name === 'holiday_request' || config.function_name === 'holiday_status') && (
                <div className="space-y-2 mt-4 pt-4 border-t">
                  <Label>Email Language</Label>
                  <Select
                    value={config.language || 'nl'}
                    onValueChange={(value) => handleUpdateLanguage(config.id, value)}
                    disabled={saving === config.id}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nl">Nederlands</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Schedule configuration for project forecast */}
              {config.function_name === 'send_project_forecast' && scheduleConfigs[config.function_name] && (
                <div className="space-y-4 mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schedule Configuration
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={scheduleConfigs[config.function_name].is_active}
                          onCheckedChange={(checked) => handleUpdateSchedule(config.function_name, 'is_active', checked)}
                        />
                        <Label className="text-sm font-normal">
                          {scheduleConfigs[config.function_name].is_active ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                      <Button
                        onClick={() => handleTriggerEmail(config.function_name)}
                        disabled={triggering === config.function_name}
                        variant="outline"
                        size="sm"
                      >
                        {triggering === config.function_name ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Now
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select
                        value={scheduleConfigs[config.function_name].schedule_day}
                        onValueChange={(value) => handleUpdateSchedule(config.function_name, 'schedule_day', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monday">Monday</SelectItem>
                          <SelectItem value="tuesday">Tuesday</SelectItem>
                          <SelectItem value="wednesday">Wednesday</SelectItem>
                          <SelectItem value="thursday">Thursday</SelectItem>
                          <SelectItem value="friday">Friday</SelectItem>
                          <SelectItem value="saturday">Saturday</SelectItem>
                          <SelectItem value="sunday">Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={scheduleConfigs[config.function_name].schedule_time}
                        onChange={(e) => handleUpdateSchedule(config.function_name, 'schedule_time', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Forecast Weeks</Label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={scheduleConfigs[config.function_name].forecast_weeks}
                        onChange={(e) => handleUpdateSchedule(config.function_name, 'forecast_weeks', parseInt(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={scheduleConfigs[config.function_name].language}
                        onValueChange={(value) => handleUpdateSchedule(config.function_name, 'language', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nl">Nederlands</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select
                        value={scheduleConfigs[config.function_name].timezone || 'Europe/Brussels'}
                        onValueChange={(value) => handleUpdateSchedule(config.function_name, 'timezone', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Europe/Brussels">Europe/Brussels (CET)</SelectItem>
                          <SelectItem value="Europe/Amsterdam">Europe/Amsterdam (CET)</SelectItem>
                          <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                          <SelectItem value="Europe/Berlin">Europe/Berlin (CET)</SelectItem>
                          <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                          <SelectItem value="America/Chicago">America/Chicago (CST)</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los Angeles (PST)</SelectItem>
                          <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Email will be sent every {scheduleConfigs[config.function_name].schedule_day} at {scheduleConfigs[config.function_name].schedule_time} ({scheduleConfigs[config.function_name].timezone || 'Europe/Brussels'})
                      with a {scheduleConfigs[config.function_name].forecast_weeks}-week forecast
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MailSettings;
