-- Enable RLS on all tables that have policies but RLS disabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_task_workstation_links ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for tasks table to allow all operations
CREATE POLICY "Allow all operations on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for phases table
CREATE POLICY "Allow all operations on phases" ON public.phases FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for projects table
CREATE POLICY "Allow all operations on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for employees table
CREATE POLICY "Allow all operations on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for workstations table
CREATE POLICY "Allow all operations on workstations" ON public.workstations FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for time_registrations table
CREATE POLICY "Allow all operations on time_registrations" ON public.time_registrations FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for notifications table
CREATE POLICY "Allow all operations on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for rush_orders table
CREATE POLICY "Allow all operations on rush_orders" ON public.rush_orders FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for rush_order_assignments table
CREATE POLICY "Allow all operations on rush_order_assignments" ON public.rush_order_assignments FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for rush_order_tasks table
CREATE POLICY "Allow all operations on rush_order_tasks" ON public.rush_order_tasks FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for standard_tasks table
CREATE POLICY "Allow all operations on standard_tasks" ON public.standard_tasks FOR ALL USING (true) WITH CHECK (true);

-- Create permissive policies for standard_task_workstation_links table
CREATE POLICY "Allow all operations on standard_task_workstation_links" ON public.standard_task_workstation_links FOR ALL USING (true) WITH CHECK (true);