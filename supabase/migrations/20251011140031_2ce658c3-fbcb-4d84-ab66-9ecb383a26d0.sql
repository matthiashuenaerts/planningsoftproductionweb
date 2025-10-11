-- Add active_workers column to workstations table
ALTER TABLE public.workstations
ADD COLUMN active_workers integer NOT NULL DEFAULT 1;

-- Add constraint to ensure at least 1 worker
ALTER TABLE public.workstations
ADD CONSTRAINT workstations_active_workers_min CHECK (active_workers >= 1 AND active_workers <= 10);