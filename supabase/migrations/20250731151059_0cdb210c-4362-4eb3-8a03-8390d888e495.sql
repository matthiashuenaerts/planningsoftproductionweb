-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  article_code TEXT,
  supplier TEXT,
  standard_order_quantity INTEGER DEFAULT 1,
  website_link TEXT,
  image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies for products
CREATE POLICY "All employees can view products" 
ON public.products 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify products" 
ON public.products 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true);

-- Create storage policies for product images
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

CREATE POLICY "Admins can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

CREATE POLICY "Admins can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));