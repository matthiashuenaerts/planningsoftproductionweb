INSERT INTO role_permissions (role, navbar_item, can_access)
SELECT r.role, 'measurement-calendar', true
FROM (SELECT DISTINCT role FROM role_permissions) r
WHERE r.role IN ('admin', 'manager', 'measurer')
ON CONFLICT (role, navbar_item) DO NOTHING;