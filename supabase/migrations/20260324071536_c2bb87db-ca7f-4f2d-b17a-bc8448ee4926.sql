
ALTER TABLE public.tenant_onedrive_settings
ADD COLUMN IF NOT EXISTS default_folder_path TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS default_drive_id TEXT;
