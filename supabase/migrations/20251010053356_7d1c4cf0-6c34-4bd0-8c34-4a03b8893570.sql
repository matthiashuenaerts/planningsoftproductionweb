-- Add formula column to calculation_task_relationships table
ALTER TABLE calculation_task_relationships
ADD COLUMN formula text;

-- Add comment explaining the formula syntax
COMMENT ON COLUMN calculation_task_relationships.formula IS 'Formula to calculate task duration using variables like aantal_kasten, aantal_objecten, etc. Example: "aantal_kasten * 2 + aantal_objecten / 3"';