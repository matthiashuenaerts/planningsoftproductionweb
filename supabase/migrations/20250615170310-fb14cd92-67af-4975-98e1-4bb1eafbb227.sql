
-- Add 'order_type' and 'notes' to the orders table
ALTER TABLE public.orders
ADD COLUMN order_type TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN notes TEXT;

-- Add 'accessory_id' and 'notes' to the order_items table
ALTER TABLE public.order_items
ADD COLUMN accessory_id UUID REFERENCES public.accessories(id) ON DELETE SET NULL,
ADD COLUMN notes TEXT;

-- Create the new 'order_steps' table
CREATE TABLE public.order_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    supplier TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    start_date DATE,
    expected_duration_days INTEGER,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add an index for better performance
CREATE INDEX idx_order_steps_order_id ON public.order_steps(order_id);

-- Create a trigger to automatically update the 'updated_at' timestamp for order_steps
CREATE TRIGGER handle_updated_at_order_steps
BEFORE UPDATE ON public.order_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
