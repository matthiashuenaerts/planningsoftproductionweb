-- Drop and recreate the authenticate_employee function with all necessary fields
DROP FUNCTION IF EXISTS public.authenticate_employee(TEXT, TEXT);

CREATE FUNCTION public.authenticate_employee(
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
  hourly_rate NUMERIC,
  workstation TEXT,
  logistics BOOLEAN
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
    e.hourly_rate,
    e.workstation,
    e.logistics
  FROM public.employees e
  WHERE e.name = employee_name
    AND e.password = employee_password;
END;
$$;

-- Re-grant execute permission to public (unauthenticated users)
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;