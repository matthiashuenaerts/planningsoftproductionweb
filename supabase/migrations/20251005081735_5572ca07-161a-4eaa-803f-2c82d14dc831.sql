-- Create email_configurations table
CREATE TABLE public.email_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL UNIQUE,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_configurations ENABLE ROW LEVEL SECURITY;

-- Allow all employees to view email configurations
CREATE POLICY "All employees can view email configurations"
ON public.email_configurations
FOR SELECT
USING (true);

-- Only admins can modify email configurations
CREATE POLICY "Only admins can modify email configurations"
ON public.email_configurations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = auth.uid()
    AND employees.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = auth.uid()
    AND employees.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_email_configurations_updated_at
  BEFORE UPDATE ON public.email_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configurations
INSERT INTO public.email_configurations (function_name, recipient_emails, description) VALUES
  ('holiday_request', ARRAY['productiesturing@thonon.be'], 'Email addresses to notify when a new holiday request is created'),
  ('holiday_status', ARRAY['productiesturing@thonon.be'], 'Email addresses to notify when a holiday request status changes');