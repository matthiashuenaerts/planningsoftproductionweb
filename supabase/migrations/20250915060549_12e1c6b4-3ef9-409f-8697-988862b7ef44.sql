-- Create table for manual loading date overrides
CREATE TABLE public.project_loading_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  original_loading_date DATE NOT NULL,
  override_loading_date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_loading_overrides ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All employees can view loading overrides" 
ON public.project_loading_overrides 
FOR SELECT 
USING (true);

CREATE POLICY "All employees can create loading overrides" 
ON public.project_loading_overrides 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "All employees can update loading overrides" 
ON public.project_loading_overrides 
FOR UPDATE 
USING (true);

CREATE POLICY "All employees can delete loading overrides" 
ON public.project_loading_overrides 
FOR DELETE 
USING (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_project_loading_overrides_updated_at
BEFORE UPDATE ON public.project_loading_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();