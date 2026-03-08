
-- Fix last USING(true) on login_logs - restrict to authenticated only with tenant isolation
DROP POLICY IF EXISTS "Authenticated users can insert login_logs" ON public.login_logs;

CREATE POLICY "login_logs_tenant_insert" ON public.login_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
