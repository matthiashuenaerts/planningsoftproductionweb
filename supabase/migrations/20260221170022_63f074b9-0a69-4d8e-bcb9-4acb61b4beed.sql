-- Add set_tenant_id_on_insert triggers to tables missing them
CREATE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.working_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.working_hours_breaks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.email_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.email_schedule_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();