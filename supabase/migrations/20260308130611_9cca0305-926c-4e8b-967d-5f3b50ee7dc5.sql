
-- =====================================================
-- STORAGE SECURITY HARDENING
-- =====================================================

-- Remove overly permissive broken_parts policies (USING(true) for public)
DROP POLICY IF EXISTS "Anyone can upload a broken part image" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view a broken part image" ON storage.objects;

-- Remove duplicate/redundant policies on storage.objects
-- project_files: remove "Everyone can..." policies (too permissive for public role)
DROP POLICY IF EXISTS "Everyone can delete project files" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view project files" ON storage.objects;

-- order-attachments: remove "Everyone can..." policies
DROP POLICY IF EXISTS "Everyone can delete project files 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can update project files 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can upload project files 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view project files 21dzu9_0" ON storage.objects;

-- attachments: remove overly permissive "Public" policies
DROP POLICY IF EXISTS "Public Delete Access for Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Access for Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view attachments files 1mt4rzk_0" ON storage.objects;

-- Remove duplicate bucket-specific policies that overlap with named ones
DROP POLICY IF EXISTS "attachments_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_update_policy" ON storage.objects;

-- Recreate attachments policies restricted to authenticated users
CREATE POLICY "attachments_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "attachments_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- Remove duplicate broken_parts policies and recreate properly
DROP POLICY IF EXISTS "broken_parts_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "broken_parts_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "broken_parts_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "broken_parts_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view a broken part image 10ho8hi_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads 10ho8hi_0" ON storage.objects;

CREATE POLICY "broken_parts_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'broken_parts');

CREATE POLICY "broken_parts_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'broken_parts');

CREATE POLICY "broken_parts_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'broken_parts');

CREATE POLICY "broken_parts_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'broken_parts' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- Remove duplicate project_files policies and recreate
DROP POLICY IF EXISTS "project_files_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "project_files_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "project_files_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "project_files_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

CREATE POLICY "project_files_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project_files');

CREATE POLICY "project_files_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project_files');

CREATE POLICY "project_files_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project_files');

CREATE POLICY "project_files_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project_files' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- Remove duplicate order-attachments policies and recreate
DROP POLICY IF EXISTS "Allow authenticated deletes 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates 21dzu9_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads 21dzu9_0" ON storage.objects;

CREATE POLICY "order_attachments_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-attachments');

CREATE POLICY "order_attachments_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "order_attachments_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'order-attachments');

CREATE POLICY "order_attachments_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-attachments' AND public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- Remaining login_logs USING(true): this is acceptable for INSERT (audit logging)
-- but restrict to authenticated only (anon policy was already dropped)
