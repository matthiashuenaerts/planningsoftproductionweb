
-- Schedule cleanup of old login logs daily at 3 AM
SELECT cron.schedule(
  'cleanup-old-login-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_old_login_logs()$$
);
