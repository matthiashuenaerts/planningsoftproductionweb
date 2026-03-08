
-- Add is_global flag to help_categories
ALTER TABLE public.help_categories ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Add is_global flag to help_articles  
ALTER TABLE public.help_articles ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Update RLS policies for help_categories to allow reading global items
DROP POLICY IF EXISTS "tenant_isolation" ON public.help_categories;
CREATE POLICY "tenant_isolation" ON public.help_categories
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR is_global = true
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );

-- Update RLS policies for help_articles to allow reading global items
DROP POLICY IF EXISTS "tenant_isolation" ON public.help_articles;
CREATE POLICY "tenant_isolation" ON public.help_articles
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR is_global = true
    OR public.is_developer(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_developer(auth.uid())
  );
