import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { emailConfigService, EmailConfig } from '@/services/emailConfigService';
import { Mail, Lock, Server, TestTube, Save, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MailSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Omit<EmailConfig, 'id' | 'created_at' | 'updated_at'>>({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: 'Holiday System',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const existingConfig = await emailConfigService.getConfig();
      if (existingConfig) {
        setConfig({
          smtp_host: existingConfig.smtp_host,
          smtp_port: existingConfig.smtp_port,
          smtp_secure: existingConfig.smtp_secure,
          smtp_user: existingConfig.smtp_user,
          smtp_password: existingConfig.smtp_password,
          from_email: existingConfig.from_email,
          from_name: existingConfig.from_name,
        });
      }
    } catch (error) {
      console.error('Failed to load email config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.smtp_host || !config.smtp_user || !config.smtp_password || !config.from_email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      await emailConfigService.saveConfig(config);
      toast({
        title: 'Success',
        description: 'Email configuration saved successfully'
      });
    } catch (error) {
      console.error('Failed to save email config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.smtp_host || !config.smtp_user || !config.smtp_password || !config.from_email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields before testing',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      const success = await emailConfigService.testConnection(config);
      if (success) {
        toast({
          title: 'Connection Successful',
          description: 'Email configuration is working correctly'
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Could not connect with the provided settings',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to test email connection:', error);
      toast({
        title: 'Test Failed',
        description: 'An error occurred while testing the connection',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          Configure your SMTP email settings to send automated holiday request notifications.
          All emails for holiday requests will be sent using these settings.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            SMTP Server Configuration
          </CardTitle>
          <CardDescription>
            Enter your email server details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host *</Label>
              <Input
                id="smtp_host"
                placeholder="smtp.gmail.com"
                value={config.smtp_host}
                onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port *</Label>
              <Input
                id="smtp_port"
                type="number"
                placeholder="587"
                value={config.smtp_port}
                onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="smtp_secure"
              checked={config.smtp_secure}
              onCheckedChange={(checked) => setConfig({ ...config, smtp_secure: checked })}
            />
            <Label htmlFor="smtp_secure">Use SSL/TLS (port 465)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>
            Your email account credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smtp_user">Email Address *</Label>
            <Input
              id="smtp_user"
              type="email"
              placeholder="your-email@example.com"
              value={config.smtp_user}
              onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_password">Password / App Password *</Label>
            <Input
              id="smtp_password"
              type="password"
              placeholder="••••••••"
              value={config.smtp_password}
              onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              For Gmail, use an App Password instead of your regular password
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Sender Information
          </CardTitle>
          <CardDescription>
            How recipients will see the sender
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from_email">From Email Address *</Label>
            <Input
              id="from_email"
              type="email"
              placeholder="noreply@yourcompany.com"
              value={config.from_email}
              onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="from_name">From Name</Label>
            <Input
              id="from_name"
              placeholder="Holiday System"
              value={config.from_name}
              onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || saving}
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
        <Button
          onClick={handleSave}
          disabled={testing || saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MailSettings;
