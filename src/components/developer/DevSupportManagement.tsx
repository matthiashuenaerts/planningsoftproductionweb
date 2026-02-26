import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { LifeBuoy, ChevronRight, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import SupportTicketChat from "@/components/support/SupportTicketChat";

const DevSupportManagement: React.FC = () => {
  const qc = useQueryClient();
  const { currentEmployee } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["dev", "all-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, creator:employees!support_tickets_created_by_fkey(name), tenant:tenants!support_tickets_tenant_id_fkey(name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status } as any).eq("id", ticketId);
    if (!error) qc.invalidateQueries({ queryKey: ["dev", "all-support-tickets"] });
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/20 text-blue-300',
    in_progress: 'bg-yellow-500/20 text-yellow-300',
    resolved: 'bg-green-500/20 text-green-300',
    closed: 'bg-slate-500/20 text-slate-300',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-500/20 text-slate-300',
    medium: 'bg-blue-500/20 text-blue-300',
    high: 'bg-orange-500/20 text-orange-300',
    critical: 'bg-red-500/20 text-red-300',
  };

  if (selectedTicketId) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <SupportTicketChat
            ticketId={selectedTicketId}
            onBack={() => setSelectedTicketId(null)}
            isDeveloper={true}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" /> All Support Tickets ({tickets?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400">Loading...</p>
          ) : !tickets?.length ? (
            <p className="text-slate-400 text-sm">No support tickets</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between bg-white/5 rounded-md px-4 py-3 hover:bg-white/10 cursor-pointer transition"
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
                      <Badge className={priorityColors[ticket.priority] || ''} variant="outline">{ticket.priority}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {ticket.tenant?.name} · {ticket.creator?.name} · {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Select value={ticket.status} onValueChange={(v) => { updateStatus(ticket.id, v); }}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-7 w-28" onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['open', 'in_progress', 'resolved', 'closed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DevSupportManagement;
