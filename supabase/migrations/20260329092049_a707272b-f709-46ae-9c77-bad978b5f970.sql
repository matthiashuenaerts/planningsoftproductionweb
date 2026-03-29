INSERT INTO role_permissions (tenant_id, role, navbar_item, can_access)
SELECT t.id, r.role::app_role, ni.item, ni.default_access
FROM (SELECT DISTINCT tenant_id AS id FROM role_permissions) t
CROSS JOIN (
  VALUES 
    ('admin'::app_role), ('manager'::app_role), ('worker'::app_role), ('workstation'::app_role), 
    ('installation_team'::app_role), ('preparater'::app_role), ('teamleader'::app_role)
) r(role)
CROSS JOIN (
  VALUES 
    ('notes-and-tasks', true),
    ('service-installation', true),
    ('logistics-out', true),
    ('invoices', false)
) ni(item, default_access)
ON CONFLICT DO NOTHING;

UPDATE role_permissions 
SET can_access = true 
WHERE navbar_item = 'invoices' AND role IN ('admin', 'manager');