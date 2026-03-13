CREATE OR REPLACE FUNCTION public.sync_project_installation_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if start_date is NULL (unscheduled)
  IF NEW.start_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if this is a service ticket - service tickets don't affect the main installation date
  IF NEW.is_service_ticket = true THEN
    RETURN NEW;
  END IF;

  UPDATE public.projects 
  SET installation_date = NEW.start_date,
      updated_at = now()
  WHERE id = NEW.project_id;

  RETURN NEW;
END;
$function$;