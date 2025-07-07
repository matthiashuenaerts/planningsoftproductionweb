
-- Create workstation_schedules table
CREATE TABLE public.workstation_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  task_title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for workstation_schedules
ALTER TABLE public.workstation_schedules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view workstation schedules
CREATE POLICY "Everyone can view workstation schedules" 
  ON public.workstation_schedules 
  FOR SELECT 
  USING (true);

-- Only admins and managers can modify workstation schedules
CREATE POLICY "Only admins and managers can modify workstation schedules" 
  ON public.workstation_schedules 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = auth.uid() 
      AND employees.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.id = auth.uid() 
      AND employees.role IN ('admin', 'manager')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_workstation_schedules_updated_at
  BEFORE UPDATE ON public.workstation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
