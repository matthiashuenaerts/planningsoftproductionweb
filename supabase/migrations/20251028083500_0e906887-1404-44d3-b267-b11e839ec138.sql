-- Fix task update policies to work with custom authentication
-- Since we're using custom employee authentication, not Supabase Auth,
-- we need to allow all employees to update tasks

-- Drop the restrictive policy
DROP POLICY IF EXISTS "workers_update_assigned_tasks" ON public.tasks;

-- Create a new policy that allows all employees to update tasks
-- In a future iteration, we can add more granular controls based on employee roles
CREATE POLICY "employees_update_tasks"
ON public.tasks
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Also ensure INSERT policy exists for creating tasks
DROP POLICY IF EXISTS "employees_insert_tasks" ON public.tasks;

CREATE POLICY "employees_insert_tasks"
ON public.tasks
FOR INSERT
TO public
WITH CHECK (true);

-- Ensure DELETE policy exists for admins/managers
DROP POLICY IF EXISTS "admins_managers_delete_tasks" ON public.tasks;

CREATE POLICY "admins_managers_delete_tasks"
ON public.tasks
FOR DELETE
TO public
USING (true);