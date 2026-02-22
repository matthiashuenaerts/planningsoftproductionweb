
-- Drop the global unique constraint on function_name and replace with per-tenant unique
ALTER TABLE public.email_configurations DROP CONSTRAINT IF EXISTS email_configurations_function_name_key;
ALTER TABLE public.email_configurations ADD CONSTRAINT email_configurations_function_name_tenant_unique UNIQUE (function_name, tenant_id);

-- Do the same for email_schedule_configs if it has a similar constraint
ALTER TABLE public.email_schedule_configs DROP CONSTRAINT IF EXISTS email_schedule_configs_function_name_key;
ALTER TABLE public.email_schedule_configs ADD CONSTRAINT email_schedule_configs_function_name_tenant_unique UNIQUE (function_name, tenant_id);
