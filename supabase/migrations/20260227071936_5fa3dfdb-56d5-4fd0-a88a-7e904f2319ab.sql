-- Insert teamleader role permissions for all menus except invoices
INSERT INTO role_permissions (role, navbar_item, can_access)
VALUES
  ('teamleader', 'dashboard', true),
  ('teamleader', 'projects', true),
  ('teamleader', 'workstations', true),
  ('teamleader', 'broken-parts', true),
  ('teamleader', 'personal-tasks', true),
  ('teamleader', 'daily-tasks', true),
  ('teamleader', 'planning', true),
  ('teamleader', 'orders', true),
  ('teamleader', 'logistics', true),
  ('teamleader', 'rush-orders', true),
  ('teamleader', 'time-registrations', true),
  ('teamleader', 'settings', true),
  ('teamleader', 'control-panel', true)
ON CONFLICT DO NOTHING;