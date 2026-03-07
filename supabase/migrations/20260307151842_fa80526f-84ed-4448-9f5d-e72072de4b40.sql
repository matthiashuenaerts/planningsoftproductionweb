-- Drop the unique constraint on project_id to allow multiple team assignments per project
-- (e.g. both a regular installation team AND a service team assignment)
ALTER TABLE public.project_team_assignments DROP CONSTRAINT project_team_assignments_project_id_key;