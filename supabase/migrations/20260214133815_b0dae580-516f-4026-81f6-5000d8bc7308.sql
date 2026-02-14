
-- Table for defining calculation variables (managed in settings)
CREATE TABLE public.calculation_variable_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  default_value INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(variable_key, tenant_id)
);

ALTER TABLE public.calculation_variable_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.calculation_variable_definitions
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Table for storing per-project variable values (key-value based)
CREATE TABLE public.project_calculation_variable_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  variable_definition_id UUID NOT NULL REFERENCES public.calculation_variable_definitions(id) ON DELETE CASCADE,
  value INTEGER NOT NULL DEFAULT 0,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, variable_definition_id)
);

ALTER TABLE public.project_calculation_variable_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.project_calculation_variable_values
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Seed existing hardcoded variables as definitions
INSERT INTO public.calculation_variable_definitions (variable_key, display_name, display_order, tenant_id)
SELECT v.variable_key, v.display_name, v.display_order, t.id
FROM (VALUES
  ('aantal_objecten', 'Aantal Objecten', 1),
  ('aantal_kasten', 'Aantal Kasten', 2),
  ('aantal_stuks', 'Aantal Stuks', 3),
  ('aantal_platen', 'Aantal Platen', 4),
  ('aantal_zaagsnedes', 'Aantal Zaagsnedes', 5),
  ('aantal_lopende_meters_zaagsnede', 'Aantal Lopende Meters Zaagsnede', 6),
  ('aantal_verschillende_kantenbanden', 'Aantal Verschillende Kantenbanden', 7),
  ('aantal_lopende_meter_kantenbanden', 'Aantal Lopende Meter Kantenbanden', 8),
  ('aantal_drevel_programmas', 'Aantal Drevel Programmas', 9),
  ('aantal_cnc_programmas', 'Aantal CNC Programmas', 10),
  ('aantal_boringen', 'Aantal Boringen', 11),
  ('aantal_kasten_te_monteren', 'Aantal Kasten Te Monteren', 12),
  ('aantal_manueel_te_monteren_kasten', 'Aantal Manueel Te Monteren Kasten', 13),
  ('aantal_manueel_te_monteren_objecten', 'Aantal Manueel Te Monteren Objecten', 14)
) AS v(variable_key, display_name, display_order)
CROSS JOIN public.tenants t;

-- Migrate existing project_calculation_variables data to new key-value table
INSERT INTO public.project_calculation_variable_values (project_id, variable_definition_id, value, tenant_id)
SELECT pcv.project_id, cvd.id, 
  CASE cvd.variable_key
    WHEN 'aantal_objecten' THEN pcv.aantal_objecten
    WHEN 'aantal_kasten' THEN pcv.aantal_kasten
    WHEN 'aantal_stuks' THEN pcv.aantal_stuks
    WHEN 'aantal_platen' THEN pcv.aantal_platen
    WHEN 'aantal_zaagsnedes' THEN pcv.aantal_zaagsnedes
    WHEN 'aantal_lopende_meters_zaagsnede' THEN pcv.aantal_lopende_meters_zaagsnede
    WHEN 'aantal_verschillende_kantenbanden' THEN pcv.aantal_verschillende_kantenbanden
    WHEN 'aantal_lopende_meter_kantenbanden' THEN pcv.aantal_lopende_meter_kantenbanden
    WHEN 'aantal_drevel_programmas' THEN pcv.aantal_drevel_programmas
    WHEN 'aantal_cnc_programmas' THEN pcv.aantal_cnc_programmas
    WHEN 'aantal_boringen' THEN pcv.aantal_boringen
    WHEN 'aantal_kasten_te_monteren' THEN pcv.aantal_kasten_te_monteren
    WHEN 'aantal_manueel_te_monteren_kasten' THEN pcv.aantal_manueel_te_monteren_kasten
    WHEN 'aantal_manueel_te_monteren_objecten' THEN pcv.aantal_manueel_te_monteren_objecten
  END,
  pcv.tenant_id
FROM public.project_calculation_variables pcv
CROSS JOIN public.calculation_variable_definitions cvd
WHERE cvd.tenant_id = pcv.tenant_id;
