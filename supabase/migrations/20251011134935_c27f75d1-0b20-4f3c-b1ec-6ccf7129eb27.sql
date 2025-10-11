-- Create a table for working hours breaks
CREATE TABLE IF NOT EXISTS public.working_hours_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  working_hours_id UUID NOT NULL REFERENCES public.working_hours(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.working_hours_breaks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all access to working_hours_breaks"
ON public.working_hours_breaks
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_working_hours_breaks_updated_at
BEFORE UPDATE ON public.working_hours_breaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();