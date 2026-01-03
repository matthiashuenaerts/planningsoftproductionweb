-- Add unit_price column to accessories table
ALTER TABLE public.accessories 
ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;