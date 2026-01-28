-- Add is_last_production_step column to standard_tasks
-- Only one standard task can be marked as the last production step
ALTER TABLE public.standard_tasks 
ADD COLUMN IF NOT EXISTS is_last_production_step boolean DEFAULT false;

-- Create a unique partial index to ensure only one task can be marked as the last production step
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_last_production_step 
ON public.standard_tasks (is_last_production_step) 
WHERE is_last_production_step = true;

-- Add comment for documentation
COMMENT ON COLUMN public.standard_tasks.is_last_production_step IS 'Marks this task as the last production step. Only one task can have this flag set to true. Used for capacity calculations and timeline endpoints.';