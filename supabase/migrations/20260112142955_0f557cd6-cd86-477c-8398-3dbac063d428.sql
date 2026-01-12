-- Add is_processing_article column to products table
ALTER TABLE public.products 
ADD COLUMN is_processing_article boolean NOT NULL DEFAULT false;