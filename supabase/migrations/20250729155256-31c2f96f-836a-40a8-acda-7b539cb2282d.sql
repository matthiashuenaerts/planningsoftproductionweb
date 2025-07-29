-- Create suppliers table for managing standard supplier information
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies for supplier access
CREATE POLICY "Allow all employees to view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify suppliers" 
ON public.suppliers 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();