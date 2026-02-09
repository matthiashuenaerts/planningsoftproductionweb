
CREATE OR REPLACE FUNCTION public.authenticate_employee_for_tenant(
  p_employee_name TEXT,
  p_employee_password TEXT,
  p_slug TEXT DEFAULT NULL,
  p_domain TEXT DEFAULT NULL
)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  preferred_language TEXT,
  email TEXT,
  auth_user_id UUID,
  tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT t.id
  INTO v_tenant_id
  FROM public.tenants t
  WHERE t.is_active = true
    AND (
      (p_slug IS NOT NULL AND t.slug = p_slug)
      OR (p_domain IS NOT NULL AND t.custom_domain = p_domain)
    )
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.preferred_language,
    e.email,
    e.auth_user_id,
    e.tenant_id
  FROM public.employees e
  WHERE e.tenant_id = v_tenant_id
    AND e.name = p_employee_name
    AND e.password = p_employee_password
  LIMIT 1;
END;
$$;
