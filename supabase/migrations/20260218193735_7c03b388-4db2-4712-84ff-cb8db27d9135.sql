
-- Allow developers to authenticate against any tenant.
-- If normal employee lookup fails, fall back to developer lookup.
CREATE OR REPLACE FUNCTION public.authenticate_employee_for_tenant(
  p_employee_name text,
  p_employee_password text,
  p_slug text DEFAULT NULL,
  p_domain text DEFAULT NULL
)
RETURNS TABLE(employee_id uuid, employee_name text, preferred_language text, email text, auth_user_id uuid, tenant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Resolve tenant
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

  -- First try: normal employee within the tenant
  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, e.tenant_id
  FROM public.employees e
  WHERE e.tenant_id = v_tenant_id
    AND e.name = p_employee_name
    AND e.password = p_employee_password
  LIMIT 1;

  -- If a row was returned, we're done
  IF FOUND THEN RETURN; END IF;

  -- Second try: check if this is a developer (any tenant) trying to log in
  RETURN QUERY
  SELECT e.id, e.name, e.preferred_language, e.email, e.auth_user_id, v_tenant_id AS tenant_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.id
  WHERE e.name = p_employee_name
    AND e.password = p_employee_password
    AND ur.role = 'developer'
  LIMIT 1;
END;
$$;
