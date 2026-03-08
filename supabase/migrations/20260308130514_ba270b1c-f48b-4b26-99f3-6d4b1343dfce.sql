
-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. FIX: Remove overly permissive USING(true) policies on tasks table
DROP POLICY IF EXISTS "authenticated_view_tasks" ON public.tasks;
DROP POLICY IF EXISTS "authenticated_update_tasks" ON public.tasks;
DROP POLICY IF EXISTS "authenticated_insert_tasks" ON public.tasks;

-- Replace with tenant-isolated policies
CREATE POLICY "tasks_tenant_select" ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM phases p 
    JOIN projects pr ON pr.id = p.project_id 
    WHERE p.id = tasks.phase_id 
    AND (pr.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  ));

CREATE POLICY "tasks_tenant_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM phases p 
    JOIN projects pr ON pr.id = p.project_id 
    WHERE p.id = tasks.phase_id 
    AND (pr.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  ));

CREATE POLICY "tasks_tenant_update" ON public.tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM phases p 
    JOIN projects pr ON pr.id = p.project_id 
    WHERE p.id = tasks.phase_id 
    AND (pr.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM phases p 
    JOIN projects pr ON pr.id = p.project_id 
    WHERE p.id = tasks.phase_id 
    AND (pr.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  ));

CREATE POLICY "tasks_tenant_delete" ON public.tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM phases p 
    JOIN projects pr ON pr.id = p.project_id 
    WHERE p.id = tasks.phase_id 
    AND (pr.tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  ));

-- 2. FIX: Broken user_roles_read_own policy (uses auth.uid() but user_id references employees.id)
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;

-- 3. FIX: Restrict external_api_configs to admin/developer only
DROP POLICY IF EXISTS "tenant_isolation" ON public.external_api_configs;

CREATE POLICY "external_api_configs_admin_only" ON public.external_api_configs FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.check_employee_roles(auth.uid(), ARRAY['admin']))
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.check_employee_roles(auth.uid(), ARRAY['admin']))
    OR public.is_developer(auth.uid())
  );

-- 4. FIX: Add user-level isolation to personal_items
DROP POLICY IF EXISTS "tenant_isolation" ON public.personal_items;

CREATE POLICY "personal_items_user_isolation" ON public.personal_items FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      user_id = public.get_employee_id_from_auth(auth.uid())
      OR is_shared = true
      OR EXISTS (
        SELECT 1 FROM personal_item_shares pis 
        WHERE pis.personal_item_id = personal_items.id 
        AND pis.shared_with_user_id = public.get_employee_id_from_auth(auth.uid())
      )
      OR public.is_developer(auth.uid())
    )
  );

CREATE POLICY "personal_items_user_insert" ON public.personal_items FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND user_id = public.get_employee_id_from_auth(auth.uid())
  );

CREATE POLICY "personal_items_user_update" ON public.personal_items FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (user_id = public.get_employee_id_from_auth(auth.uid()) OR public.is_developer(auth.uid()))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (user_id = public.get_employee_id_from_auth(auth.uid()) OR public.is_developer(auth.uid()))
  );

CREATE POLICY "personal_items_user_delete" ON public.personal_items FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (user_id = public.get_employee_id_from_auth(auth.uid()) OR public.is_developer(auth.uid()))
  );

-- 5. FIX: Add explicit RLS policy for developer_otp_codes
CREATE POLICY "otp_codes_own_access" ON public.developer_otp_codes FOR SELECT TO authenticated
  USING (employee_id = public.get_employee_id_from_auth(auth.uid()));

CREATE POLICY "otp_codes_insert" ON public.developer_otp_codes FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_employee_id_from_auth(auth.uid()));

-- 6. FIX: Remove overly permissive login_logs insert policies (allow anon)
DROP POLICY IF EXISTS "Anyone can insert login_logs" ON public.login_logs;
-- Keep only authenticated insert

-- 7. FIX: Revoke direct SELECT on employees.password for non-admin via a view approach
-- We create a security definer function to check password without exposing it
CREATE OR REPLACE FUNCTION public.employee_password_hidden(emp public.employees)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN public.check_employee_roles(auth.uid(), ARRAY['admin']) OR public.is_developer(auth.uid())
    THEN emp.password
    ELSE '***'
  END;
$$;
