-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the project sync function to run every 2 hours
SELECT cron.schedule(
  'project-sync-every-2-hours',
  '0 */2 * * *', -- Every 2 hours at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/project-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a table to log sync activities
CREATE TABLE IF NOT EXISTS project_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_count INTEGER,
  error_count INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the sync logs table
ALTER TABLE project_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to sync logs
CREATE POLICY "Allow read access to sync logs" ON project_sync_logs
FOR SELECT USING (true);