-- Fix: Always set tenant_id based on authenticated user, not just when NULL
-- This overrides the hardcoded default '00000000-0000-0000-0000-000000000001'
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the tenant_id for the authenticated user
  v_tenant_id := public.get_user_tenant_id(auth.uid());
  
  -- Always set tenant_id if we can resolve the user's tenant
  IF v_tenant_id IS NOT NULL THEN
    NEW.tenant_id := v_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$function$;