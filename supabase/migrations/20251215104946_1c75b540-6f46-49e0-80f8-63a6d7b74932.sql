-- Create a table to store external API configurations
CREATE TABLE public.external_api_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_type TEXT NOT NULL UNIQUE, -- 'projects' or 'orders'
  base_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_api_configs ENABLE ROW LEVEL SECURITY;

-- Create policies - only admins can access
CREATE POLICY "Admins can view API configs" 
ON public.external_api_configs 
FOR SELECT 
USING (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert API configs" 
ON public.external_api_configs 
FOR INSERT 
WITH CHECK (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update API configs" 
ON public.external_api_configs 
FOR UPDATE 
USING (check_employee_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete API configs" 
ON public.external_api_configs 
FOR DELETE 
USING (check_employee_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_external_api_configs_updated_at
BEFORE UPDATE ON public.external_api_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Also allow service role full access (for edge functions)
CREATE POLICY "Service role can access API configs"
ON public.external_api_configs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');