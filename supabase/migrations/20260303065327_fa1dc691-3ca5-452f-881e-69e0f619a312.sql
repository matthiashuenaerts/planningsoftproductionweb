
-- Create a function to trigger the auto-generate-schedule edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_generate_schedule()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_anon_key text;
  v_response_id bigint;
BEGIN
  RAISE LOG 'Auto-generate schedule triggered by cron...';

  -- Retrieve anon key from Supabase secrets (vault)
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
    RAISE LOG 'SUPABASE_ANON_KEY not found in vault, skipping auto-generate-schedule';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/auto-generate-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'time', now(),
      'triggered_by', 'cron'
    )
  ) INTO v_response_id;

  RAISE LOG 'Auto-generate schedule edge function triggered, response_id: %', v_response_id;
END;
$$;

-- Schedule the cron job to run at midnight (00:00) every day
SELECT cron.schedule(
  'auto-generate-schedule-midnight',
  '0 0 * * *',
  $$SELECT public.trigger_auto_generate_schedule()$$
);
