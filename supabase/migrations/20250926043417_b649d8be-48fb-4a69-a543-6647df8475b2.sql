-- Create project messages table
CREATE TABLE public.project_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  message TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  is_image BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All employees can view project messages" 
ON public.project_messages 
FOR SELECT 
USING (true);

CREATE POLICY "All employees can create project messages" 
ON public.project_messages 
FOR INSERT 
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Employees can update their own messages" 
ON public.project_messages 
FOR UPDATE 
USING (auth.uid() = employee_id);

-- Create project message reads table for tracking read status
CREATE TABLE public.project_message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.project_message_reads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Employees can view their own read status" 
ON public.project_message_reads 
FOR SELECT 
USING (auth.uid() = employee_id);

CREATE POLICY "Employees can update their own read status" 
ON public.project_message_reads 
FOR ALL 
USING (auth.uid() = employee_id)
WITH CHECK (auth.uid() = employee_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_project_messages_updated_at
  BEFORE UPDATE ON public.project_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_message_reads_updated_at
  BEFORE UPDATE ON public.project_message_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();