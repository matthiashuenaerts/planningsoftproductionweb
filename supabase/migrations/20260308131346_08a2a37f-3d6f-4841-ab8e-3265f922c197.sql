
-- Fix RLS on projects to allow developer access
DROP POLICY IF EXISTS "tenant_isolation" ON public.projects;
CREATE POLICY "tenant_isolation" ON public.projects
FOR ALL TO authenticated
USING ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()))
WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()));

-- Fix RLS on rush_orders to allow developer access
DROP POLICY IF EXISTS "tenant_isolation" ON public.rush_orders;
CREATE POLICY "tenant_isolation" ON public.rush_orders
FOR ALL TO authenticated
USING ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()))
WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()));

-- Fix RLS on project_sync_logs to allow developer access
DROP POLICY IF EXISTS "tenant_isolation" ON public.project_sync_logs;
CREATE POLICY "tenant_isolation" ON public.project_sync_logs
FOR ALL TO authenticated
USING ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()))
WITH CHECK ((tenant_id = public.get_user_tenant_id(auth.uid())) OR public.is_developer(auth.uid()));
