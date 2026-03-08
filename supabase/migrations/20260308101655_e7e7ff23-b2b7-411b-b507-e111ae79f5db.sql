
ALTER TABLE public.project_team_assignments 
ADD COLUMN IF NOT EXISTS service_notes TEXT;

COMMENT ON COLUMN public.project_team_assignments.service_notes IS 'Description and todos for service installations';
