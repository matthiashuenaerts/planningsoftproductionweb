-- Create table for persisting Production Completion Timeline data
CREATE TABLE public.project_production_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  client TEXT,
  installation_date TIMESTAMPTZ NOT NULL,
  last_production_step_end TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('on_track', 'at_risk', 'overdue', 'pending')),
  days_remaining INTEGER NOT NULL,
  last_production_step_name TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_project_production_completion_project_id ON public.project_production_completion(project_id);
CREATE INDEX idx_project_production_completion_generated_at ON public.project_production_completion(generated_at DESC);

-- Enable RLS
ALTER TABLE public.project_production_completion ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read completion data
CREATE POLICY "Authenticated users can read completion data"
ON public.project_production_completion
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert completion data
CREATE POLICY "Authenticated users can insert completion data"
ON public.project_production_completion
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update completion data
CREATE POLICY "Authenticated users can update completion data"
ON public.project_production_completion
FOR UPDATE
TO authenticated
USING (true);

-- Allow all authenticated users to delete completion data
CREATE POLICY "Authenticated users can delete completion data"
ON public.project_production_completion
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_production_completion_updated_at
  BEFORE UPDATE ON public.project_production_completion
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();