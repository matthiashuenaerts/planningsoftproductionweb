-- Create help categories table for organizing help topics
CREATE TABLE public.help_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create help articles table for storing help content
CREATE TABLE public.help_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES help_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for help_categories
CREATE POLICY "All employees can view help categories"
ON public.help_categories
FOR SELECT
USING (true);

CREATE POLICY "Only admins can modify help categories"
ON public.help_categories
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

-- RLS policies for help_articles
CREATE POLICY "All employees can view published help articles"
ON public.help_articles
FOR SELECT
USING (is_published = true);

CREATE POLICY "Only admins can modify help articles"
ON public.help_articles
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

-- Create storage bucket for help media files
INSERT INTO storage.buckets (id, name, public) VALUES ('help-media', 'help-media', true);

-- Storage policies for help media
CREATE POLICY "All employees can view help media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'help-media');

CREATE POLICY "Only admins can upload help media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'help-media' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

CREATE POLICY "Only admins can update help media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'help-media' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

CREATE POLICY "Only admins can delete help media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'help-media' AND EXISTS (
  SELECT 1 FROM employees 
  WHERE employees.id = auth.uid() 
  AND employees.role = 'admin'
));

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_help_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_help_categories_updated_at
  BEFORE UPDATE ON public.help_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_help_updated_at();

CREATE TRIGGER update_help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_help_updated_at();

-- Insert some initial help categories
INSERT INTO public.help_categories (name, description, display_order) VALUES
('Getting Started', 'Basic information to get started with the application', 1),
('Projects', 'Everything about managing projects', 2),
('Tasks & Planning', 'How to work with tasks and planning features', 3),
('Orders & Logistics', 'Managing orders and logistics', 4),
('Settings & Administration', 'System settings and admin features', 5);

-- Insert some sample help articles
INSERT INTO public.help_articles (category_id, title, content, display_order) VALUES
((SELECT id FROM help_categories WHERE name = 'Getting Started'), 'How to Login', 'To login to the application, enter your credentials on the login page...', 1),
((SELECT id FROM help_categories WHERE name = 'Projects'), 'Creating a New Project', 'To create a new project, navigate to the Projects page and click the "New Project" button...', 1),
((SELECT id FROM help_categories WHERE name = 'Tasks & Planning'), 'Managing Tasks', 'Tasks can be created, assigned, and tracked through the Tasks interface...', 1);