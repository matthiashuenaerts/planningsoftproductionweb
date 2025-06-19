
-- Make project_id nullable in the orders table to allow stock orders without project linking
ALTER TABLE public.orders ALTER COLUMN project_id DROP NOT NULL;
