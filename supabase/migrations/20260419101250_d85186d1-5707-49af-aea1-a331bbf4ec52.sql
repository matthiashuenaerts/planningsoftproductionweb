CREATE POLICY "tenant members update external_orders_buffer"
ON public.external_orders_buffer
FOR UPDATE
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));