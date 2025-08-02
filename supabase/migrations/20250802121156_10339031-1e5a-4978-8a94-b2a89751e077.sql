-- Add project_link_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN project_link_id text;