-- Add sort_order and production_line columns to workstations table
ALTER TABLE public.workstations 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS production_line INTEGER DEFAULT 1;

-- Add index for sorting
CREATE INDEX IF NOT EXISTS idx_workstations_sort_order ON public.workstations(sort_order);
CREATE INDEX IF NOT EXISTS idx_workstations_production_line ON public.workstations(production_line);