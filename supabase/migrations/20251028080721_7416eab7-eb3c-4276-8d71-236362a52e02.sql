-- ============================================
-- PHASE 2: COMPLETE REMAINING RLS SECURITY
-- ============================================

-- ========================================
-- STEP 1: ENABLE RLS ON REMAINING TABLES
-- ========================================

-- Projects and related
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Rush orders system
ALTER TABLE public.rush_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rush_order_task_links ENABLE ROW LEVEL SECURITY;

-- Time tracking
ALTER TABLE public.time_registrations ENABLE ROW LEVEL SECURITY;

-- Workstation management
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_errors ENABLE ROW LEVEL SECURITY;

-- Standard tasks
ALTER TABLE public.standard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_task_workstation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_task_limit_phases ENABLE ROW LEVEL SECURITY;

-- Task management
ALTER TABLE public.task_completion_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_workstation_links ENABLE ROW LEVEL SECURITY;

-- Settings and configuration
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_system ENABLE ROW LEVEL SECURITY;

-- Scheduling
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: CREATE POLICIES FOR TABLES
-- ========================================

-- PROJECTS
CREATE POLICY "employees_view_projects" ON public.projects
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_projects" ON public.projects
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- RUSH ORDERS
CREATE POLICY "employees_view_rush_orders" ON public.rush_orders
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_rush_orders" ON public.rush_orders
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- RUSH ORDER TASKS
CREATE POLICY "employees_view_rush_order_tasks" ON public.rush_order_tasks
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_rush_order_tasks" ON public.rush_order_tasks
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- RUSH ORDER ASSIGNMENTS
CREATE POLICY "employees_view_rush_order_assignments" ON public.rush_order_assignments
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_rush_order_assignments" ON public.rush_order_assignments
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- RUSH ORDER MESSAGES
CREATE POLICY "employees_view_rush_order_messages" ON public.rush_order_messages
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "employees_create_rush_order_messages" ON public.rush_order_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "employees_update_own_rush_order_messages" ON public.rush_order_messages
FOR UPDATE TO authenticated
USING (auth.uid() = employee_id);

