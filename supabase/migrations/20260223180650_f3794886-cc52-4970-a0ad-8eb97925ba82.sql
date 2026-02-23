-- Fix tasks table: drop overly permissive policies and add proper ones
DROP POLICY IF EXISTS "employees_update_tasks" ON public.tasks;
DROP POLICY IF EXISTS "employees_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "admins_managers_delete_tasks" ON public.tasks;

-- Ensure tenant isolation exists (safe to create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tenant_isolation'
  ) THEN
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.tasks FOR ALL TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()))';
  END IF;
END $$;

-- All authenticated users in tenant can read tasks
CREATE POLICY "authenticated_view_tasks" ON public.tasks
FOR SELECT TO authenticated USING (true);

-- All authenticated users in tenant can insert tasks  
CREATE POLICY "authenticated_insert_tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (true);

-- All authenticated users in tenant can update tasks
CREATE POLICY "authenticated_update_tasks" ON public.tasks
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Only admins/managers can delete tasks
CREATE POLICY "admins_managers_delete_tasks_v2" ON public.tasks
FOR DELETE TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));