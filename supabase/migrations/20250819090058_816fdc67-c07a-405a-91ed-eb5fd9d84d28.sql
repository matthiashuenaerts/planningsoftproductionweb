-- Add workstation_name_status column to parts table
ALTER TABLE public.parts 
ADD COLUMN workstation_name_status text;