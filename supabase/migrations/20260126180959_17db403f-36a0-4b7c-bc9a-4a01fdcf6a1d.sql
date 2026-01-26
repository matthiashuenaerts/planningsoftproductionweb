-- Create table for storing Gantt chart scheduled tasks
CREATE TABLE public.gantt_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  worker_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, scheduled_date, workstation_id, worker_index)
);

-- Enable RLS
ALTER TABLE public.gantt_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all schedules"
  ON public.gantt_schedules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert schedules"
  ON public.gantt_schedules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
  ON public.gantt_schedules FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete schedules"
  ON public.gantt_schedules FOR DELETE
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_gantt_schedules_date ON public.gantt_schedules(scheduled_date);
CREATE INDEX idx_gantt_schedules_workstation ON public.gantt_schedules(workstation_id);
CREATE INDEX idx_gantt_schedules_task ON public.gantt_schedules(task_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_gantt_schedules_updated_at
  BEFORE UPDATE ON public.gantt_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();