
-- Fix: Create hash_password with correct schema reference
CREATE OR REPLACE FUNCTION public.hash_password(p_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT crypt(p_password, gen_salt('bf'));
$$;

-- Update authenticate_employee_for_tenant with extensions in search_path
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

  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, e.tenant_id
  FROM public.employees e
  WHERE e.tenant_id = v_tenant_id
    AND e.name = p_employee_name
    AND e.password = crypt(p_employee_password, e.password)
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, v_tenant_id AS tenant_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.id
  WHERE e.name = p_employee_name
    AND e.password = crypt(p_employee_password, e.password)
    AND ur.role = 'developer'
  LIMIT 1;
END;
$$;

-- Update authenticate_employee with extensions in search_path
CREATE OR REPLACE FUNCTION public.authenticate_employee(employee_name text, employee_password text)
RETURNS TABLE(id uuid, name text, role text, workstation text, logistics boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.role, e.workstation, e.logistics
  FROM public.employees e
  WHERE e.name = employee_name
    AND e.password = crypt(employee_password, e.password);
END;
$$;

-- Update authenticate_developer_by_name with extensions in search_path
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
