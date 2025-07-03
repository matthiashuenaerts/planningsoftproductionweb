
-- Update the function to use holiday_requests table instead of holidays table
CREATE OR REPLACE FUNCTION is_employee_on_holiday(emp_id UUID, check_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if there's an approved holiday request for this employee on the given date
  RETURN EXISTS (
    SELECT 1 
    FROM holiday_requests 
    WHERE user_id = emp_id 
      AND start_date <= check_date 
      AND end_date >= check_date
      AND status = 'approved'
  );
END;
$$;
