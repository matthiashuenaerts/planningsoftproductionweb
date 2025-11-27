-- Add price_per_unit column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price_per_unit numeric DEFAULT 0;

-- Create Legrabox drawer configurations table
CREATE TABLE public.legrabox_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  height_type text NOT NULL CHECK (height_type IN ('M', 'K', 'C', 'F')),
  height_mm numeric NOT NULL,
  side_colour text NOT NULL DEFAULT 'Orion Grey',
  bottom_colour text DEFAULT 'White',
  has_drawer_mat boolean DEFAULT false,
  nominal_length numeric NOT NULL,
  load_capacity_kg numeric DEFAULT 40,
  price numeric NOT NULL DEFAULT 0,
  sku text,
  supplier text DEFAULT 'Blum',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create cabinet door/drawer front configurations table
CREATE TABLE public.cabinet_fronts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id uuid REFERENCES public.cabinet_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  front_type text NOT NULL CHECK (front_type IN ('hinged_door', 'drawer_front', 'lift_up', 'sliding')),
  position_x text NOT NULL DEFAULT '0',
  position_y text NOT NULL DEFAULT '0',
  position_z text NOT NULL DEFAULT '0',
  width text NOT NULL DEFAULT 'width',
  height text NOT NULL DEFAULT 'height',
  thickness text NOT NULL DEFAULT 'door_thickness',
  hinge_side text CHECK (hinge_side IN ('left', 'right', 'top', 'bottom')),
  hardware_id uuid REFERENCES public.products(id),
  quantity integer DEFAULT 1,
  material_type text DEFAULT 'door',
  visible boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create cabinet compartments table for interior work
CREATE TABLE public.cabinet_compartments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id uuid REFERENCES public.cabinet_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  position_x text NOT NULL DEFAULT '0',
  position_y text NOT NULL DEFAULT '0',
  position_z text NOT NULL DEFAULT '0',
  width text NOT NULL,
  height text NOT NULL,
  depth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create compartment interior items (dividers, shelves, drawers)
CREATE TABLE public.compartment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compartment_id uuid REFERENCES public.cabinet_compartments(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('horizontal_divider', 'vertical_divider', 'shelf', 'legrabox_drawer')),
  position_y text NOT NULL DEFAULT '0',
  position_x text NOT NULL DEFAULT '0',
  thickness text DEFAULT 'shelf_thickness',
  quantity integer DEFAULT 1,
  has_drilling boolean DEFAULT false,
  drilling_pattern text,
  legrabox_id uuid REFERENCES public.legrabox_configurations(id),
  material_type text DEFAULT 'shelf',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.legrabox_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_fronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet_compartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for legrabox_configurations
CREATE POLICY "Users with calculator roles can view legrabox configs"
ON public.legrabox_configurations FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role, 'calculator'::app_role]));

CREATE POLICY "Admins can manage legrabox configs"
ON public.legrabox_configurations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for cabinet_fronts
CREATE POLICY "Users with calculator roles can view cabinet fronts"
ON public.cabinet_fronts FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role, 'calculator'::app_role]));

CREATE POLICY "Admins and advisors can manage cabinet fronts"
ON public.cabinet_fronts FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]));

-- RLS policies for cabinet_compartments
CREATE POLICY "Users with calculator roles can view compartments"
ON public.cabinet_compartments FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role, 'calculator'::app_role]));

CREATE POLICY "Admins and advisors can manage compartments"
ON public.cabinet_compartments FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]));

-- RLS policies for compartment_items
CREATE POLICY "Users with calculator roles can view compartment items"
ON public.compartment_items FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role, 'calculator'::app_role]));

CREATE POLICY "Admins and advisors can manage compartment items"
ON public.compartment_items FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'advisor'::app_role]));

