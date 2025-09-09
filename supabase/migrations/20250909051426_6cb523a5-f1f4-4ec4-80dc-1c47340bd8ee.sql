-- Add EAN column to order_items for storing barcode values from external Orders API
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS ean text;

-- Optional: document intent for future maintainers
COMMENT ON COLUMN public.order_items.ean IS 'EAN/Barcode imported from external orders API items';