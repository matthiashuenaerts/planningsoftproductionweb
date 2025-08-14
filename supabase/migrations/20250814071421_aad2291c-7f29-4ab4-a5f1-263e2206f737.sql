-- Enable cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to sync projects every 2 hours
SELECT cron.schedule(
  'auto-sync-projects-every-2-hours',
  '0 */2 * * *', -- Every 2 hours at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/project-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4"}'::jsonb,
        body:='{"automated": true, "timestamp": "' || now()::text || '", "config": {"baseUrl": "https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon", "username": "Matthias HUENAERTS", "password": "8pJ1A24z"}}'::jsonb
    ) as request_id;
  $$
);