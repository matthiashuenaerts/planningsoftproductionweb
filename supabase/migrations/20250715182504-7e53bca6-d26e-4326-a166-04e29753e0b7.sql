
-- Add efficiency tracking columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN actual_duration_minutes integer,
ADD COLUMN efficiency_percentage integer;

-- Add efficiency tracking column to projects table  
ALTER TABLE public.projects
ADD COLUMN efficiency_percentage integer;

-- Add comments for clarity
COMMENT ON COLUMN public.tasks.actual_duration_minutes IS 'Total actual minutes spent on this task from time registrations';
COMMENT ON COLUMN public.tasks.efficiency_percentage IS 'Efficiency percentage: positive means faster than planned, negative means slower';
COMMENT ON COLUMN public.projects.efficiency_percentage IS 'Overall project efficiency percentage based on completed tasks';
