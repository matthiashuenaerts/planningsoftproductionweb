
-- 1. Developer active tenants table for cross-tenant login
CREATE TABLE IF NOT EXISTS public.developer_active_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  active_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_dev_employee UNIQUE (employee_id)
);
ALTER TABLE public.developer_active_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developers_manage_own" ON public.developer_active_tenants
FOR ALL TO authenticated
USING (employee_id = public.get_employee_id_from_auth(auth.uid()))
WITH CHECK (employee_id = public.get_employee_id_from_auth(auth.uid()));

-- 2. Update get_user_tenant_id to support developer tenant switching
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT dat.active_tenant_id
     FROM public.developer_active_tenants dat
     JOIN public.employees e ON e.id = dat.employee_id
     WHERE e.auth_user_id = p_user_id
     LIMIT 1),
    (SELECT tenant_id FROM public.employees WHERE auth_user_id = p_user_id LIMIT 1)
  );
$$;

-- 3. Add developer bypass to employees RLS
DROP POLICY IF EXISTS "tenant_isolation" ON public.employees;
CREATE POLICY "tenant_isolation" ON public.employees
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_developer(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_developer(auth.uid())
);

-- 4. Set/clear developer active tenant RPCs
CREATE OR REPLACE FUNCTION public.set_developer_active_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  v_employee_id := public.get_employee_id_from_auth(auth.uid());
  IF v_employee_id IS NULL THEN RETURN; END IF;
  IF NOT public.is_developer(auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.developer_active_tenants (employee_id, active_tenant_id, updated_at)
  VALUES (v_employee_id, p_tenant_id, now())
  ON CONFLICT (employee_id) DO UPDATE SET active_tenant_id = p_tenant_id, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_developer_active_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  v_employee_id := public.get_employee_id_from_auth(auth.uid());
  IF v_employee_id IS NOT NULL THEN
    DELETE FROM public.developer_active_tenants WHERE employee_id = v_employee_id;
  END IF;
END;
$$;

-- 5. Developer OTP codes table
CREATE TABLE IF NOT EXISTS public.developer_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false
);
ALTER TABLE public.developer_otp_codes ENABLE ROW LEVEL SECURITY;

-- 6. Add max_workers to workstations
ALTER TABLE public.workstations ADD COLUMN IF NOT EXISTS max_workers INTEGER DEFAULT 0;
