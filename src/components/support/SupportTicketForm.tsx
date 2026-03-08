import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

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
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} className={isMobile ? 'h-9 px-2' : ''}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="space-y-1.5">
        <Label className={isMobile ? 'text-sm' : ''}>Subject</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief description of the issue"
          required
          className={isMobile ? 'h-10 text-sm' : ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label className={isMobile ? 'text-sm' : ''}>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className={isMobile ? 'h-10 text-sm' : ''}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-orange-500" /> High
              </span>
            </SelectItem>
            <SelectItem value="critical">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-500" /> Critical
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className={isMobile ? 'text-sm' : ''}>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the problem in detail..."
          rows={isMobile ? 4 : 6}
          required
          className={`resize-none ${isMobile ? 'text-sm' : ''}`}
        />
        <p className="text-xs text-muted-foreground">{description.length}/1000</p>
      </div>

      <div className={`flex gap-2 pt-3 border-t border-border ${isMobile ? 'flex-col' : 'justify-end'}`}>
        {isMobile ? (
          <>
            <Button type="submit" disabled={saving} className="h-10">
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : 'Submit Ticket'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="h-10">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </>
        )}
      </div>
    </form>
  );
};

export default SupportTicketForm;
