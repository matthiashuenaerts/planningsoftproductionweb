-- Create general_messages table for system-wide announcements
CREATE TABLE public.general_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'info' CHECK (message_type IN ('info', 'warning', 'success', 'error')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create dismissed_messages table to track which users have dismissed which messages
CREATE TABLE public.dismissed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.general_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Add updated_at trigger for general_messages
CREATE TRIGGER update_general_messages_updated_at
  BEFORE UPDATE ON public.general_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.general_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for general_messages
CREATE POLICY "Anyone can read active general messages"
  ON public.general_messages
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_developer(auth.uid()));

CREATE POLICY "Developers can manage general messages"
  ON public.general_messages
  FOR ALL
  TO authenticated
  USING (public.is_developer(auth.uid()))
  WITH CHECK (public.is_developer(auth.uid()));

-- RLS policies for dismissed_messages
CREATE POLICY "Users can read own dismissed messages"
  ON public.dismissed_messages
  FOR SELECT
  TO authenticated
  USING (user_id = public.get_employee_id_from_auth(auth.uid()) OR public.is_developer(auth.uid()));

CREATE POLICY "Users can dismiss messages"
  ON public.dismissed_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = public.get_employee_id_from_auth(auth.uid()));

CREATE POLICY "Users can delete own dismissed messages"
  ON public.dismissed_messages
  FOR DELETE
  TO authenticated
  USING (user_id = public.get_employee_id_from_auth(auth.uid()) OR public.is_developer(auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_general_messages_active ON public.general_messages(is_active) WHERE is_active = true;
CREATE INDEX idx_dismissed_messages_user ON public.dismissed_messages(user_id);
CREATE INDEX idx_dismissed_messages_message ON public.dismissed_messages(message_id);