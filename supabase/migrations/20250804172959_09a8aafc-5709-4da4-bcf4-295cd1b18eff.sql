-- Add location column to products table
ALTER TABLE public.products 
ADD COLUMN location text;