-- Add drive_id column to project_onedrive_configs
ALTER TABLE public.project_onedrive_configs 
ADD COLUMN IF NOT EXISTS drive_id TEXT;

-- Remove obsolete token columns (no longer needed with link-based approach)
ALTER TABLE public.project_onedrive_configs 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token,
DROP COLUMN IF EXISTS token_expires_at;