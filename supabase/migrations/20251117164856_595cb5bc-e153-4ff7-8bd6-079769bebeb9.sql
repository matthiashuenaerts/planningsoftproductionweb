-- Create employee_standard_task_links table
CREATE TABLE IF NOT EXISTS public.employee_standard_task_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  standard_task_id UUID REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, standard_task_id)
);

-- Enable RLS
ALTER TABLE public.employee_standard_task_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow all operations for authenticated users
CREATE POLICY "Allow full access to employee_standard_task_links"
  ON public.employee_standard_task_links
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_standard_task_links_employee_id 
  ON public.employee_standard_task_links(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_standard_task_links_standard_task_id 
  ON public.employee_standard_task_links(standard_task_id);