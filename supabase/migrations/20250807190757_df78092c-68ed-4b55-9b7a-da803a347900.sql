-- Add image_path column to workstations table
ALTER TABLE workstations ADD COLUMN IF NOT EXISTS image_path TEXT;