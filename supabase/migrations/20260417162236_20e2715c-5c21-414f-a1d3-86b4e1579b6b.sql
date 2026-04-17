-- Drop the global unique constraint on external_order_number which prevents
-- the same order number from existing across multiple projects/tenants.
DROP INDEX IF EXISTS public.idx_orders_external_order_number;

-- Replace with a per-project unique index so each project can have its own
-- copy of an external order number, and idempotent upserts still work.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_project_external_order_number
  ON public.orders (project_id, external_order_number)
  WHERE external_order_number IS NOT NULL;