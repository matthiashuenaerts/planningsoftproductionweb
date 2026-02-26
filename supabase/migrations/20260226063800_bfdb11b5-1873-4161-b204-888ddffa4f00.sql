-- 1. Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  payment_deadline DATE,
  amount NUMERIC(10,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, month, year)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_developer(auth.uid()) OR public.get_user_tenant_id(auth.uid()) = tenant_id)
  WITH CHECK (public.is_developer(auth.uid()) OR public.get_user_tenant_id(auth.uid()) = tenant_id);

-- 2. Support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_developer(auth.uid()) OR public.get_user_tenant_id(auth.uid()) = tenant_id);

CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_tenant_id(auth.uid()) = tenant_id OR public.is_developer(auth.uid()));

CREATE POLICY "Developers can update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_developer(auth.uid()) OR created_by = public.get_employee_id_from_auth(auth.uid()))
  WITH CHECK (public.is_developer(auth.uid()) OR created_by = public.get_employee_id_from_auth(auth.uid()));

-- 3. Support messages table (chat)
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'developer')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket participants can view messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.is_developer(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND st.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Ticket participants can send messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_developer(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND st.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- 4. Triggers for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Set tenant_id on insert triggers
CREATE TRIGGER set_tenant_id_on_support_tickets_insert
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- 6. Storage bucket for invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Developers can manage invoice files" ON storage.objects
  FOR ALL USING (bucket_id = 'invoices' AND public.is_developer(auth.uid()));

CREATE POLICY "Tenant users can view invoice files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices' AND (
      public.is_developer(auth.uid()) OR
      auth.role() = 'authenticated'
    )
  );