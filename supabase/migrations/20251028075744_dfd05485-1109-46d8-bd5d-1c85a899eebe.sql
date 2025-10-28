-- =====================================================
-- PHASE 1: Create Security Definer Functions
-- =====================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.check_employee_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.check_employee_roles(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- =====================================================
-- PHASE 2: Enable RLS on All Tables
-- =====================================================

-- Critical tables with existing policies
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broken_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_task_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_schedule_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_workstation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_item_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_item_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_offsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_flow_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_calculation_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_loading_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_onedrive_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_truck_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PHASE 3: Create Policies for Tables Without Any
-- =====================================================

-- Tasks table (CRITICAL - no policies exist)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_view_tasks" ON public.tasks
FOR SELECT 
USING (true);

CREATE POLICY "admins_managers_modify_tasks" ON public.tasks
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

CREATE POLICY "workers_update_assigned_tasks" ON public.tasks
FOR UPDATE 
USING (assignee_id = auth.uid())
WITH CHECK (assignee_id = auth.uid());

-- Project team assignments
CREATE POLICY "all_view_team_assignments" ON public.project_team_assignments
FOR SELECT 
USING (true);

CREATE POLICY "admins_managers_modify_team_assignments" ON public.project_team_assignments
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- Project truck assignments
CREATE POLICY "all_view_truck_assignments" ON public.project_truck_assignments
FOR SELECT 
USING (true);

CREATE POLICY "admins_managers_modify_truck_assignments" ON public.project_truck_assignments
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- Phase offsets
CREATE POLICY "all_view_phase_offsets" ON public.phase_offsets
FOR SELECT 
USING (true);

CREATE POLICY "admins_modify_phase_offsets" ON public.phase_offsets
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- =====================================================
-- PHASE 4: Update Existing Policies
-- =====================================================

-- Drop and recreate policies that check roles recursively
DROP POLICY IF EXISTS "Only admins can modify calculation task relationships" ON public.calculation_task_relationships;
CREATE POLICY "admins_modify_calculation_relationships" ON public.calculation_task_relationships
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all holiday requests" ON public.holiday_requests;
CREATE POLICY "admins_update_holiday_requests" ON public.holiday_requests
FOR UPDATE 
USING (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all holiday requests" ON public.holiday_requests;
CREATE POLICY "admins_view_holiday_requests" ON public.holiday_requests
FOR SELECT 
USING (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify email configurations" ON public.email_configurations;
CREATE POLICY "admins_modify_email_configs" ON public.email_configurations
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify schedule configs" ON public.email_schedule_configs;
CREATE POLICY "admins_modify_schedule_configs" ON public.email_schedule_configs
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins and managers can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;
DROP POLICY IF EXISTS "Allow all operations on employees" ON public.employees;
DROP POLICY IF EXISTS "Allow all reads" ON public.employees;

CREATE POLICY "employees_view_all" ON public.employees
FOR SELECT 
USING (true);

CREATE POLICY "admins_modify_employees" ON public.employees
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify help articles" ON public.help_articles;
CREATE POLICY "admins_modify_help_articles" ON public.help_articles
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify help categories" ON public.help_categories;
CREATE POLICY "admins_modify_help_categories" ON public.help_categories
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins and managers can insert team members" ON public.placement_team_members;
DROP POLICY IF EXISTS "Admins and managers can update team members" ON public.placement_team_members;
DROP POLICY IF EXISTS "Admins and managers can delete team members" ON public.placement_team_members;

CREATE POLICY "admins_managers_modify_team_members" ON public.placement_team_members
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

DROP POLICY IF EXISTS "Only admins can modify placement teams" ON public.placement_teams;
CREATE POLICY "admins_modify_placement_teams" ON public.placement_teams
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify production flow lines" ON public.production_flow_lines;
CREATE POLICY "admins_modify_flow_lines" ON public.production_flow_lines
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can modify products" ON public.products;
CREATE POLICY "admins_modify_products" ON public.products
FOR ALL 
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins and managers can modify project calculation variabl" ON public.project_calculation_variables;
CREATE POLICY "admins_managers_modify_calc_vars" ON public.project_calculation_variables
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

DROP POLICY IF EXISTS "Only admins and managers can modify phases" ON public.phases;
CREATE POLICY "admins_managers_modify_phases" ON public.phases
FOR ALL 
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- =====================================================
-- PHASE 5: Enable Realtime for Critical Tables
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_registrations;

-- Enable replica identity for realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.time_registrations REPLICA IDENTITY FULL;