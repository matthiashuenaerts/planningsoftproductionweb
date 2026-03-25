-- Remove old project-sync cron job with concat-based body
SELECT cron.unschedule(1);

-- Create clean project-sync cron job
SELECT cron.schedule(
  'project-sync-automated',
  '0 */2 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/project-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);