-- Insert default Legrabox configurations
INSERT INTO public.legrabox_configurations (name, height_type, height_mm, side_colour, bottom_colour, nominal_length, load_capacity_kg, price, sku) VALUES
('Legrabox M 270mm Orion Grey', 'M', 66, 'Orion Grey', 'White', 270, 40, 45.00, 'LGX-M-270-OG'),
('Legrabox M 350mm Orion Grey', 'M', 66, 'Orion Grey', 'White', 350, 40, 48.00, 'LGX-M-350-OG'),
('Legrabox M 450mm Orion Grey', 'M', 66, 'Orion Grey', 'White', 450, 40, 52.00, 'LGX-M-450-OG'),
('Legrabox M 550mm Orion Grey', 'M', 66, 'Orion Grey', 'White', 550, 40, 56.00, 'LGX-M-550-OG'),
('Legrabox K 270mm Orion Grey', 'K', 101, 'Orion Grey', 'White', 270, 40, 52.00, 'LGX-K-270-OG'),
('Legrabox K 350mm Orion Grey', 'K', 101, 'Orion Grey', 'White', 350, 40, 56.00, 'LGX-K-350-OG'),
('Legrabox K 450mm Orion Grey', 'K', 101, 'Orion Grey', 'White', 450, 40, 60.00, 'LGX-K-450-OG'),
('Legrabox K 550mm Orion Grey', 'K', 101, 'Orion Grey', 'White', 550, 40, 64.00, 'LGX-K-550-OG'),
('Legrabox C 270mm Orion Grey', 'C', 177, 'Orion Grey', 'White', 270, 40, 68.00, 'LGX-C-270-OG'),
('Legrabox C 350mm Orion Grey', 'C', 177, 'Orion Grey', 'White', 350, 40, 72.00, 'LGX-C-350-OG'),
('Legrabox C 450mm Orion Grey', 'C', 177, 'Orion Grey', 'White', 450, 40, 78.00, 'LGX-C-450-OG'),
('Legrabox C 550mm Orion Grey', 'C', 177, 'Orion Grey', 'White', 550, 40, 84.00, 'LGX-C-550-OG'),
('Legrabox F 270mm Orion Grey', 'F', 243, 'Orion Grey', 'White', 270, 70, 85.00, 'LGX-F-270-OG'),
('Legrabox F 350mm Orion Grey', 'F', 243, 'Orion Grey', 'White', 350, 70, 92.00, 'LGX-F-350-OG'),
('Legrabox F 450mm Orion Grey', 'F', 243, 'Orion Grey', 'White', 450, 70, 98.00, 'LGX-F-450-OG'),
('Legrabox F 550mm Orion Grey', 'F', 243, 'Orion Grey', 'White', 550, 70, 105.00, 'LGX-F-550-OG'),
('Legrabox M 450mm Silk White', 'M', 66, 'Silk White', 'White', 450, 40, 58.00, 'LGX-M-450-SW'),
('Legrabox K 450mm Silk White', 'K', 101, 'Silk White', 'White', 450, 40, 66.00, 'LGX-K-450-SW'),
('Legrabox M 450mm Stainless Steel', 'M', 66, 'Stainless Steel', 'White', 450, 40, 65.00, 'LGX-M-450-SS'),
('Legrabox K 450mm Stainless Steel', 'K', 101, 'Stainless Steel', 'White', 450, 40, 75.00, 'LGX-K-450-SS');

-- Create trigger for updated_at
CREATE TRIGGER update_legrabox_updated_at BEFORE UPDATE ON public.legrabox_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_fronts_updated_at BEFORE UPDATE ON public.cabinet_fronts
FOR EACH ROW EXECUTE FUNCTION public.update_cabinet_updated_at();

CREATE TRIGGER update_cabinet_compartments_updated_at BEFORE UPDATE ON public.cabinet_compartments
FOR EACH ROW EXECUTE FUNCTION public.update_cabinet_updated_at();

CREATE TRIGGER update_compartment_items_updated_at BEFORE UPDATE ON public.compartment_items
FOR EACH ROW EXECUTE FUNCTION public.update_cabinet_updated_at();