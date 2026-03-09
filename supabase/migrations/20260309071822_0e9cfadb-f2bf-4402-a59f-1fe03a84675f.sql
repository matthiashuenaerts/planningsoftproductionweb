-- Drop the existing constraint
ALTER TABLE public.time_registrations DROP CONSTRAINT check_task_or_workstation_task;

-- Re-create with service_assignment_id as a valid option
ALTER TABLE public.time_registrations ADD CONSTRAINT check_task_or_workstation_task CHECK (
  (task_id IS NOT NULL AND workstation_task_id IS NULL AND service_assignment_id IS NULL)
  OR (task_id IS NULL AND workstation_task_id IS NOT NULL AND service_assignment_id IS NULL)
  OR (task_id IS NULL AND workstation_task_id IS NULL AND service_assignment_id IS NOT NULL)
);