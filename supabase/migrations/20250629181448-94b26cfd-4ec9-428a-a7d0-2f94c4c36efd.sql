
-- Create enum for holiday request status
CREATE TYPE public.holiday_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create holiday_requests table
CREATE TABLE public.holiday_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status holiday_request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own requests
CREATE POLICY "Users can view their own holiday requests" 
  ON public.holiday_requests 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy for users to create their own requests
CREATE POLICY "Users can create their own holiday requests" 
  ON public.holiday_requests 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy for admins to view all requests
CREATE POLICY "Admins can view all holiday requests" 
  ON public.holiday_requests 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy for admins to update all requests
CREATE POLICY "Admins can update all holiday requests" 
  ON public.holiday_requests 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );
