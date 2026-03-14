
-- Add fixed_time column to project_team_assignments for pinning arrival times
ALTER TABLE public.project_team_assignments 
ADD COLUMN IF NOT EXISTS fixed_time TEXT DEFAULT NULL;

-- Create service_routes table to persist optimized routes
CREATE TABLE IF NOT EXISTS public.service_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.placement_teams(id) ON DELETE CASCADE NOT NULL,
  route_date DATE NOT NULL,
  route_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, route_date)
);

-- Enable RLS
ALTER TABLE public.service_routes ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_routes
CREATE POLICY "Authenticated users can read service_routes"
ON public.service_routes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert service_routes"
ON public.service_routes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update service_routes"
ON public.service_routes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete service_routes"
ON public.service_routes FOR DELETE TO authenticated USING (true);

-- Auto-set tenant_id
CREATE TRIGGER set_service_routes_tenant_id
  BEFORE INSERT ON public.service_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Auto-update updated_at
CREATE TRIGGER update_service_routes_updated_at
  BEFORE UPDATE ON public.service_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
