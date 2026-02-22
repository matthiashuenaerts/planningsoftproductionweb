
-- Fix: make working_hours unique per tenant
ALTER TABLE public.working_hours DROP CONSTRAINT IF EXISTS working_hours_team_day_of_week_key;
ALTER TABLE public.working_hours ADD CONSTRAINT working_hours_team_day_tenant_unique UNIQUE (team, day_of_week, tenant_id);
