-- Update broken_parts delete policy to restrict to admins only
DROP POLICY IF EXISTS "auth_can_delete_broken_parts" ON public.broken_parts;

CREATE POLICY "admins_can_delete_broken_parts" 
ON public.broken_parts
FOR DELETE
TO authenticated
USING (check_employee_role(auth.uid(), 'admin'::text));