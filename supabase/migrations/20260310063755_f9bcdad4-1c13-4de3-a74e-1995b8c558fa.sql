CREATE OR REPLACE FUNCTION public.sync_project_installation_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_type TEXT;
BEGIN
  -- Skip if start_date is NULL (unscheduled after sales)
  IF NEW.start_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the assigned team is a service team; if so, skip syncing installation_date
  IF NEW.team_id IS NOT NULL THEN
    SELECT team_type INTO v_team_type
    FROM public.placement_teams
    WHERE id = NEW.team_id;

    IF v_team_type = 'service' THEN
      RETURN NEW;
    END IF;
  END IF;

  UPDATE public.projects 
  SET installation_date = NEW.start_date,
      updated_at = now()
  WHERE id = NEW.project_id;

  RETURN NEW;
END;
$$;