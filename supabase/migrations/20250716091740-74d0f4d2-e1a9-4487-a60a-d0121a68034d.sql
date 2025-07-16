
-- Create personal_items table to store both notes and tasks
CREATE TABLE public.personal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  type text NOT NULL CHECK (type IN ('note', 'task')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamp with time zone,
  is_shared boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create personal_item_attachments table for file attachments
CREATE TABLE public.personal_item_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personal_item_id uuid NOT NULL REFERENCES public.personal_items(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create personal_item_shares table for sharing functionality
CREATE TABLE public.personal_item_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personal_item_id uuid NOT NULL REFERENCES public.personal_items(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  can_edit boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(personal_item_id, shared_with_user_id)
);

-- Add RLS policies
ALTER TABLE public.personal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_item_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_item_shares ENABLE ROW LEVEL SECURITY;

-- Policies for personal_items
CREATE POLICY "Users can view their own items and shared items" 
  ON public.personal_items 
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    id IN (
      SELECT personal_item_id 
      FROM public.personal_item_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own items" 
  ON public.personal_items 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own items and shared items with edit permission" 
  ON public.personal_items 
  FOR UPDATE 
  USING (
    user_id = auth.uid() OR 
    id IN (
      SELECT personal_item_id 
      FROM public.personal_item_shares 
      WHERE shared_with_user_id = auth.uid() AND can_edit = true
    )
  );

CREATE POLICY "Users can delete their own items" 
  ON public.personal_items 
  FOR DELETE 
  USING (user_id = auth.uid());

-- Policies for personal_item_attachments
CREATE POLICY "Users can view attachments for items they have access to" 
  ON public.personal_item_attachments 
  FOR SELECT 
  USING (
    personal_item_id IN (
      SELECT id FROM public.personal_items 
      WHERE user_id = auth.uid() OR 
      id IN (
        SELECT personal_item_id 
        FROM public.personal_item_shares 
        WHERE shared_with_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create attachments for their own items" 
  ON public.personal_item_attachments 
  FOR INSERT 
  WITH CHECK (
    personal_item_id IN (
      SELECT id FROM public.personal_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments for their own items" 
  ON public.personal_item_attachments 
  FOR DELETE 
  USING (
    personal_item_id IN (
      SELECT id FROM public.personal_items WHERE user_id = auth.uid()
    )
  );

-- Policies for personal_item_shares
CREATE POLICY "Users can view shares for their items or items shared with them" 
  ON public.personal_item_shares 
  FOR SELECT 
  USING (
    shared_by_user_id = auth.uid() OR 
    shared_with_user_id = auth.uid()
  );

CREATE POLICY "Users can create shares for their own items" 
  ON public.personal_item_shares 
  FOR INSERT 
  WITH CHECK (
    personal_item_id IN (
      SELECT id FROM public.personal_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shares for their own items" 
  ON public.personal_item_shares 
  FOR DELETE 
  USING (
    shared_by_user_id = auth.uid()
  );

-- Create storage bucket for personal item attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('personal-attachments', 'personal-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_personal_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_personal_items_updated_at
  BEFORE UPDATE ON public.personal_items
  FOR EACH ROW
  EXECUTE FUNCTION update_personal_items_updated_at();
