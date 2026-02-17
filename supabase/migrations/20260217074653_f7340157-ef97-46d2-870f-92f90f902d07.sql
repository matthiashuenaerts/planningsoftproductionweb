
-- Table for defining which part columns determine if a part belongs to a workstation
-- Each rule is a condition, multiple rules per workstation are grouped by logic_operator
CREATE TABLE public.workstation_part_tracking_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid REFERENCES public.tenants(id),
  logic_operator TEXT NOT NULL DEFAULT 'OR' CHECK (logic_operator IN ('AND', 'OR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual conditions within a rule group
CREATE TABLE public.workstation_part_tracking_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.workstation_part_tracking_rules(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid REFERENCES public.tenants(id),
  column_name TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'is_not_empty' CHECK (operator IN ('is_not_empty', 'is_empty', 'equals', 'not_equals', 'contains', 'greater_than', 'less_than')),
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-part per-workstation status tracking
CREATE TABLE public.part_workstation_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid REFERENCES public.tenants(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(part_id, workstation_id)
);

-- Enable RLS
ALTER TABLE public.workstation_part_tracking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_part_tracking_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_workstation_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies using tenant isolation
CREATE POLICY "tenant_isolation" ON public.workstation_part_tracking_rules
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_isolation" ON public.workstation_part_tracking_conditions
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_isolation" ON public.part_workstation_tracking
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Tenant ID triggers
CREATE TRIGGER set_tenant_id_on_insert_wptr
  BEFORE INSERT ON public.workstation_part_tracking_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER set_tenant_id_on_insert_wptc
  BEFORE INSERT ON public.workstation_part_tracking_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER set_tenant_id_on_insert_pwt
  BEFORE INSERT ON public.part_workstation_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Updated_at triggers
CREATE TRIGGER update_wptr_updated_at
  BEFORE UPDATE ON public.workstation_part_tracking_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pwt_updated_at
  BEFORE UPDATE ON public.part_workstation_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_pwt_part_workstation ON public.part_workstation_tracking(part_id, workstation_id);
CREATE INDEX idx_pwt_workstation_status ON public.part_workstation_tracking(workstation_id, status);
CREATE INDEX idx_wptr_workstation ON public.workstation_part_tracking_rules(workstation_id);
