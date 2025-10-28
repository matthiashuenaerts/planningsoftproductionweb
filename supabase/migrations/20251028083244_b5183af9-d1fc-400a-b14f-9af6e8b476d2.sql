-- Simplify authenticate_employee to match existing employees schema
DROP FUNCTION IF EXISTS public.authenticate_employee(TEXT, TEXT);

CREATE FUNCTION public.authenticate_employee(
  employee_name TEXT,
  employee_password TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT,
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
    e.workstation,
    e.logistics
  FROM public.employees e
  WHERE e.name = employee_name
    AND e.password = employee_password;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;