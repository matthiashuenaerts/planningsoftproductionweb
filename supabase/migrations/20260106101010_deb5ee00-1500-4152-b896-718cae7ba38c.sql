-- Create product_groups table for group products
CREATE TABLE public.product_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  article_code TEXT,
  image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for group products and their sub-products with quantity
CREATE TABLE public.product_group_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, product_id)
);

-- Enable RLS
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_group_items ENABLE ROW LEVEL SECURITY;

-- Create policies for product_groups (allow all authenticated users)
CREATE POLICY "Allow all operations on product_groups" 
ON public.product_groups 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for product_group_items
CREATE POLICY "Allow all operations on product_group_items" 
ON public.product_group_items 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_product_groups_updated_at
BEFORE UPDATE ON public.product_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();