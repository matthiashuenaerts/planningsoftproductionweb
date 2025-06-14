
-- Drop the existing role check constraint if it exists
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- Add a new role check constraint that includes 'teamleader'
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check CHECK (
  role IN (
    'admin', 
    'manager', 
    'worker', 
    'workstation', 
    'installation_team', 
    'teamleader'
  )
);
