-- Add language column to email_configurations table
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'nl' CHECK (language IN ('nl', 'en', 'fr'));