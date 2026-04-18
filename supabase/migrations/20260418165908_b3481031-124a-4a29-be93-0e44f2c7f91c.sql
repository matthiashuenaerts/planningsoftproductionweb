
-- Logistics group chat: tenant-wide chat for employees with logistics=true
CREATE TABLE IF NOT EXISTS public.logistics_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_chat_messages_tenant_created
  ON public.logistics_chat_messages (tenant_id, created_at DESC);

ALTER TABLE public.logistics_chat_messages ENABLE ROW LEVEL SECURITY;

-- Auto-set tenant_id on insert
DROP TRIGGER IF EXISTS set_tenant_id_logistics_chat_messages ON public.logistics_chat_messages;
CREATE TRIGGER set_tenant_id_logistics_chat_messages
  BEFORE INSERT ON public.logistics_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Helper: is the current user a logistics employee in this tenant?
CREATE OR REPLACE FUNCTION public.is_logistics_employee(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_user_id = _user_id
      AND e.tenant_id = _tenant_id
      AND (e.logistics = true OR e.role IN ('admin','manager','teamleader'))
  );
$$;

-- Read: any logistics member of the tenant
CREATE POLICY "logistics members can read" ON public.logistics_chat_messages
  FOR SELECT TO authenticated
  USING (public.is_logistics_employee(auth.uid(), tenant_id));

-- Insert: must be a logistics member and the employee_id must match the caller
CREATE POLICY "logistics members can insert" ON public.logistics_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_logistics_employee(auth.uid(), tenant_id)
    AND employee_id = public.get_employee_id_from_auth(auth.uid())
  );

-- Sender can delete their own messages
CREATE POLICY "sender can delete own" ON public.logistics_chat_messages
  FOR DELETE TO authenticated
  USING (employee_id = public.get_employee_id_from_auth(auth.uid()));

-- Trigger: notify all logistics employees in the tenant (except sender) on new message
CREATE OR REPLACE FUNCTION public.notify_logistics_chat_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_recipient RECORD;
  v_link TEXT;
  v_preview TEXT;
BEGIN
  SELECT name INTO v_sender_name FROM public.employees WHERE id = NEW.employee_id;
  v_link := '/logistics';
  v_preview := substring(NEW.message from 1 for 80);

  FOR v_recipient IN
    SELECT id FROM public.employees
    WHERE tenant_id = NEW.tenant_id
      AND id <> NEW.employee_id
      AND (logistics = true OR role IN ('admin','manager','teamleader'))
  LOOP
    INSERT INTO public.notifications (user_id, message, link)
    VALUES (
      v_recipient.id,
      'Logistics chat — ' || COALESCE(v_sender_name, 'Someone') || ': ' || v_preview,
      v_link
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_logistics_chat_message_trigger ON public.logistics_chat_messages;
CREATE TRIGGER notify_logistics_chat_message_trigger
  AFTER INSERT ON public.logistics_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_chat_message();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_chat_messages;
