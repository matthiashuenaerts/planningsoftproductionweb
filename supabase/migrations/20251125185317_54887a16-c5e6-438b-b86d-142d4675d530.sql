-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing functions if they exist and recreate
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role);
DROP FUNCTION IF EXISTS public.has_any_role(UUID, app_role[]);

-- Create security definer function to check roles
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check multiple roles
CREATE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- ====================================
-- CABINET CONFIGURATOR TABLES
-- ====================================

-- Cabinet Projects (main projects for configurator)
CREATE TABLE public.cabinet_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client_name TEXT,
    client_address TEXT,
    project_number TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    units TEXT NOT NULL DEFAULT 'metric',
    created_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cabinet Models Library (standard objects)
CREATE TABLE public.cabinet_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    thumbnail_url TEXT,
    is_template BOOLEAN NOT NULL DEFAULT true,
    default_width NUMERIC,
    default_height NUMERIC,
    default_depth NUMERIC,
    min_width NUMERIC,
    max_width NUMERIC,
    min_height NUMERIC,
    max_height NUMERIC,
    min_depth NUMERIC,
    max_depth NUMERIC,
    parameters JSONB,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cabinet Configurations (instances in a project)
CREATE TABLE public.cabinet_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.cabinet_projects(id) ON DELETE CASCADE,
    model_id UUID REFERENCES public.cabinet_models(id),
    name TEXT NOT NULL,
    width NUMERIC NOT NULL,
    height NUMERIC NOT NULL,
    depth NUMERIC NOT NULL,
    horizontal_divisions INTEGER DEFAULT 0,
    vertical_divisions INTEGER DEFAULT 0,
    door_type TEXT,
    drawer_count INTEGER DEFAULT 0,
    material_config JSONB,
    finish TEXT,
    edge_banding TEXT,
    position_x NUMERIC DEFAULT 0,
    position_y NUMERIC DEFAULT 0,
    parameters JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materials Database
CREATE TABLE public.cabinet_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    unit TEXT NOT NULL,
    cost_per_unit NUMERIC NOT NULL,
    waste_factor NUMERIC DEFAULT 1.1,
    lead_time_days INTEGER,
    supplier TEXT,
    standard_size_width NUMERIC,
    standard_size_height NUMERIC,
    thickness NUMERIC,
    color TEXT,
    finish_type TEXT,
    image_url TEXT,
    in_stock BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated Parts Lists
CREATE TABLE public.cabinet_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID NOT NULL REFERENCES public.cabinet_configurations(id) ON DELETE CASCADE,
    part_type TEXT NOT NULL,
    part_name TEXT NOT NULL,
    material_id UUID REFERENCES public.cabinet_materials(id),
    width NUMERIC,
    height NUMERIC,
    thickness NUMERIC,
    length NUMERIC,
    quantity INTEGER NOT NULL DEFAULT 1,
    material_area NUMERIC,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quotes
CREATE TABLE public.cabinet_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.cabinet_projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    materials_cost NUMERIC NOT NULL DEFAULT 0,
    hardware_cost NUMERIC NOT NULL DEFAULT 0,
    labor_minutes INTEGER NOT NULL DEFAULT 0,
    labor_cost NUMERIC NOT NULL DEFAULT 0,
    overhead_percentage NUMERIC NOT NULL DEFAULT 15,
    overhead_cost NUMERIC NOT NULL DEFAULT 0,
    margin_percentage NUMERIC NOT NULL DEFAULT 20,
    margin_amount NUMERIC NOT NULL DEFAULT 0,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_percentage NUMERIC NOT NULL DEFAULT 21,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project Revisions
CREATE TABLE public.cabinet_project_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.cabinet_projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price Rules (for calculations)
CREATE TABLE public.cabinet_price_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all cabinet tables
ALTER TABLE public.cabinet_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_project_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_price_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Cabinet Projects
CREATE POLICY "Users with calculator roles can view cabinet projects"
ON public.cabinet_projects FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins and advisors can create cabinet projects"
ON public.cabinet_projects FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

CREATE POLICY "Admins and advisors can update cabinet projects"
ON public.cabinet_projects FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

CREATE POLICY "Admins can delete cabinet projects"
ON public.cabinet_projects FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for Cabinet Models
CREATE POLICY "Users with calculator roles can view cabinet models"
ON public.cabinet_models FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins can manage cabinet models"
ON public.cabinet_models FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for Cabinet Configurations
CREATE POLICY "Users with calculator roles can view configurations"
ON public.cabinet_configurations FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins and advisors can manage configurations"
ON public.cabinet_configurations FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

-- RLS Policies for Cabinet Materials
CREATE POLICY "Users with calculator roles can view materials"
ON public.cabinet_materials FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins can manage materials"
ON public.cabinet_materials FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for Cabinet Parts
CREATE POLICY "Users with calculator roles can view parts"
ON public.cabinet_parts FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins and advisors can manage parts"
ON public.cabinet_parts FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

