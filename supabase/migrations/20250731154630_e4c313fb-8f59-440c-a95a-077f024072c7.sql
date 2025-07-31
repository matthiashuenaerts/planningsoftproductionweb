-- Add barcode and qr_code fields to products table
ALTER TABLE public.products 
ADD COLUMN barcode TEXT,
ADD COLUMN qr_code TEXT;