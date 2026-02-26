import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send } from 'lucide-react';
import { format } from 'date-fns';

interface SupportTicketChatProps {
  ticketId: string;
  onBack: () => void;
  isDeveloper?: boolean;
}

const SupportTicketChat: React.FC<SupportTicketChatProps> = ({ ticketId, onBack, isDeveloper = false }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { currentEmployee } = useAuth();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: ticket } = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, creator:employees!support_tickets_created_by_fkey(name)')
        .eq('id', ticketId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['support-messages', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*, sender:employees!support_messages_sender_id_fkey(name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !currentEmployee) return;
    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        sender_id: currentEmployee.id,
        sender_type: isDeveloper ? 'developer' : 'user',
        message: message.trim(),
      } as any);
      if (error) throw error;

      // If developer responds, send notification email to user
      if (isDeveloper) {
        await supabase.functions.invoke('send-support-notification', {
          body: { ticketId, type: 'developer_response' },
        });
      }

      setMessage('');
      qc.invalidateQueries({ queryKey: ['support-messages', ticketId] });
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{ticket?.subject}</p>
          <p className="text-xs text-muted-foreground">
            by {(ticket as any)?.creator?.name} · {ticket?.created_at ? format(new Date(ticket.created_at), 'dd/MM/yyyy') : ''}
          </p>
        </div>
        <Badge variant="outline" className={statusColors[ticket?.status || 'open'] || ''}>
          {ticket?.status}
        </Badge>
      </div>

      {/* Description */}
      <div className="p-3 bg-muted/50 rounded-md my-3 text-sm">
        <p className="whitespace-pre-wrap">{ticket?.description}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] max-h-[350px]">
        {messages?.map((msg: any) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_type === 'developer' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] p-2.5 rounded-lg text-sm ${
                msg.sender_type === 'developer'
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-primary/10 border border-primary/20'
              }`}
            >
              <p className="text-xs font-medium mb-1 text-muted-foreground">
                {msg.sender?.name} · {format(new Date(msg.created_at), 'dd/MM HH:mm')}
              </p>
              <p className="whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t mt-3">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={sending || !message.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SupportTicketChat;
