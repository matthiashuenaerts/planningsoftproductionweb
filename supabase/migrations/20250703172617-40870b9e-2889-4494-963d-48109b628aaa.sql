
-- Create a table to track employee holidays
CREATE TABLE employee_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for employee holidays
ALTER TABLE employee_holidays ENABLE ROW LEVEL SECURITY;

-- Employees can view their own holidays
CREATE POLICY "Employees can view their own holidays" 
  ON employee_holidays 
  FOR SELECT 
  USING (auth.uid() = employee_id);

-- Employees can create their own holiday requests
CREATE POLICY "Employees can create their own holidays" 
  ON employee_holidays 
  FOR INSERT 
  WITH CHECK (auth.uid() = employee_id);

-- Admins can view all holidays
CREATE POLICY "Admins can view all holidays" 
  ON employee_holidays 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM employees 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Admins can manage all holidays
CREATE POLICY "Admins can manage all holidays" 
  ON employee_holidays 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM employees 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create index for better performance
CREATE INDEX idx_employee_holidays_date_range ON employee_holidays (employee_id, start_date, end_date);

-- Create a function to check if an employee is on holiday for a specific date
CREATE OR REPLACE FUNCTION is_employee_on_holiday(emp_id UUID, check_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM employee_holidays 
    WHERE employee_id = emp_id 
      AND start_date <= check_date 
      AND end_date >= check_date
      AND approved = true
  );
END;
$$;
