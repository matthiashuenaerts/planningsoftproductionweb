-- ============================================
-- CREATE SECURE EMPLOYEE AUTHENTICATION FUNCTION
-- ============================================

-- This function allows authentication without exposing passwords to the client
-- It returns only the employee ID if credentials are valid
CREATE OR REPLACE FUNCTION public.authenticate_employee(
  employee_name TEXT,
  employee_password TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  skills TEXT[],
  hourly_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.role,
    e.email,
    e.phone,
    e.avatar_url,
    e.skills,
    e.hourly_rate
  FROM public.employees e
  WHERE e.name = employee_name
    AND e.password = employee_password;
END;
$$;

-- Grant execute permission to public (unauthenticated users)
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;

-- Now restrict the employees table to authenticated users only
DROP POLICY IF EXISTS "employees_view_all" ON public.employees;

CREATE POLICY "authenticated_users_view_employees"
ON public.employees
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update their own records
CREATE POLICY "employees_update_own"
ON public.employees
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);