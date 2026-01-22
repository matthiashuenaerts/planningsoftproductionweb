-- Add preferred_language column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'nl';

-- Add a comment explaining the column
COMMENT ON COLUMN public.employees.preferred_language IS 'User preferred language code (nl, en, fr)';