-- Create workstation_errors table to track error messages
CREATE TABLE public.workstation_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT 'general',
  reported_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.workstation_errors ENABLE ROW LEVEL SECURITY;

-- Allow all employees to view workstation errors
CREATE POLICY "All employees can view workstation errors"
ON public.workstation_errors
FOR SELECT
TO authenticated
USING (true);

-- Allow all employees to create workstation errors
CREATE POLICY "All employees can create workstation errors"
ON public.workstation_errors
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all employees to update workstation errors
CREATE POLICY "All employees can update workstation errors"
ON public.workstation_errors
FOR UPDATE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_workstation_errors_workstation_id ON public.workstation_errors(workstation_id);
CREATE INDEX idx_workstation_errors_is_active ON public.workstation_errors(is_active);