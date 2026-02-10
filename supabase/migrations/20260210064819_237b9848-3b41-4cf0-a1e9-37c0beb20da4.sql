
-- 1. Tenant aliases table for multiple domains per tenant
CREATE TABLE public.tenant_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage aliases" ON public.tenant_aliases
  FOR ALL USING (public.is_developer(auth.uid()));

-- 2. RPC for developer name-based login (no tenant filter)
CREATE OR REPLACE FUNCTION public.authenticate_developer_by_name(
  p_name TEXT,
  p_password TEXT
)
RETURNS TABLE(employee_id UUID, employee_name TEXT, email TEXT, auth_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.email, e.auth_user_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.auth_user_id
  WHERE e.name = p_name
    AND e.password = p_password
    AND ur.role = 'developer'
  LIMIT 1;
END;
$$;

-- 3. Update resolve_tenant to also check aliases
CREATE OR REPLACE FUNCTION public.resolve_tenant(
  p_slug TEXT DEFAULT NULL,
  p_domain TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, custom_domain TEXT, logo_url TEXT, is_active BOOLEAN, settings JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.slug, t.custom_domain, t.logo_url, t.is_active, t.settings
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
$$;

-- 4. Update authenticate_employee_for_tenant to also resolve via alias
CREATE OR REPLACE FUNCTION public.authenticate_employee_for_tenant(
  p_employee_name TEXT,
  p_employee_password TEXT,
  p_slug TEXT DEFAULT NULL,
  p_domain TEXT DEFAULT NULL
)
RETURNS TABLE(employee_id UUID, employee_name TEXT, preferred_language TEXT, email TEXT, auth_user_id UUID, tenant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    AND e.password = p_employee_password
  LIMIT 1;
END;
$$;

-- 5. Trigger for updated_at on tenant_aliases
CREATE TRIGGER update_tenant_aliases_updated_at
  BEFORE UPDATE ON public.tenant_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
