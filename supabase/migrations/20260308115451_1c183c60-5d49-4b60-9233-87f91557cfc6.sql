
-- Create login_logs table
CREATE TABLE public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  login_method TEXT NOT NULL DEFAULT 'password',
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Developers can read all login logs
CREATE POLICY "Developers can read all login_logs"
ON public.login_logs FOR SELECT TO authenticated
USING (public.is_developer(auth.uid()));

-- Authenticated users can insert login logs (needed during login)
CREATE POLICY "Authenticated users can insert login_logs"
ON public.login_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow anon to insert (for failed login attempts before auth)
CREATE POLICY "Anyone can insert login_logs"
ON public.login_logs FOR INSERT TO anon
WITH CHECK (true);

-- Index for cleanup and querying
CREATE INDEX idx_login_logs_tenant_created ON public.login_logs(tenant_id, created_at DESC);
CREATE INDEX idx_login_logs_created_at ON public.login_logs(created_at);

-- Function to clean up old login logs (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.login_logs WHERE created_at < now() - INTERVAL '30 days';
END;
$$;
