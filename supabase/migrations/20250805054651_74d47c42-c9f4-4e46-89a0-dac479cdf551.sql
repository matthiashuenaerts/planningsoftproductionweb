-- Enable RLS on all tables that don't have it enabled
ALTER TABLE public.rush_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_task_limit_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_truck_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_messages ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for the most critical tables
CREATE POLICY "Allow all employees to view rush orders" 
ON public.rush_orders 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to view orders" 
ON public.orders 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to view standard tasks" 
ON public.standard_tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to view accessories" 
ON public.accessories 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to view notifications" 
ON public.notifications 
FOR SELECT 
USING (true);