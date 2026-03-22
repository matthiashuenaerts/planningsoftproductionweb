
-- Fix: Drop overly permissive INSERT policy on automation_logs
-- Edge functions use service_role which bypasses RLS anyway
DROP POLICY IF EXISTS "Service role can insert automation logs" ON public.automation_logs;

-- Add a properly scoped policy for authenticated users only
CREATE POLICY "authenticated_insert_automation_logs" ON public.automation_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
