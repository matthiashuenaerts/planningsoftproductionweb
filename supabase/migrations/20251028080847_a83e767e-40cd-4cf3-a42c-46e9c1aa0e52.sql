-- ============================================
-- PHASE 4: FIX FINAL FUNCTION SEARCH PATH
-- ============================================

-- Fix the last remaining function to set search_path
CREATE OR REPLACE FUNCTION public.create_storage_policy(bucket_name text, policy_name text, definition text, operation text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Check if the policy already exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = policy_name
  ) THEN
    -- Update the policy if it exists based on operation type
    IF operation = 'INSERT' THEN
      EXECUTE format(
        'ALTER POLICY %I ON storage.objects FOR %s WITH CHECK (%s)',
        policy_name, operation, definition
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON storage.objects FOR %s USING (%s)',
        policy_name, operation, definition
      );
    END IF;
  ELSE
    -- Create the policy if it doesn't exist based on operation type
    IF operation = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s WITH CHECK (%s)',
        policy_name, operation, definition
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s USING (%s)',
        policy_name, operation, definition
      );
    END IF;
  END IF;
END;
$$;