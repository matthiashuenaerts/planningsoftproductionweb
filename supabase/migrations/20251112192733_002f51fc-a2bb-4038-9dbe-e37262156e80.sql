-- Add external_team_names column to placement_teams table
ALTER TABLE public.placement_teams 
ADD COLUMN external_team_names TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.placement_teams.external_team_names IS 'Array of external team names that map to this installation team';