-- Add timezone column to email_schedule_configs for tenant-specific time handling
ALTER TABLE public.email_schedule_configs 
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Brussels';

-- Update trigger to use tenant-specific timezone
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
  v_local_time time;
  v_local_day text;
  v_response_id bigint;
  v_anon_key text;
BEGIN
  RAISE LOG 'Checking forecast schedules...';

  -- Retrieve anon key from Supabase secrets (vault)
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
    RAISE LOG 'SUPABASE_ANON_KEY not found in vault, skipping';
    RETURN;
  END IF;
  
  -- Loop through ALL active tenant configs and check against their LOCAL time
  FOR v_config IN
    SELECT esc.*, t.slug as tenant_slug
    FROM email_schedule_configs esc
    JOIN tenants t ON t.id = esc.tenant_id
    WHERE esc.function_name = 'send_project_forecast'
      AND esc.is_active = true
  LOOP
    -- Convert current UTC time to tenant's local timezone
    v_local_time := (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(v_config.timezone, 'Europe/Brussels'))::time;
    v_local_day := trim(lower(to_char(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(v_config.timezone, 'Europe/Brussels'), 'Day')));
    
    RAISE LOG 'Tenant % (tz=%): local_day=%, local_time=%, schedule_day=%, schedule_time=%', 
      v_config.tenant_id, v_config.timezone, v_local_day, v_local_time, v_config.schedule_day, v_config.schedule_time;
    
    -- Check if the local time matches the schedule
    IF v_local_day = v_config.schedule_day
       AND v_local_time >= v_config.schedule_time
       AND v_local_time <= v_config.schedule_time + interval '5 minutes' THEN
      
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
    END IF;
  END LOOP;
END;
$function$;