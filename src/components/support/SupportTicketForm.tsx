import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface SupportTicketFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

const SupportTicketForm: React.FC<SupportTicketFormProps> = ({ onCancel, onCreated }) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !currentEmployee) return;

    setSaving(true);
    try {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          created_by: currentEmployee.id,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          tenant_id: currentEmployee.tenant_id,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      // Send notification email
      await supabase.functions.invoke('send-support-notification', {
        body: { ticketId: ticket.id, type: 'new_ticket' },
      });

      toast({ title: 'Ticket created', description: 'Your support ticket has been submitted.' });
      onCreated();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="space-y-2">
        <Label>Subject</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief description of the issue"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the problem in detail..."
          rows={6}
          required
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </div>
    </form>
  );
};

export default SupportTicketForm;
