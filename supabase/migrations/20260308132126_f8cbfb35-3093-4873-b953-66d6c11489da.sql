
-- Automation logs table for tracking scheduled jobs, forecast emails, etc.
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  action_type TEXT NOT NULL, -- 'midnight_scheduler', 'forecast_email', 'project_sync', 'order_sync'
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  summary TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can view all automation logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (public.is_developer(auth.uid()));

CREATE POLICY "Service role can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
CREATE INDEX idx_automation_logs_action_type ON public.automation_logs(action_type);
CREATE INDEX idx_automation_logs_status ON public.automation_logs(status);
