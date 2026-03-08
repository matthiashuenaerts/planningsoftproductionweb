import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MessageSquare, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SupportTicketListProps {
  onViewTicket: (ticketId: string) => void;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-muted text-muted-foreground',
};

const priorityConfig: Record<string, { color: string; icon?: React.ReactNode }> = {
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: <AlertTriangle className="h-3 w-3" /> },
  critical: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <AlertTriangle className="h-3 w-3" /> },
};

const SupportTicketList: React.FC<SupportTicketListProps> = ({ onViewTicket }) => {
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', currentEmployee?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentEmployee,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!tickets?.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="h-6 w-6 opacity-50" />
        </div>
        <p className="font-medium text-sm">No support tickets yet</p>
        <p className="text-xs mt-1">Create a new ticket to report a problem</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-2.5">
        {tickets.map((ticket: any) => (
          <div
            key={ticket.id}
            onClick={() => onViewTicket(ticket.id)}
            className="bg-card border border-border rounded-xl p-3.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{ticket.subject}</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ticket.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${priorityConfig[ticket.priority]?.color || ''}`}>
                  {priorityConfig[ticket.priority]?.icon}
                  {ticket.priority}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[ticket.status] || ''}`}>
                  {ticket.status?.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(ticket.created_at), 'dd/MM/yyyy')}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket: any) => (
        <div
          key={ticket.id}
          onClick={() => onViewTicket(ticket.id)}
          className="p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.description}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Badge variant="outline" className={priorityConfig[ticket.priority]?.color || ''}>
                {ticket.priority}
              </Badge>
              <Badge variant="outline" className={statusColors[ticket.status] || ''}>
                {ticket.status}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      ))}
    </div>
  );
};

export default SupportTicketList;
