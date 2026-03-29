-- First drop the dependent policy
DROP POLICY IF EXISTS "tenant_isolation" ON role_permissions;

-- Now drop FK and column
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_tenant_id_fkey;
ALTER TABLE role_permissions DROP COLUMN IF EXISTS tenant_id;

-- Add read policy for all authenticated users
CREATE POLICY "authenticated_read_role_permissions"
ON role_permissions FOR SELECT TO authenticated
USING (true);

-- Add manage policy for admins/developers
CREATE POLICY "admin_manage_role_permissions"
ON role_permissions FOR ALL TO authenticated
USING (
  public.is_developer(auth.uid()) 
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_developer(auth.uid()) 
  OR public.is_admin(auth.uid())
);