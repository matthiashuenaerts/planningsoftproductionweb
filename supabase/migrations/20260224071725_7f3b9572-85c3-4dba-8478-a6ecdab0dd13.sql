
CREATE OR REPLACE FUNCTION public.trigger_project_forecast_email()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
  v_current_day text;
  v_current_time time;
  v_response_id bigint;
  v_anon_key text;
BEGIN
  -- Get current day and time
  v_current_day := trim(lower(to_char(CURRENT_TIMESTAMP, 'Day')));
  v_current_time := CURRENT_TIME;
  
  RAISE LOG 'Checking forecast schedule: current_day=%, current_time=%', v_current_day, v_current_time;

  -- Retrieve anon key from Supabase secrets (vault)
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
    RAISE LOG 'SUPABASE_ANON_KEY not found in vault, skipping';
    RETURN;
  END IF;
  
  -- Loop through ALL active tenant configs that match current day and time (within 5 minute window)
  FOR v_config IN
    SELECT esc.*, t.slug as tenant_slug
    FROM email_schedule_configs esc
    JOIN tenants t ON t.id = esc.tenant_id
    WHERE esc.function_name = 'send_project_forecast'
      AND esc.is_active = true
      AND esc.schedule_day = v_current_day
      AND esc.schedule_time <= v_current_time
      AND esc.schedule_time >= v_current_time - interval '5 minutes'
  LOOP
    RAISE LOG 'Triggering forecast email for tenant: % (config: %)', v_config.tenant_id, v_config.id;
    
    SELECT net.http_post(
      url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/send-project-forecast',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'time', now(),
        'triggered_by', 'cron',
        'tenantId', v_config.tenant_id
      )
    ) INTO v_response_id;
    
    RAISE LOG 'Edge function triggered for tenant %, response_id: %', v_config.tenant_id, v_response_id;
  END LOOP;
END;
$function$;
