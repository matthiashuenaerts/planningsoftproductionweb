
-- Create workstation_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workstation_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
    task_title text NOT NULL,
    user_name text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.workstation_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Everyone can view workstation schedules" ON public.workstation_schedules
    FOR SELECT USING (true);

CREATE POLICY "Only admins and managers can modify workstation schedules" ON public.workstation_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = auth.uid() 
            AND employees.role IN ('admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = auth.uid() 
            AND employees.role IN ('admin', 'manager')
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_workstation_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workstation_schedules_updated_at_trigger
    BEFORE UPDATE ON public.workstation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_workstation_schedules_updated_at();
