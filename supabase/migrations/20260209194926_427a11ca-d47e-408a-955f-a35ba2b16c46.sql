
-- =====================================================
-- MULTI-TENANT: FUNCTIONS + TRIGGERS + RLS
-- (No data changes)
-- =====================================================

-- 1) Helper functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.employees
  WHERE auth_user_id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_developer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role::text = 'developer'
      AND (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id(p_user_id))
  );
$$;

-- Resolve a tenant without granting table SELECT to anon
CREATE OR REPLACE FUNCTION public.resolve_tenant(p_slug TEXT DEFAULT NULL, p_domain TEXT DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  custom_domain TEXT,
  logo_url TEXT,
  is_active BOOLEAN,
  settings JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.slug, t.custom_domain, t.logo_url, t.is_active, t.settings
  FROM public.tenants t
  WHERE t.is_active = true
    AND (
      (p_slug IS NOT NULL AND t.slug = p_slug)
      OR (p_domain IS NOT NULL AND t.custom_domain = p_domain)
    )
  LIMIT 1;
$$;

-- 2) Ensure tenant_id auto-fill on inserts (if caller doesn't provide it)
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id_on_insert ON public.%I;', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER set_tenant_id_on_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();',
      r.table_name
    );
  END LOOP;
END $$;

-- 3) Tenants table policies (no anon SELECT)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tenants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "dev_full_access_tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.is_developer(auth.uid()))
WITH CHECK (public.is_developer(auth.uid()));

CREATE POLICY "tenant_users_read_own_tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = public.get_user_tenant_id(auth.uid()));

-- 4) user_roles policies (developers manage, users read own)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_roles_read_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "dev_manage_user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_developer(auth.uid()))
WITH CHECK (public.is_developer(auth.uid()));

-- 5) Tenant isolation for all tenant-scoped tables
DO $$
DECLARE
  t RECORD;
  pol RECORD;
BEGIN
  FOR t IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name NOT IN ('user_roles')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.table_name);

    -- Drop existing policies on this table to prevent bypass
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname='public'
        AND tablename=t.table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO authenticated '
      'USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid())) '
      'WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()));',
      t.table_name
    );
  END LOOP;
END $$;