-- RLS Policies for Cabinet Quotes
CREATE POLICY "Users with calculator roles can view quotes"
ON public.cabinet_quotes FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Users with calculator roles can create quotes"
ON public.cabinet_quotes FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins and advisors can manage quotes"
ON public.cabinet_quotes FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

-- RLS Policies for Cabinet Project Revisions
CREATE POLICY "Users with calculator roles can view revisions"
ON public.cabinet_project_revisions FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins and advisors can create revisions"
ON public.cabinet_project_revisions FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin', 'advisor']::app_role[]));

-- RLS Policies for Cabinet Price Rules
CREATE POLICY "Users with calculator roles can view price rules"
ON public.cabinet_price_rules FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin', 'advisor', 'calculator']::app_role[]));

CREATE POLICY "Admins can manage price rules"
ON public.cabinet_price_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_cabinet_projects_created_by ON public.cabinet_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_cabinet_projects_status ON public.cabinet_projects(status);
CREATE INDEX IF NOT EXISTS idx_cabinet_configurations_project_id ON public.cabinet_configurations(project_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_parts_configuration_id ON public.cabinet_parts(configuration_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_quotes_project_id ON public.cabinet_quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_materials_category ON public.cabinet_materials(category);
CREATE INDEX IF NOT EXISTS idx_cabinet_materials_sku ON public.cabinet_materials(sku);

-- Create update trigger function for updated_at columns
CREATE OR REPLACE FUNCTION update_cabinet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cabinet_projects_updated_at
BEFORE UPDATE ON public.cabinet_projects
FOR EACH ROW EXECUTE FUNCTION update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_models_updated_at
BEFORE UPDATE ON public.cabinet_models
FOR EACH ROW EXECUTE FUNCTION update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_configurations_updated_at
BEFORE UPDATE ON public.cabinet_configurations
FOR EACH ROW EXECUTE FUNCTION update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_materials_updated_at
BEFORE UPDATE ON public.cabinet_materials
FOR EACH ROW EXECUTE FUNCTION update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_price_rules_updated_at
BEFORE UPDATE ON public.cabinet_price_rules
FOR EACH ROW EXECUTE FUNCTION update_cabinet_updated_at();

-- Insert default price rules
INSERT INTO public.cabinet_price_rules (name, rule_type, value, unit) VALUES
('Standard Labor Rate', 'labor_rate', 45.00, 'per_hour'),
('Default Overhead', 'overhead', 15.00, 'percentage'),
('Default Margin', 'markup', 20.00, 'percentage'),
('Standard VAT', 'tax', 21.00, 'percentage');

-- Insert sample cabinet models
INSERT INTO public.cabinet_models (name, description, category, default_width, default_height, default_depth, min_width, max_width, min_height, max_height, min_depth, max_depth) VALUES
('Base Cabinet', 'Standard base cabinet', 'full_cabinet', 600, 720, 580, 300, 1200, 700, 900, 400, 600),
('Wall Cabinet', 'Standard wall cabinet', 'full_cabinet', 600, 720, 350, 300, 1200, 400, 1000, 280, 400),
('Tall Cabinet', 'Full height cabinet', 'full_cabinet', 600, 2100, 580, 400, 800, 1800, 2400, 400, 600),
('Drawer Unit', '3-drawer base unit', 'full_cabinet', 600, 720, 580, 300, 900, 700, 900, 400, 600),
('Standard Hinge', 'Concealed hinge', 'hinge', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('Soft Close Runner', 'Full extension drawer runner', 'runner', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('Bar Handle', 'Stainless steel bar handle', 'handle', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Insert sample materials
INSERT INTO public.cabinet_materials (sku, name, category, subcategory, unit, cost_per_unit, waste_factor, standard_size_width, standard_size_height, thickness) VALUES
('MDF-18-2800-2070', 'MDF Panel 18mm', 'panel', 'MDF', 'm2', 25.00, 1.15, 2800, 2070, 18),
('PLY-18-2440-1220', 'Plywood 18mm', 'panel', 'plywood', 'm2', 45.00, 1.15, 2440, 1220, 18),
('EDGE-PVC-WHT-22', 'White PVC Edging 22mm', 'edging', 'PVC', 'lm', 1.20, 1.10, NULL, NULL, 2),
('HNG-BLUM-155', 'Blum Clip-Top Hinge', 'hardware', 'hinge', 'pcs', 3.50, 1.0, NULL, NULL, NULL),
('RNR-500-SC', 'Soft Close Runner 500mm', 'hardware', 'runner', 'pcs', 12.00, 1.0, NULL, NULL, NULL),
('HDL-BAR-160', 'Bar Handle 160mm', 'hardware', 'handle', 'pcs', 5.50, 1.0, NULL, NULL, NULL),
('SCR-CONF-4X30', 'Confirmat Screw 4x30', 'hardware', 'screw', 'pcs', 0.15, 1.0, NULL, NULL, NULL);