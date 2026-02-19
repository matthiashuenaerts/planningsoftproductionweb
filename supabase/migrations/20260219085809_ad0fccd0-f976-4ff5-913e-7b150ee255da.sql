
-- 1) DB function: get buffered part count only for projects with a TODO task at that workstation
CREATE OR REPLACE FUNCTION public.get_buffered_part_count_with_todo(p_workstation_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(DISTINCT pwt.id), 0)::integer
  FROM part_workstation_tracking pwt
  JOIN parts p ON p.id = pwt.part_id
  JOIN parts_lists pl ON pl.id = p.parts_list_id
  WHERE pwt.workstation_id = p_workstation_id
    AND pwt.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN task_workstation_links twl ON twl.task_id = t.id
      JOIN phases ph ON ph.id = t.phase_id
      WHERE twl.workstation_id = p_workstation_id
        AND ph.project_id = pl.project_id
        AND t.status = 'TODO'
    );
$$;

-- 2) Add onboarding_completed flag to employees for the intro wizard tracking
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
