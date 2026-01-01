-- Add unique constraint on project_id for upsert functionality
ALTER TABLE public.project_onedrive_configs 
ADD CONSTRAINT project_onedrive_configs_project_id_key UNIQUE (project_id);