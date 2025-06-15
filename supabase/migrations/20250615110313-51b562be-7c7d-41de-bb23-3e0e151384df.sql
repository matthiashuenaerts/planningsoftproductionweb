
-- Add hourly_cost to standard_tasks table
ALTER TABLE public.standard_tasks
ADD COLUMN hourly_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
