
-- Create table for email connections
CREATE TABLE public.email_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL,
  general_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) to ensure proper access control
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

-- Create policy that allows all authenticated users to view email connections
CREATE POLICY "Allow all authenticated users to view email connections" 
  ON public.email_connections 
  FOR SELECT 
  USING (true);

-- Create policy that allows admins to create email connections
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

-- Create policy that allows admins to update email connections
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

-- Create policy that allows admins to delete email connections
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

-- Create trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_email_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON public.email_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_connections_updated_at();
