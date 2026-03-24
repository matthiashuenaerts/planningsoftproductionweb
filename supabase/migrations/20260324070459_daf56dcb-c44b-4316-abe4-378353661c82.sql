
-- Store OneDrive tokens per employee (persistent across sessions)
CREATE TABLE public.employee_onedrive_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  microsoft_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

ALTER TABLE public.employee_onedrive_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own tokens
CREATE POLICY "Users manage own tokens"
  ON public.employee_onedrive_tokens
  FOR ALL
  TO authenticated
  USING (
    employee_id = public.get_employee_id_from_auth(auth.uid())
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    employee_id = public.get_employee_id_from_auth(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- Trigger to auto-set tenant_id
CREATE TRIGGER set_tenant_id_employee_onedrive_tokens
  BEFORE INSERT ON public.employee_onedrive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Trigger to auto-update updated_at
CREATE TRIGGER update_employee_onedrive_tokens_updated_at
  BEFORE UPDATE ON public.employee_onedrive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
