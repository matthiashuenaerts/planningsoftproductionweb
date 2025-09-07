-- Create orders sync logs table
CREATE TABLE public.orders_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for reading sync logs
CREATE POLICY "Allow read access to orders sync logs" 
ON public.orders_sync_logs 
FOR SELECT 
USING (true);