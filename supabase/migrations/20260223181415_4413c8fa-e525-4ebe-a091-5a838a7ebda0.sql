-- 1. Add role-based RLS policy for project_costing (restrict to admin/manager)
CREATE POLICY "admins_managers_view_costing" ON public.project_costing
FOR SELECT TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

CREATE POLICY "admins_managers_modify_costing" ON public.project_costing
FOR ALL TO authenticated
USING (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']))
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin', 'manager']));

-- 2. Make sensitive storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('personal-attachments', 'project_files', 'attachments');

-- 3. Replace hardcoded anon key in trigger_project_forecast_email with vault secret lookup
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
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('time', now(), 'triggered_by', 'cron')
    ) INTO v_response_id;
    
    RAISE LOG 'Edge function triggered, response_id: %', v_response_id;
  ELSE
    RAISE LOG 'No matching schedule found for current day/time';
  END IF;
END;
$function$;