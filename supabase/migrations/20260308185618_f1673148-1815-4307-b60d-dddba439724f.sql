-- Make all public buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('broken_parts', 'product-images', 'help-media', 'order-attachments');

-- Create RLS policies for the newly private buckets (matching existing private buckets pattern)
-- broken_parts bucket
DROP POLICY IF EXISTS "Authenticated users can view broken_parts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload broken_parts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete broken_parts" ON storage.objects;

CREATE POLICY "Authenticated users can view broken_parts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'broken_parts');

CREATE POLICY "Authenticated users can upload broken_parts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'broken_parts');

CREATE POLICY "Admins can update broken_parts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'broken_parts' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete broken_parts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'broken_parts' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- product-images bucket
DROP POLICY IF EXISTS "Authenticated users can view product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product-images" ON storage.objects;

CREATE POLICY "Authenticated users can view product-images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admins can update product-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- help-media bucket
DROP POLICY IF EXISTS "Authenticated users can view help-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload help-media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete help-media" ON storage.objects;

CREATE POLICY "Authenticated users can view help-media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'help-media');

CREATE POLICY "Authenticated users can upload help-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'help-media');

CREATE POLICY "Admins can update help-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'help-media' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete help-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'help-media' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- order-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can view order-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete order-attachments" ON storage.objects;

CREATE POLICY "Authenticated users can view order-attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'order-attachments');

CREATE POLICY "Authenticated users can upload order-attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "Admins can update order-attachments" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'order-attachments' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete order-attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'order-attachments' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));