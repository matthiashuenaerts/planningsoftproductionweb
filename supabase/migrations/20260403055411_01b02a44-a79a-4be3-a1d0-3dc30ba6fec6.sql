-- Add installation_status column to projects to track installation completion
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS installation_status text DEFAULT NULL;

COMMENT ON COLUMN public.projects.installation_status IS 'Tracks installation completion: null, completed, completed_with_service';