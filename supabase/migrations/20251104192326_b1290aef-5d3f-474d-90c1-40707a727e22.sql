-- Create table for project team assignment overrides
CREATE TABLE IF NOT EXISTS public.project_team_assignment_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.placement_teams(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_hour INTEGER NOT NULL DEFAULT 8,
  end_hour INTEGER NOT NULL DEFAULT 17,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, team_id)
);

-- Enable RLS
ALTER TABLE public.project_team_assignment_overrides ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All employees can view project team assignment overrides"
  ON public.project_team_assignment_overrides
  FOR SELECT
  USING (true);

CREATE POLICY "All employees can insert project team assignment overrides"
  ON public.project_team_assignment_overrides
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "All employees can update project team assignment overrides"
  ON public.project_team_assignment_overrides
  FOR UPDATE
  USING (true);

CREATE POLICY "All employees can delete project team assignment overrides"
  ON public.project_team_assignment_overrides
  FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_team_assignment_overrides_updated_at
  BEFORE UPDATE ON public.project_team_assignment_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_project_team_assignment_overrides_project_id 
  ON public.project_team_assignment_overrides(project_id);
CREATE INDEX idx_project_team_assignment_overrides_team_id 
  ON public.project_team_assignment_overrides(team_id);