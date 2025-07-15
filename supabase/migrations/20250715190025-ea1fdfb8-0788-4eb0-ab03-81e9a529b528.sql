
-- Add total_duration column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN total_duration integer;

-- Update existing tasks to set total_duration equal to duration
UPDATE public.tasks 
SET total_duration = duration 
WHERE duration IS NOT NULL;

-- Set total_duration to duration for any NULL duration values (fallback to 60 minutes)
UPDATE public.tasks 
SET total_duration = COALESCE(duration, 60);
