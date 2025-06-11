
-- Add workstation_task_id column to time_registrations table
ALTER TABLE public.time_registrations 
ADD COLUMN workstation_task_id UUID REFERENCES public.workstation_tasks(id) ON DELETE CASCADE;

-- Make task_id nullable since we'll now have either task_id OR workstation_task_id
ALTER TABLE public.time_registrations 
ALTER COLUMN task_id DROP NOT NULL;

-- Add a check constraint to ensure either task_id or workstation_task_id is set, but not both
ALTER TABLE public.time_registrations 
ADD CONSTRAINT check_task_or_workstation_task 
CHECK (
  (task_id IS NOT NULL AND workstation_task_id IS NULL) OR 
  (task_id IS NULL AND workstation_task_id IS NOT NULL)
);
