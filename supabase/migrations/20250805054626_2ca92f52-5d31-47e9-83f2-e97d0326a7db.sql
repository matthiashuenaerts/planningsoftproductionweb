-- Create project_calculation_variables table
CREATE TABLE public.project_calculation_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  aantal_objecten INTEGER DEFAULT 0,
  aantal_kasten INTEGER DEFAULT 0,
  aantal_stuks INTEGER DEFAULT 0,
  aantal_platen INTEGER DEFAULT 0,
  aantal_zaagsnedes INTEGER DEFAULT 0,
  aantal_lopende_meters_zaagsnede INTEGER DEFAULT 0,
  aantal_verschillende_kantenbanden INTEGER DEFAULT 0,
  aantal_lopende_meter_kantenbanden INTEGER DEFAULT 0,
  aantal_drevel_programmas INTEGER DEFAULT 0,
  aantal_cnc_programmas INTEGER DEFAULT 0,
  aantal_boringen INTEGER DEFAULT 0,
  aantal_kasten_te_monteren INTEGER DEFAULT 0,
  aantal_manueel_te_monteren_kasten INTEGER DEFAULT 0,
  aantal_manueel_te_monteren_objecten INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create calculation_task_relationships table for settings
CREATE TABLE public.calculation_task_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_name TEXT NOT NULL,
  standard_task_id UUID NOT NULL REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  base_duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.project_calculation_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_task_relationships ENABLE ROW LEVEL SECURITY;

-- Policies for project_calculation_variables
CREATE POLICY "Allow all employees to view project calculation variables" 
ON public.project_calculation_variables 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins and managers can modify project calculation variables" 
ON public.project_calculation_variables 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role IN ('admin', 'manager')
));

-- Policies for calculation_task_relationships
CREATE POLICY "Allow all employees to view calculation task relationships" 
ON public.calculation_task_relationships 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify calculation task relationships" 
ON public.calculation_task_relationships 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

-- Create triggers for updating timestamps
CREATE TRIGGER update_project_calculation_variables_updated_at
  BEFORE UPDATE ON public.project_calculation_variables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calculation_task_relationships_updated_at
  BEFORE UPDATE ON public.calculation_task_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();