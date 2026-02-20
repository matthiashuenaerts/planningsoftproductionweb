
-- Create floorplan_settings table for tenant-specific floorplan images
CREATE TABLE IF NOT EXISTS public.floorplan_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.floorplan_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.floorplan_settings
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE TRIGGER set_tenant_id_floorplan_settings
  BEFORE INSERT ON public.floorplan_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER update_floorplan_settings_updated_at
  BEFORE UPDATE ON public.floorplan_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
