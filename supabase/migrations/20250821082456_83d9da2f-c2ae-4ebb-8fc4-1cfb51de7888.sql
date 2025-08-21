-- Create table for standard task checklists
CREATE TABLE public.standard_task_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  standard_task_id UUID NOT NULL,
  item_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standard_task_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All employees can view standard task checklists" 
ON public.standard_task_checklists 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify standard task checklists" 
ON public.standard_task_checklists 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

-- Create table for task completion checklists (tracking which items were checked)
CREATE TABLE public.task_completion_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  checklist_item_id UUID NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_completion_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All employees can view task completion checklists" 
ON public.task_completion_checklists 
FOR SELECT 
USING (true);

CREATE POLICY "All employees can modify task completion checklists" 
ON public.task_completion_checklists 
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_standard_task_checklists_updated_at
BEFORE UPDATE ON public.standard_task_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_completion_checklists_updated_at
BEFORE UPDATE ON public.task_completion_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();