-- RUSH ORDER TASK LINKS
CREATE POLICY "employees_view_rush_order_task_links" ON public.rush_order_task_links
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_rush_order_task_links" ON public.rush_order_task_links
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- TIME REGISTRATIONS
CREATE POLICY "employees_view_own_time_registrations" ON public.time_registrations
FOR SELECT TO authenticated
USING (auth.uid() = employee_id OR public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

CREATE POLICY "employees_create_own_time_registrations" ON public.time_registrations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "employees_update_own_time_registrations" ON public.time_registrations
FOR UPDATE TO authenticated
USING (auth.uid() = employee_id OR public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

CREATE POLICY "admins_delete_time_registrations" ON public.time_registrations
FOR DELETE TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'));

-- WORKSTATIONS
CREATE POLICY "employees_view_workstations" ON public.workstations
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_workstations" ON public.workstations
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- WORKSTATION POSITIONS
CREATE POLICY "employees_view_workstation_positions" ON public.workstation_positions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_workstation_positions" ON public.workstation_positions
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- WORKSTATION SCHEDULES
CREATE POLICY "employees_view_workstation_schedules" ON public.workstation_schedules
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_workstation_schedules" ON public.workstation_schedules
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- WORKSTATION TASKS
CREATE POLICY "employees_view_workstation_tasks" ON public.workstation_tasks
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_workstation_tasks" ON public.workstation_tasks
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- WORKSTATION ERRORS
CREATE POLICY "employees_view_workstation_errors" ON public.workstation_errors
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "employees_create_workstation_errors" ON public.workstation_errors
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "admins_resolve_workstation_errors" ON public.workstation_errors
FOR UPDATE TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- STANDARD TASKS
CREATE POLICY "employees_view_standard_tasks" ON public.standard_tasks
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_standard_tasks" ON public.standard_tasks
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- STANDARD TASK CHECKLISTS
CREATE POLICY "employees_view_standard_task_checklists" ON public.standard_task_checklists
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_standard_task_checklists" ON public.standard_task_checklists
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- STANDARD TASK WORKSTATION LINKS
CREATE POLICY "employees_view_standard_task_workstation_links" ON public.standard_task_workstation_links
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_standard_task_workstation_links" ON public.standard_task_workstation_links
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- STANDARD TASK LIMIT PHASES
CREATE POLICY "employees_view_standard_task_limit_phases" ON public.standard_task_limit_phases
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_standard_task_limit_phases" ON public.standard_task_limit_phases
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- TASK COMPLETION CHECKLISTS
CREATE POLICY "employees_view_task_completion_checklists" ON public.task_completion_checklists
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "employees_create_task_completion_checklists" ON public.task_completion_checklists
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "employees_update_task_completion_checklists" ON public.task_completion_checklists
FOR UPDATE TO authenticated
USING (true);

-- TASK WORKSTATION LINKS
CREATE POLICY "employees_view_task_workstation_links" ON public.task_workstation_links
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_task_workstation_links" ON public.task_workstation_links
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- SUPPLIERS
CREATE POLICY "employees_view_suppliers" ON public.suppliers
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_suppliers" ON public.suppliers
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- STOCK LOCATIONS
CREATE POLICY "employees_view_stock_locations" ON public.stock_locations
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_stock_locations" ON public.stock_locations
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- TRUCKS
CREATE POLICY "employees_view_trucks" ON public.trucks
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_trucks" ON public.trucks
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- ROLE PERMISSIONS
CREATE POLICY "employees_view_role_permissions" ON public.role_permissions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_role_permissions" ON public.role_permissions
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- STORAGE SYSTEM
CREATE POLICY "employees_view_storage_system" ON public.storage_system
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_storage_system" ON public.storage_system
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- SCHEDULES
CREATE POLICY "employees_view_schedules" ON public.schedules
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_managers_modify_schedules" ON public.schedules
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- WORK HOURS
CREATE POLICY "employees_view_work_hours" ON public.work_hours
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_work_hours" ON public.work_hours
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- WORKING HOURS
CREATE POLICY "employees_view_working_hours" ON public.working_hours
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admins_modify_working_hours" ON public.working_hours
FOR ALL TO authenticated
USING (public.check_employee_role(auth.uid(), 'admin'))
WITH CHECK (public.check_employee_role(auth.uid(), 'admin'));

-- ========================================
-- STEP 3: FIX FUNCTION SEARCH PATHS
-- ========================================

-- Update all functions that need search_path set
CREATE OR REPLACE FUNCTION public.calculate_loading_date(installation_date date)
RETURNS date
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  loading_date DATE;
BEGIN
  loading_date := installation_date - INTERVAL '1 day';
  
  IF EXTRACT(DOW FROM installation_date) = 1 THEN
    loading_date := installation_date - INTERVAL '3 days';
  ELSIF EXTRACT(DOW FROM installation_date) = 0 THEN
    loading_date := installation_date - INTERVAL '2 days';
  END IF;
  
  RETURN loading_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_phase_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.phases
  SET progress = (
    SELECT COALESCE(
      (COUNT(CASE WHEN status = 'COMPLETED' THEN 1 ELSE NULL END) * 100) / 
      NULLIF(COUNT(*), 0),
      0
    )::INTEGER
    FROM public.tasks
    WHERE phase_id = NEW.phase_id
  ),
  updated_at = now()
  WHERE id = NEW.phase_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET progress = (
    SELECT COALESCE(AVG(progress), 0)::INTEGER
    FROM public.phases
    WHERE project_id = NEW.project_id
  ),
  updated_at = now()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_employee_on_holiday(emp_id uuid, check_date date)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM holiday_requests 
    WHERE user_id = emp_id 
      AND start_date <= check_date 
      AND end_date >= check_date
      AND status = 'approved'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_phase_offsets()
RETURNS TABLE(id uuid, phase_id uuid, phase_name text, days_before_installation integer, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.phase_id,
    p.name AS phase_name,
    po.days_before_installation,
    po.created_at,
    po.updated_at
  FROM public.phase_offsets po
  JOIN public.phases p ON po.phase_id = p.id
  ORDER BY p.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.setup_phase_offsets_table()
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.table_exists(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = table_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_project_installation_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects 
  SET installation_date = NEW.start_date + (NEW.duration - 1),
      updated_at = now()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_loading_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.loading_date := calculate_loading_date(NEW.installation_date);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;