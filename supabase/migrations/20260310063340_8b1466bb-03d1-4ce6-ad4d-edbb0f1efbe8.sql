ALTER TABLE public.project_team_assignments 
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN start_date SET DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_possible_week text;