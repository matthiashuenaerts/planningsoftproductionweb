import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

interface SupportTicketListProps {
  onViewTicket: (ticketId: string) => void;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const SupportTicketList: React.FC<SupportTicketListProps> = ({ onViewTicket }) => {
  const { currentEmployee } = useAuth();

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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading tickets...</p>;

  if (!tickets?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No support tickets yet</p>
        <p className="text-xs">Create a new ticket to report a problem</p>
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
              <Badge variant="outline" className={priorityColors[ticket.priority] || ''}>
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
