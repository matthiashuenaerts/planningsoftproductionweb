-- Add estimated_duration column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN estimated_duration integer;

-- Copy existing duration values to estimated_duration for existing tasks
UPDATE public.tasks 
SET estimated_duration = duration 
WHERE duration IS NOT NULL;