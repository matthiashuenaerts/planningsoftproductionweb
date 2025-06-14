
-- Drop the existing foreign key constraints
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_rush_order_id_fkey;
ALTER TABLE public.rush_order_assignments DROP CONSTRAINT IF EXISTS rush_order_assignments_rush_order_id_fkey;
ALTER TABLE public.rush_order_messages DROP CONSTRAINT IF EXISTS rush_order_messages_rush_order_id_fkey;
ALTER TABLE public.rush_order_tasks DROP CONSTRAINT IF EXISTS rush_order_tasks_rush_order_id_fkey;

-- Add new foreign key constraints with ON DELETE CASCADE
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_rush_order_id_fkey 
FOREIGN KEY (rush_order_id) 
REFERENCES public.rush_orders(id) 
ON DELETE CASCADE;

ALTER TABLE public.rush_order_assignments
ADD CONSTRAINT rush_order_assignments_rush_order_id_fkey
FOREIGN KEY (rush_order_id)
REFERENCES public.rush_orders(id)
ON DELETE CASCADE;

ALTER TABLE public.rush_order_messages
ADD CONSTRAINT rush_order_messages_rush_order_id_fkey
FOREIGN KEY (rush_order_id)
REFERENCES public.rush_orders(id)
ON DELETE CASCADE;

ALTER TABLE public.rush_order_tasks
ADD CONSTRAINT rush_order_tasks_rush_order_id_fkey
FOREIGN KEY (rush_order_id)
REFERENCES public.rush_orders(id)
ON DELETE CASCADE;
