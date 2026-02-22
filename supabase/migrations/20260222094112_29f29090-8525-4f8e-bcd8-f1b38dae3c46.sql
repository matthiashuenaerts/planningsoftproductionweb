
-- Re-create triggers for working_hours and working_hours_breaks
CREATE OR REPLACE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.working_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE OR REPLACE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.working_hours_breaks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE OR REPLACE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.email_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE OR REPLACE TRIGGER set_tenant_id_trigger
  BEFORE INSERT ON public.email_schedule_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();
