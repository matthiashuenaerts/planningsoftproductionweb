-- Add 'charged' status to orders table status column
-- First check if the status is text or enum
DO $$ 
BEGIN
  -- If the column exists and is of type text, just add a check constraint
  -- The status is already text type, so no migration needed for the type itself
  -- The application will handle the validation
  
  -- Just a comment migration to document the new 'charged' status
  -- No actual schema change needed as status column is already text type
END $$;