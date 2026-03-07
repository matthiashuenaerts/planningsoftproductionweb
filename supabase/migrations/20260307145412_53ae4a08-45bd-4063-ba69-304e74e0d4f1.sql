
-- Order Task Groups: groups like "Material Delivery"
CREATE TABLE public.order_task_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tenant_id UUID NOT NULL DEFAULT (public.get_user_tenant_id(auth.uid())) REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order_task_groups" ON public.order_task_groups
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Links between groups and standard tasks
CREATE TABLE public.order_task_group_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.order_task_groups(id) ON DELETE CASCADE,
  standard_task_id UUID NOT NULL REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT (public.get_user_tenant_id(auth.uid())) REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, standard_task_id)
);

ALTER TABLE public.order_task_group_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order_task_group_links" ON public.order_task_group_links
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Add task_group_id to orders
ALTER TABLE public.orders ADD COLUMN task_group_id UUID REFERENCES public.order_task_groups(id) ON DELETE SET NULL;
