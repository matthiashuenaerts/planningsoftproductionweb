-- Add external_order_number to link imported orders idempotently
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS external_order_number TEXT;

-- Ensure uniqueness for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_order_number
ON public.orders (external_order_number);
