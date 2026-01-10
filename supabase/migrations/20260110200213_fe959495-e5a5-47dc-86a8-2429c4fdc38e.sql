-- Create table for CSV import column mappings configuration
CREATE TABLE public.csv_import_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT NOT NULL DEFAULT 'parts_list',
  csv_header TEXT NOT NULL,
  db_column TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(config_name, csv_header)
);

-- Enable RLS
ALTER TABLE public.csv_import_configs ENABLE ROW LEVEL SECURITY;

-- Everyone can read the config
CREATE POLICY "Anyone can read csv import configs"
ON public.csv_import_configs
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify configs (using security definer function)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_user_id = _user_id
      AND role = 'admin'
  )
$$;

CREATE POLICY "Admins can insert csv import configs"
ON public.csv_import_configs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update csv import configs"
ON public.csv_import_configs
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete csv import configs"
ON public.csv_import_configs
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Insert default mappings
INSERT INTO public.csv_import_configs (config_name, csv_header, db_column, is_required, display_order, description) VALUES
('parts_list', 'Materiaal', 'materiaal', true, 1, 'Material type'),
('parts_list', 'Dikte', 'dikte', false, 2, 'Thickness'),
('parts_list', 'Nerf', 'nerf', false, 3, 'Grain direction'),
('parts_list', 'Lengte', 'lengte', false, 4, 'Length'),
('parts_list', 'Breedte', 'breedte', false, 5, 'Width'),
('parts_list', 'Aantal', 'aantal', true, 6, 'Quantity'),
('parts_list', 'CNC pos', 'cnc_pos', false, 7, 'CNC position'),
('parts_list', 'CNC  pos', 'cnc_pos', false, 8, 'CNC position (alt)'),
('parts_list', 'Wand Naam', 'wand_naam', false, 9, 'Wall name'),
('parts_list', 'Afplak Boven', 'afplak_boven', false, 10, 'Edge banding top'),
('parts_list', 'Afplak Onder', 'afplak_onder', false, 11, 'Edge banding bottom'),
('parts_list', 'Afplak Links', 'afplak_links', false, 12, 'Edge banding left'),
('parts_list', 'Afplak Rechts', 'afplak_rechts', false, 13, 'Edge banding right'),
('parts_list', 'Commentaar', 'commentaar', false, 14, 'Comment'),
('parts_list', 'Commentaar 2', 'commentaar_2', false, 15, 'Comment 2'),
('parts_list', 'CNCPRG1', 'cncprg1', false, 16, 'CNC Program 1'),
('parts_list', 'CNCPRG2', 'cncprg2', false, 17, 'CNC Program 2'),
('parts_list', 'ABD', 'abd', false, 18, 'ABD'),
('parts_list', 'Afbeelding', 'afbeelding', false, 19, 'Image'),
('parts_list', 'Doorlopende nerf', 'doorlopende_nerf', false, 20, 'Continuous grain');

-- Create trigger for updated_at
CREATE TRIGGER update_csv_import_configs_updated_at
BEFORE UPDATE ON public.csv_import_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();