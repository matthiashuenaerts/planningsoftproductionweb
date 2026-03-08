
ALTER TABLE public.time_registrations 
ADD COLUMN IF NOT EXISTS service_assignment_id UUID REFERENCES public.project_team_assignments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.time_registrations.service_assignment_id IS 'Reference to a service team assignment for service installation time tracking';
