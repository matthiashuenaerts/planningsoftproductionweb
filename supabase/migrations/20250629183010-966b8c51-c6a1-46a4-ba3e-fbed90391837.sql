
-- Remove the foreign key constraint that references auth.users
ALTER TABLE public.holiday_requests DROP CONSTRAINT IF EXISTS holiday_requests_user_id_fkey;

-- Add a foreign key constraint that references the employees table instead
ALTER TABLE public.holiday_requests ADD CONSTRAINT holiday_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Update RLS policies to work with the employee-based system
DROP POLICY IF EXISTS "Users can view their own holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can create their own holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can update their own holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can delete their own holiday requests" ON public.holiday_requests;

-- Disable RLS temporarily since we're using a custom authentication system
ALTER TABLE public.holiday_requests DISABLE ROW LEVEL SECURITY;
