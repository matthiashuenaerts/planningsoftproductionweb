
-- Fix employees RLS to allow developers to see ALL employees (for dev portal)
DROP POLICY IF EXISTS "tenant_isolation" ON public.employees;
CREATE POLICY "tenant_isolation" ON public.employees
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- Also fix user_roles RLS so developers can see roles for all tenants
DROP POLICY IF EXISTS "tenant_isolation" ON public.user_roles;
CREATE POLICY "tenant_isolation" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = user_roles.user_id
      AND (e.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = user_roles.user_id
      AND (e.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
    )
  );

-- Fix support_tickets RLS for developer access
DROP POLICY IF EXISTS "tenant_isolation" ON public.support_tickets;
CREATE POLICY "tenant_isolation" ON public.support_tickets
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- Fix invoices RLS for developer access  
DROP POLICY IF EXISTS "tenant_isolation" ON public.invoices;
CREATE POLICY "tenant_isolation" ON public.invoices
  FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- Fix tenant_aliases RLS for developer access
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_aliases;
CREATE POLICY "tenant_isolation" ON public.tenant_aliases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_aliases.tenant_id
      AND (t.id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_aliases.tenant_id
      AND (t.id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
    )
  );
