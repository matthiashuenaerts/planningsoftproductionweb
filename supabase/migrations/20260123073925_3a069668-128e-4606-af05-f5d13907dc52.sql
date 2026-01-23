-- Create production_routes table
CREATE TABLE public.production_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create production_route_tasks linking table
CREATE TABLE public.production_route_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.production_routes(id) ON DELETE CASCADE,
  standard_task_id UUID NOT NULL REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(route_id, standard_task_id)
);

-- Enable Row Level Security
ALTER TABLE public.production_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_route_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for production_routes
CREATE POLICY "Users can view production routes" 
ON public.production_routes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert production routes" 
ON public.production_routes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update production routes" 
ON public.production_routes 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete production routes" 
ON public.production_routes 
FOR DELETE 
USING (true);

-- Create policies for production_route_tasks
CREATE POLICY "Users can view production route tasks" 
ON public.production_route_tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert production route tasks" 
ON public.production_route_tasks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can delete production route tasks" 
ON public.production_route_tasks 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates on production_routes
CREATE TRIGGER update_production_routes_updated_at
BEFORE UPDATE ON public.production_routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_production_route_tasks_route_id ON public.production_route_tasks(route_id);
CREATE INDEX idx_production_route_tasks_standard_task_id ON public.production_route_tasks(standard_task_id);

-- Add comments
COMMENT ON TABLE public.production_routes IS 'Production routing templates for project task selection';
COMMENT ON TABLE public.production_route_tasks IS 'Links standard tasks to production routes';