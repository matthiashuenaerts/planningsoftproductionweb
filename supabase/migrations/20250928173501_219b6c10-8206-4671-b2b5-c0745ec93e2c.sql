-- Add source field to orders table to track where orders come from
ALTER TABLE public.orders 
ADD COLUMN source text DEFAULT 'manual';

-- Update existing orders to have 'manual' as default source
UPDATE public.orders 
SET source = 'manual' 
WHERE source IS NULL;