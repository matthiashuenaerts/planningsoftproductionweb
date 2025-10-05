import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X, Mail } from 'lucide-react';

interface EmailConfiguration {
  id: string;
  function_name: string;
  recipient_emails: string[];
  description: string;
}

const MailSettings: React.FC = () => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EmailConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newEmails, setNewEmails] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const { data, error } = await supabase
        .from('email_configurations')
        .select('*')
        .order('function_name');

      if (error) throw error;
      setConfigs(data || []);
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

    // Simple email validation
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MailSettings;
