ALTER TABLE public.tasks ADD COLUMN started_by uuid REFERENCES public.employees(id);

COMMENT ON COLUMN public.tasks.started_by IS 'Employee who first started this task';