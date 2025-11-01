-- Step 1: Add auth_user_id column to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON public.employees(auth_user_id);

-- Step 2: Drop and recreate check_employee_role function with CASCADE
DROP FUNCTION IF EXISTS public.check_employee_role(uuid, text) CASCADE;

CREATE FUNCTION public.check_employee_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_user_id = user_id
    AND role = required_role
  )
$$;

-- Step 3: Drop and recreate check_employee_roles function with CASCADE
DROP FUNCTION IF EXISTS public.check_employee_roles(uuid, text[]) CASCADE;

CREATE FUNCTION public.check_employee_roles(user_id uuid, required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_user_id = user_id
    AND role = ANY(required_roles)
  )
$$;

-- Step 4: Create helper function to get employee_id from auth user
CREATE OR REPLACE FUNCTION public.get_employee_id_from_auth(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.employees
  WHERE auth_user_id = user_id
  LIMIT 1
$$;

-- Step 5: Recreate all the dropped RLS policies
CREATE POLICY "admins_modify_phase_offsets" ON phase_offsets
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_calculation_relationships" ON calculation_task_relationships
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_update_holiday_requests" ON holiday_requests
FOR UPDATE USING (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_view_holiday_requests" ON holiday_requests
FOR SELECT USING (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_email_configs" ON email_configurations
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_schedule_configs" ON email_schedule_configs
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_employees" ON employees
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_help_articles" ON help_articles
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_help_categories" ON help_categories
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_placement_teams" ON placement_teams
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_flow_lines" ON production_flow_lines
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_products" ON products
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_delete_time_registrations" ON time_registrations
FOR DELETE USING (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_workstations" ON workstations
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_workstation_positions" ON workstation_positions
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_workstation_tasks" ON workstation_tasks
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_standard_tasks" ON standard_tasks
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_standard_task_checklists" ON standard_task_checklists
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_standard_task_workstation_links" ON standard_task_workstation_links
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_standard_task_limit_phases" ON standard_task_limit_phases
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_suppliers" ON suppliers
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_stock_locations" ON stock_locations
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_trucks" ON trucks
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_role_permissions" ON role_permissions
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_storage_system" ON storage_system
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_work_hours" ON work_hours
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "admins_modify_working_hours" ON working_hours
FOR ALL USING (check_employee_role(auth.uid(), 'admin')) WITH CHECK (check_employee_role(auth.uid(), 'admin'));