
CREATE TABLE IF NOT EXISTS public.external_orders_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ordernummer text NOT NULL,
  klant text,
  klantnummer text,
  orderdatum text,
  ordertype text,
  beschrijving text,
  referentie text,
  adres text,
  plaatsingsdatum text,
  orderverwerker text,
  raw jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ordernummer)
);

CREATE INDEX IF NOT EXISTS idx_external_orders_buffer_tenant
  ON public.external_orders_buffer (tenant_id, orderdatum DESC);

ALTER TABLE public.external_orders_buffer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read external_orders_buffer"
  ON public.external_orders_buffer
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.external_orders_sync_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  count integer
);

ALTER TABLE public.external_orders_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read external_orders_sync_state"
  ON public.external_orders_sync_state
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
