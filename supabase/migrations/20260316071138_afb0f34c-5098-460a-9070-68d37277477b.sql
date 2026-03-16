-- Reverse sync: when projects.installation_date changes, update the non-service-ticket assignment's start_date
CREATE OR REPLACE FUNCTION public.sync_team_assignment_from_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when installation_date actually changed
  IF OLD.installation_date IS DISTINCT FROM NEW.installation_date THEN
    UPDATE public.project_team_assignments
    SET start_date = NEW.installation_date,
        updated_at = now()
    WHERE project_id = NEW.id
      AND is_service_ticket = false;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on projects table
CREATE TRIGGER trigger_sync_team_assignment_from_project
  AFTER UPDATE OF installation_date ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_assignment_from_project();