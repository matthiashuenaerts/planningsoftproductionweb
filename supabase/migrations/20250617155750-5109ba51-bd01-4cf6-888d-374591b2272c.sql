
-- Update the employees table role check constraint to include 'preparater'
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
CHECK (role IN ('admin', 'manager', 'worker', 'workstation', 'installation_team', 'teamleader', 'preparater'));

-- Insert role permissions for preparater (same as worker)
INSERT INTO role_permissions (role, navbar_item, can_access)
SELECT 'preparater'::app_role, navbar_item, can_access
FROM role_permissions 
WHERE role = 'worker'
ON CONFLICT (role, navbar_item) DO NOTHING;
