-- Add storage RLS policies for personal-attachments bucket
CREATE POLICY "Authenticated users can view personal-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'personal-attachments');

CREATE POLICY "Authenticated users can upload personal-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'personal-attachments');

CREATE POLICY "Authenticated users can update personal-attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'personal-attachments');

CREATE POLICY "Authenticated users can delete personal-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'personal-attachments');