
-- Service ticket items: expanded items beyond just todos
-- Supports: todo, order_request, production_task, office_task
CREATE TABLE public.service_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.project_team_assignments(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'todo' CHECK (item_type IN ('todo', 'order_request', 'production_task', 'office_task')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid REFERENCES public.employees(id),
  created_by uuid REFERENCES public.employees(id),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  tenant_id uuid NOT NULL DEFAULT (public.get_user_tenant_id(auth.uid())) REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.service_ticket_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.service_ticket_items
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()));

-- Auto-set tenant_id on insert
CREATE TRIGGER set_tenant_id_service_ticket_items
  BEFORE INSERT ON public.service_ticket_items
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Updated_at trigger
CREATE TRIGGER update_service_ticket_items_updated_at
  BEFORE UPDATE ON public.service_ticket_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Installation yard photos table
CREATE TABLE public.installation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.employees(id),
  file_path text NOT NULL,
  caption text,
  tenant_id uuid NOT NULL DEFAULT (public.get_user_tenant_id(auth.uid())) REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installation_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.installation_photos
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_developer(auth.uid()));

CREATE TRIGGER set_tenant_id_installation_photos
  BEFORE INSERT ON public.installation_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();
