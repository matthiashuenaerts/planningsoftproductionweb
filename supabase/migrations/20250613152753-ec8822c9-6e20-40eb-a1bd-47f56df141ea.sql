
-- Create accessories table
CREATE TABLE public.accessories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  article_name TEXT NOT NULL,
  article_description TEXT,
  article_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  stock_location TEXT,
  status TEXT NOT NULL DEFAULT 'to_check' CHECK (status IN ('to_check', 'in_stock', 'delivered', 'to_order', 'ordered')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add trigger for updated_at
CREATE TRIGGER update_accessories_updated_at
  BEFORE UPDATE ON public.accessories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_accessories_project_id ON public.accessories(project_id);
CREATE INDEX idx_accessories_order_id ON public.accessories(order_id);
CREATE INDEX idx_accessories_status ON public.accessories(status);
