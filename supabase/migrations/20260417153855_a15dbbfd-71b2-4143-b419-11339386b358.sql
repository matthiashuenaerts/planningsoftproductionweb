
-- Unschedule any existing job with the same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('external-orders-sync-every-2h');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'external-orders-sync-every-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/external-orders-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
