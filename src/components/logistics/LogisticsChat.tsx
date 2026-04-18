import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { logisticsChatService, LogisticsChatMessage } from '@/services/logisticsChatService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initials = (name?: string) =>
  (name ?? '?')
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const LogisticsChat: React.FC<Props> = ({ open, onOpenChange }) => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [messages, setMessages] = useState<LogisticsChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !tenant?.id) return;
    let cancelled = false;
    setLoading(true);
    logisticsChatService
      .list(tenant.id)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => !cancelled && setLoading(false));

    const channel = logisticsChatService.subscribe(tenant.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [open, tenant?.id, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !tenant?.id || !currentEmployee?.id || sending) return;
    setSending(true);
    try {
      await logisticsChatService.send(tenant.id, currentEmployee.id, text);
      setText('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>Logistics Chat</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No messages yet. Say hi to the logistics team!
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const own = m.employee_id === currentEmployee?.id;
                return (
                  <div key={m.id} className={`flex gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">{initials(m.employee_name)}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          own ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        {m.message}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 px-1">
                        {m.employee_name} • {format(new Date(m.created_at), 'dd/MM HH:mm')}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LogisticsChat;
