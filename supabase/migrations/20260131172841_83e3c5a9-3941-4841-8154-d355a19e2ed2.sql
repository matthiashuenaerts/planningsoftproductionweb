-- Add multi_user_task column to standard_tasks table
-- When true, this task can be assigned to multiple employees simultaneously to complete faster
ALTER TABLE public.standard_tasks 
ADD COLUMN IF NOT EXISTS multi_user_task BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.standard_tasks.multi_user_task IS 'When true, this task can be split across multiple employees to complete faster (e.g., 2 employees = half the time)';