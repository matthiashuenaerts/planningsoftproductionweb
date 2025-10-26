-- Add actual duration tracking and efficiency percentage to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS efficiency_percentage INTEGER DEFAULT 100;