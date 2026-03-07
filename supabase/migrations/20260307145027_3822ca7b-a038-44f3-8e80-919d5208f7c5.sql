CREATE OR REPLACE FUNCTION public.sync_project_installation_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.projects 
  SET installation_date = NEW.start_date,
      updated_at = now()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$function$;