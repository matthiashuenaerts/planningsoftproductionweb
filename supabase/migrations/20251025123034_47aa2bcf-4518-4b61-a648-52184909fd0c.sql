-- Create stock_locations table
CREATE TABLE public.stock_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

-- Policies for stock_locations
CREATE POLICY "All employees can view stock locations"
ON public.stock_locations
FOR SELECT
USING (true);

CREATE POLICY "Only admins can modify stock locations"
ON public.stock_locations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = auth.uid()
    AND employees.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = auth.uid()
    AND employees.role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_stock_locations_updated_at
BEFORE UPDATE ON public.stock_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();