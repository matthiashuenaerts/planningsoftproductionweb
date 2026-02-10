
-- Fix authenticate_developer_by_name to join on employee id
CREATE OR REPLACE FUNCTION public.authenticate_developer_by_name(
  p_name TEXT,
  p_password TEXT
)
RETURNS TABLE(employee_id UUID, employee_name TEXT, email TEXT, auth_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.email, e.auth_user_id
  FROM public.employees e
  JOIN public.user_roles ur ON ur.user_id = e.id
  WHERE e.name = p_name
    AND e.password = p_password
    AND ur.role = 'developer'
  LIMIT 1;
END;
$$;

-- Fix is_developer to join through employees
CREATE OR REPLACE FUNCTION public.is_developer(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.employees e ON e.id = ur.user_id
    WHERE e.auth_user_id = p_user_id
      AND ur.role::text = 'developer'
  );
$$;

-- Fix has_role to join through employees  
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.employees e ON e.id = ur.user_id
    WHERE e.auth_user_id = _user_id
      AND ur.role = _role
  );
$$;

-- Fix has_any_role to join through employees
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.employees e ON e.id = ur.user_id
    WHERE e.auth_user_id = _user_id
      AND ur.role = ANY(_roles)
  );
$$;
