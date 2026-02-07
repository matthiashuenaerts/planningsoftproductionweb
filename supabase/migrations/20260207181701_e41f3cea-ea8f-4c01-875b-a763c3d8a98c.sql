
-- Create table for recurring task schedules (standard returning tasks)
CREATE TABLE public.recurring_task_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  standard_task_id UUID NOT NULL REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TEXT NOT NULL, -- e.g. '08:00'
  end_time TEXT NOT NULL, -- e.g. '09:30'
  employee_ids UUID[] NOT NULL DEFAULT '{}',
  workstation_id UUID REFERENCES public.workstations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_task_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow all authenticated users to read, admins to modify
CREATE POLICY "All authenticated users can read recurring task schedules"
ON public.recurring_task_schedules FOR SELECT
USING (true);

CREATE POLICY "Admins can insert recurring task schedules"
ON public.recurring_task_schedules FOR INSERT
WITH CHECK (public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can update recurring task schedules"
ON public.recurring_task_schedules FOR UPDATE
USING (public.check_employee_roles(auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete recurring task schedules"
ON public.recurring_task_schedules FOR DELETE
USING (public.check_employee_roles(auth.uid(), ARRAY['admin']));

-- Trigger for updated_at
CREATE TRIGGER update_recurring_task_schedules_updated_at
BEFORE UPDATE ON public.recurring_task_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
