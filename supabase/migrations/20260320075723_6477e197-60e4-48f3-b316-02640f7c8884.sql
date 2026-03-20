-- Allow all authenticated tenant users to READ external_api_configs (for sync button)
-- Keep write access restricted to admins/developers via existing policy

-- Drop the current ALL policy and replace with separate SELECT + write policies
DROP POLICY IF EXISTS "external_api_configs_admin_only" ON public.external_api_configs;

-- SELECT: any authenticated user in the same tenant can read
CREATE POLICY "external_api_configs_select" ON public.external_api_configs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- INSERT/UPDATE/DELETE: admin or developer only
CREATE POLICY "external_api_configs_admin_write" ON public.external_api_configs
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.check_employee_roles(auth.uid(), ARRAY['admin']))
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.check_employee_roles(auth.uid(), ARRAY['admin']))
    OR public.is_developer(auth.uid())
  );