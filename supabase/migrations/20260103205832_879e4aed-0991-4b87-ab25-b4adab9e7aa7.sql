-- Create project_costing table to store additional cost parameters
CREATE TABLE public.project_costing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  material_cost NUMERIC DEFAULT 0,
  office_preparation_cost NUMERIC DEFAULT 0,
  transport_installation_cost NUMERIC DEFAULT 0,
  other_cost NUMERIC DEFAULT 0,
  sales_price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_costing_updated_at
BEFORE UPDATE ON public.project_costing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();