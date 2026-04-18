import { supabase } from '@/integrations/supabase/client';

export interface LogisticsChatMessage {
  id: string;
  tenant_id: string;
  employee_id: string;
  message: string;
  created_at: string;
  employee_name?: string;
}

export const logisticsChatService = {
  async list(tenantId: string): Promise<LogisticsChatMessage[]> {
    const { data, error } = await supabase
      .from('logistics_chat_messages' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    const rows = (data ?? []) as unknown as LogisticsChatMessage[];
    if (rows.length === 0) return rows;

    const ids = [...new Set(rows.map((r) => r.employee_id))];
    const { data: emps } = await supabase.from('employees').select('id, name').in('id', ids);
    const map = new Map<string, string>((emps ?? []).map((e: any) => [e.id, e.name]));
    return rows.map((r) => ({ ...r, employee_name: map.get(r.employee_id) ?? 'Unknown' }));
  },

  async send(tenantId: string, employeeId: string, message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('logistics_chat_messages' as any).insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      message: trimmed,
    });
    if (error) throw error;
  },

  subscribe(tenantId: string, onInsert: (msg: LogisticsChatMessage) => void) {
    return supabase
      .channel(`logistics-chat-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logistics_chat_messages', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          const row = payload.new as any as LogisticsChatMessage;
          const { data: emp } = await supabase
            .from('employees')
            .select('name')
            .eq('id', row.employee_id)
            .single();
          onInsert({ ...row, employee_name: emp?.name ?? 'Unknown' });
        },
      )
      .subscribe();
  },
};
