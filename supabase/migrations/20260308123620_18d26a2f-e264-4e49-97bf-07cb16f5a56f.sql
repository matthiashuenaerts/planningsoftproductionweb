
CREATE TABLE public.tenant_onedrive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  microsoft_client_id TEXT NOT NULL,
  tenant_directory_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_onedrive_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developer full access on tenant_onedrive_settings"
  ON public.tenant_onedrive_settings
  FOR ALL
  TO authenticated
  USING (public.is_developer(auth.uid()))
  WITH CHECK (public.is_developer(auth.uid()));

CREATE POLICY "Tenant users can read own onedrive settings"
  ON public.tenant_onedrive_settings
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
