-- Add optional project_id column to rush_orders table
ALTER TABLE public.rush_orders 
ADD COLUMN project_id uuid REFERENCES public.projects(id);

-- Add index for better performance
CREATE INDEX idx_rush_orders_project_id ON public.rush_orders(project_id);