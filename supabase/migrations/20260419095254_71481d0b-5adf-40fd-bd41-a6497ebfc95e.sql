ALTER TABLE public.external_orders_buffer
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_external_orders_buffer_tenant_hidden
  ON public.external_orders_buffer (tenant_id, hidden);