
-- Add a link column to the notifications table to store URLs
ALTER TABLE public.notifications ADD COLUMN link TEXT;

-- Create a function to send notifications for long projects
CREATE OR REPLACE FUNCTION public.notify_long_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj_name TEXT;
  employee_record RECORD;
  project_link TEXT;
BEGIN
  -- Check if the project duration is greater than 5 days
  IF NEW.duration > 5 THEN
    -- Get the project name
    SELECT name INTO proj_name FROM projects WHERE id = NEW.project_id;
    
    -- Create a link to the project details page
    project_link := '/projects/' || NEW.project_id;

    -- Loop through all employees with 'admin' or 'teamleader' roles
    FOR employee_record IN
      SELECT id FROM employees WHERE role IN ('admin', 'teamleader')
    LOOP
      -- Insert a notification for each qualifying employee
      INSERT INTO notifications (user_id, message, link)
      VALUES (employee_record.id, 'Project "' || proj_name || '" has a duration of ' || NEW.duration || ' days.', project_link);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create a trigger that executes the function after a project assignment is inserted or its duration is updated
CREATE TRIGGER long_project_assignment_notification
AFTER INSERT OR UPDATE OF duration ON public.project_team_assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_long_project_assignment();
