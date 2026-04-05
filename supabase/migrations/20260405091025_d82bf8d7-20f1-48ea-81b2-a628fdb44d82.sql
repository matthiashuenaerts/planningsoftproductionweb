
-- Add measurer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'measurer';

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  address_street TEXT,
  address_number TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  address_country TEXT,
  vat_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.customers
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()));

CREATE TRIGGER set_tenant_id_customers
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add customer_id to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create project_measurements table
CREATE TABLE public.project_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  measurement_date DATE,
  measurer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  customer_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.project_measurements
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()));

CREATE TRIGGER set_tenant_id_measurements
  BEFORE INSERT ON public.project_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER update_measurements_updated_at
  BEFORE UPDATE ON public.project_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create measurement-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('measurement-files', 'measurement-files', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users can upload measurement files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'measurement-files');

CREATE POLICY "Auth users can view measurement files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'measurement-files');

CREATE POLICY "Auth users can delete measurement files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'measurement-files');
