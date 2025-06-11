
-- Create workstation_tasks table
CREATE TABLE public.workstation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  duration INTEGER, -- in hours
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for workstation_tasks
ALTER TABLE public.workstation_tasks ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to view workstation tasks
CREATE POLICY "Allow authenticated users to view workstation tasks" 
  ON public.workstation_tasks 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Policy to allow authenticated users to insert workstation tasks
CREATE POLICY "Allow authenticated users to create workstation tasks" 
  ON public.workstation_tasks 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Policy to allow authenticated users to update workstation tasks
CREATE POLICY "Allow authenticated users to update workstation tasks" 
  ON public.workstation_tasks 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Policy to allow authenticated users to delete workstation tasks
CREATE POLICY "Allow authenticated users to delete workstation tasks" 
  ON public.workstation_tasks 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Add trigger to update updated_at column
CREATE TRIGGER update_workstation_tasks_updated_at
  BEFORE UPDATE ON public.workstation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
