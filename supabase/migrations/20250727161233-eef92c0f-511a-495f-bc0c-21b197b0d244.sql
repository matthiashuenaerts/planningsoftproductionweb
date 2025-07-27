
-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated users to view email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Allow admins to create email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Allow admins to update email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Allow admins to delete email connections" ON public.email_connections;

-- Create new policies with better error handling
-- Allow all authenticated users to view email connections
CREATE POLICY "Allow all authenticated users to view email connections" 
  ON public.email_connections 
  FOR SELECT 
  USING (true);

-- Allow admins to create email connections
CREATE POLICY "Allow admins to create email connections" 
  ON public.email_connections 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Allow admins to update email connections
CREATE POLICY "Allow admins to update email connections" 
  ON public.email_connections 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Allow admins to delete email connections
CREATE POLICY "Allow admins to delete email connections" 
  ON public.email_connections 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
