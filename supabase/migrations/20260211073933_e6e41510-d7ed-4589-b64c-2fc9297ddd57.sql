-- Direct trigger creation for workstations
DROP TRIGGER IF EXISTS set_tenant_id_on_insert ON public.workstations;
CREATE TRIGGER set_tenant_id_on_insert
  BEFORE INSERT ON public.workstations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();