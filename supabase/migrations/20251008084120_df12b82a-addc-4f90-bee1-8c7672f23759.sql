-- Add new email configuration for project forecast
INSERT INTO email_configurations (function_name, recipient_emails, description)
VALUES (
  'send_project_forecast',
  '{}',
  'Weekly project forecast with installation dates and undelivered orders'
) ON CONFLICT (function_name) DO NOTHING;

-- Create table for email schedule configurations
CREATE TABLE IF NOT EXISTS email_schedule_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL UNIQUE,
  schedule_day TEXT NOT NULL DEFAULT 'monday',
  schedule_time TIME NOT NULL DEFAULT '08:00:00',
  forecast_weeks INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_schedule_configs ENABLE ROW LEVEL SECURITY;

-- All employees can view schedule configs
CREATE POLICY "All employees can view schedule configs"
ON email_schedule_configs
FOR SELECT
USING (true);

-- Only admins can modify schedule configs
CREATE POLICY "Only admins can modify schedule configs"
ON email_schedule_configs
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

-- Insert default configuration for project forecast
INSERT INTO email_schedule_configs (function_name, schedule_day, schedule_time, forecast_weeks)
VALUES ('send_project_forecast', 'monday', '08:00:00', 2)
ON CONFLICT (function_name) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_schedule_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_schedule_configs_updated_at
BEFORE UPDATE ON email_schedule_configs
FOR EACH ROW
EXECUTE FUNCTION update_email_schedule_configs_updated_at();