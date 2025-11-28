-- Create project_models table to store reusable project configurations
CREATE TABLE public.project_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.cabinet_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_material_id UUID REFERENCES public.cabinet_materials(id),
  door_material_id UUID REFERENCES public.cabinet_materials(id),
  shelf_material_id UUID REFERENCES public.cabinet_materials(id),
  edge_banding TEXT DEFAULT 'PVC',
  finish TEXT DEFAULT 'matte',
  plinth_height INTEGER DEFAULT 100,
  body_thickness INTEGER DEFAULT 18,
  door_thickness INTEGER DEFAULT 18,
  shelf_thickness INTEGER DEFAULT 18,
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create front_hardware table for multiple hardware per front
CREATE TABLE public.front_hardware (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  front_id UUID NOT NULL REFERENCES public.cabinet_fronts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  hardware_type TEXT NOT NULL, -- 'hinge', 'damper', 'runner', 'handle', 'other'
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add model_id to cabinet_configurations to link to project models
ALTER TABLE public.cabinet_configurations 
ADD COLUMN IF NOT EXISTS project_model_id UUID REFERENCES public.project_models(id);

-- Enable RLS
ALTER TABLE public.project_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_hardware ENABLE ROW LEVEL SECURITY;

-- Create policies for project_models
CREATE POLICY "Users can view all project models"
ON public.project_models FOR SELECT USING (true);

CREATE POLICY "Users can insert project models"
ON public.project_models FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update project models"
ON public.project_models FOR UPDATE USING (true);

CREATE POLICY "Users can delete project models"
ON public.project_models FOR DELETE USING (true);

-- Create policies for front_hardware
CREATE POLICY "Users can view all front hardware"
ON public.front_hardware FOR SELECT USING (true);

CREATE POLICY "Users can insert front hardware"
ON public.front_hardware FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update front hardware"
ON public.front_hardware FOR UPDATE USING (true);

CREATE POLICY "Users can delete front hardware"
ON public.front_hardware FOR DELETE USING (true);

-- Create trigger for updated_at on project_models
CREATE TRIGGER update_project_models_updated_at
BEFORE UPDATE ON public.project_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();