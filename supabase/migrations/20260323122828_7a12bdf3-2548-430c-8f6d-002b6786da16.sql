-- Allow NULL tenant_id for cross-tenant sync operations
ALTER TABLE public.project_sync_logs ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.project_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE public.orders_sync_logs ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.orders_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- Update RLS policies to handle NULL tenant_id for developers
DROP POLICY IF EXISTS tenant_isolation ON public.project_sync_logs;
CREATE POLICY tenant_isolation ON public.project_sync_logs FOR ALL TO authenticated
  USING (is_developer(auth.uid()) OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (is_developer(auth.uid()) OR tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS tenant_isolation ON public.orders_sync_logs;
CREATE POLICY tenant_isolation ON public.orders_sync_logs FOR ALL TO authenticated
  USING (is_developer(auth.uid()) OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (is_developer(auth.uid()) OR tenant_id = get_user_tenant_id(auth.uid()));