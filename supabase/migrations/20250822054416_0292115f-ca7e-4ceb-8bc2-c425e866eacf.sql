-- Check if standard_task_checklists table exists, if not create it
DO $$
BEGIN
    -- Create standard_task_checklists table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'standard_task_checklists') THEN
        CREATE TABLE public.standard_task_checklists (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            standard_task_id UUID NOT NULL REFERENCES public.standard_tasks(id) ON DELETE CASCADE,
            item_text TEXT NOT NULL,
            is_required BOOLEAN NOT NULL DEFAULT true,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE public.standard_task_checklists ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "All employees can view standard task checklists" 
        ON public.standard_task_checklists 
        FOR SELECT 
        USING (true);

        CREATE POLICY "Only admins can modify standard task checklists" 
        ON public.standard_task_checklists 
        FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM employees 
                WHERE employees.id = auth.uid() 
                AND employees.role = 'admin'
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM employees 
                WHERE employees.id = auth.uid() 
                AND employees.role = 'admin'
            )
        );

        -- Create trigger for automatic timestamp updates
        CREATE TRIGGER update_standard_task_checklists_updated_at
        BEFORE UPDATE ON public.standard_task_checklists
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();

        -- Create index for better performance
        CREATE INDEX idx_standard_task_checklists_standard_task_id 
        ON public.standard_task_checklists(standard_task_id);
        
        CREATE INDEX idx_standard_task_checklists_display_order 
        ON public.standard_task_checklists(standard_task_id, display_order);
    END IF;
END $$;