CREATE OR REPLACE FUNCTION public.trigger_project_sync_per_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anon_key text;
  v_config RECORD;
  v_response_id bigint;
BEGIN
  RAISE LOG 'project-sync dispatcher: starting per-tenant dispatch...';

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
    RAISE LOG 'project-sync dispatcher: SUPABASE_ANON_KEY not found in vault, skipping';
    RETURN;
  END IF;

  FOR v_config IN
    SELECT DISTINCT tenant_id
    FROM public.external_api_configs
    WHERE api_type = 'projects'
      AND tenant_id IS NOT NULL
  LOOP
    RAISE LOG 'project-sync dispatcher: triggering sync for tenant %', v_config.tenant_id;

    SELECT net.http_post(
      url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/project-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'automated', true,
        'tenant_id', v_config.tenant_id
      )
    ) INTO v_response_id;

    RAISE LOG 'project-sync dispatcher: tenant % dispatched, response_id: %', v_config.tenant_id, v_response_id;
  END LOOP;

  RAISE LOG 'project-sync dispatcher: all tenants dispatched';
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_orders_sync_per_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anon_key text;
  v_config RECORD;
  v_response_id bigint;
BEGIN
  RAISE LOG 'orders-sync dispatcher: starting per-tenant dispatch...';

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
    RAISE LOG 'orders-sync dispatcher: SUPABASE_ANON_KEY not found in vault, skipping';
    RETURN;
  END IF;

  FOR v_config IN
    SELECT DISTINCT tenant_id
    FROM public.external_api_configs
    WHERE api_type = 'orders'
      AND tenant_id IS NOT NULL
  LOOP
    RAISE LOG 'orders-sync dispatcher: triggering sync for tenant %', v_config.tenant_id;

    SELECT net.http_post(
      url := 'https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'automated', true,
        'tenant_id', v_config.tenant_id
      )
    ) INTO v_response_id;

    RAISE LOG 'orders-sync dispatcher: tenant % dispatched, response_id: %', v_config.tenant_id, v_response_id;
  END LOOP;
END;
$function$;