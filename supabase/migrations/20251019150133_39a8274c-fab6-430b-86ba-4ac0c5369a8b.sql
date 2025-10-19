-- Add logistics column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS logistics BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN employees.logistics IS 'Flag to indicate if employee has access to logistics features';