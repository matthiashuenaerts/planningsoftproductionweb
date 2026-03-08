
-- Make tenant_id nullable for developers
ALTER TABLE public.employees ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN tenant_id DROP DEFAULT;

-- Set existing developers to NULL tenant_id
UPDATE public.employees e
SET tenant_id = NULL
FROM public.user_roles ur
WHERE ur.user_id = e.id AND ur.role = 'developer';

-- Update get_user_tenant_id to handle NULL tenant_id (developers)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- First: check developer active tenant override
    (SELECT dat.active_tenant_id
     FROM public.developer_active_tenants dat
     JOIN public.employees e ON e.id = dat.employee_id
     WHERE e.auth_user_id = p_user_id
     LIMIT 1),
    -- Fallback: employee's own tenant_id (NULL for developers without active tenant)
    (SELECT tenant_id FROM public.employees WHERE auth_user_id = p_user_id LIMIT 1)
  );
$$;

-- Update authenticate_employee_for_tenant to handle developers with NULL tenant_id
CREATE OR REPLACE FUNCTION public.authenticate_employee_for_tenant(
  p_employee_name text, 
  p_employee_password text, 
  p_slug text DEFAULT NULL::text, 
  p_domain text DEFAULT NULL::text
)
 RETURNS TABLE(employee_id uuid, employee_name text, preferred_language text, email text, auth_user_id uuid, tenant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  WHERE t.is_active = true
    AND (
      (p_slug IS NOT NULL AND t.slug = p_slug)
      OR (p_domain IS NOT NULL AND t.custom_domain = p_domain)
      OR (p_domain IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tenant_aliases ta WHERE ta.tenant_id = t.id AND ta.domain = p_domain
      ))
    )
  LIMIT 1;

  IF v_tenant_id IS NULL THEN RETURN; END IF;

  -- First: try to find employee in the specific tenant
  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, e.tenant_id
  FROM public.employees e
  WHERE e.tenant_id = v_tenant_id
    AND e.name = p_employee_name
    AND e.password = crypt(p_employee_password, e.password)
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Fallback: find developer (tenant_id IS NULL) and return the target tenant_id
  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, v_tenant_id AS tenant_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.id
  WHERE e.name = p_employee_name
    AND e.password = crypt(p_employee_password, e.password)
    AND ur.role = 'developer'
    AND e.tenant_id IS NULL
  LIMIT 1;
END;
$$;

-- Update authenticate_developer_by_name to work with NULL tenant_id
CREATE OR REPLACE FUNCTION public.authenticate_developer_by_name(p_name text, p_password text)
 RETURNS TABLE(employee_id uuid, employee_name text, email text, auth_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.email, e.auth_user_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.id
  WHERE e.name = p_name
    AND e.password = crypt(p_password, e.password)
    AND ur.role = 'developer'
  LIMIT 1;
END;
$$;

-- Update set_tenant_id_on_insert to skip if developer (no tenant)
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  
  IF v_tenant_id IS NOT NULL THEN
    NEW.tenant_id := v_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure RLS on employees allows developers to see their own record (with NULL tenant_id)
-- The is_developer check already covers this in existing policies
