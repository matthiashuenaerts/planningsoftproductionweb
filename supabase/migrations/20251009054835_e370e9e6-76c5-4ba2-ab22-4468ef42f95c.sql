-- Drop existing cron job if it exists
SELECT cron.unschedule('send-project-forecast-email');

-- Improve the trigger function with better logging and day handling
CREATE OR REPLACE FUNCTION public.trigger_project_forecast_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_current_day text;
  v_current_time time;
  v_response_id bigint;
BEGIN
  -- Get current day and time
  v_current_day := trim(lower(to_char(CURRENT_TIMESTAMP, 'Day')));
  v_current_time := CURRENT_TIME;
  
  RAISE LOG 'Checking forecast schedule: current_day=%, current_time=%', v_current_day, v_current_time;
  
  -- Check if there's an active config matching current day and time (within 5 minute window)
  SELECT * INTO v_config
  FROM email_schedule_configs
  WHERE function_name = 'send_project_forecast'
    AND is_active = true
    AND schedule_day = v_current_day
    AND schedule_time <= v_current_time
    AND schedule_time >= v_current_time - interval '5 minutes';
  
  -- If config found, invoke the edge function
  IF FOUND THEN
    RAISE LOG 'Matching schedule found, triggering forecast email for config: %', v_config.id;
    
    SELECT net.http_post(
      url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/send-project-forecast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4'
      ),
      body := jsonb_build_object('time', now(), 'triggered_by', 'cron')
    ) INTO v_response_id;
    
    RAISE LOG 'Edge function triggered, response_id: %', v_response_id;
  ELSE
    RAISE LOG 'No matching schedule found for current day/time';
  END IF;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'send-project-forecast-email',
  '*/5 * * * *',
  $$SELECT public.trigger_project_forecast_email();$$
);