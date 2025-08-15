-- Add rush_order_id and project_name columns to time_registrations table
ALTER TABLE public.time_registrations 
ADD COLUMN rush_order_id uuid REFERENCES public.rush_orders(id),
ADD COLUMN project_name text;

-- Add index for better performance
CREATE INDEX idx_time_registrations_rush_order_id ON public.time_registrations(rush_order_id);