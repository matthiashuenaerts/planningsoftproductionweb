-- Drop old conflicting policy on schedules table
DROP POLICY IF EXISTS "Only admins can modify schedules" ON public.schedules;

-- Drop the generic "Everyone can view schedules" policy
DROP POLICY IF EXISTS "Everyone can view schedules" ON public.schedules;

-- Ensure the correct policies exist
DROP POLICY IF EXISTS "admins_managers_modify_schedules" ON public.schedules;
DROP POLICY IF EXISTS "employees_view_schedules" ON public.schedules;

-- Create clear, specific policies for schedules table
-- Allow all authenticated employees to view schedules
CREATE POLICY "employees_view_schedules" 
ON public.schedules
FOR SELECT
TO authenticated
USING (true);

-- Allow admins and managers to insert schedules
CREATE POLICY "admins_managers_insert_schedules" 
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (check_employee_roles(auth.uid(), ARRAY['admin'::text, 'manager'::text]));

-- Allow admins and managers to update schedules
CREATE POLICY "admins_managers_update_schedules" 
ON public.schedules
FOR UPDATE
TO authenticated
USING (check_employee_roles(auth.uid(), ARRAY['admin'::text, 'manager'::text]))
WITH CHECK (check_employee_roles(auth.uid(), ARRAY['admin'::text, 'manager'::text]));

-- Allow admins and managers to delete schedules
CREATE POLICY "admins_managers_delete_schedules" 
ON public.schedules
FOR DELETE
TO authenticated
USING (check_employee_roles(auth.uid(), ARRAY['admin'::text, 'manager'::text]));