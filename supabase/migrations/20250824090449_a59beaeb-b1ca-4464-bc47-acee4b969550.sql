-- Enable RLS on order related tables and add policies
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_steps ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for order_items
CREATE POLICY "Allow all employees to view order items" 
ON order_items 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to modify order items" 
ON order_items 
FOR ALL
USING (true)
WITH CHECK (true);

-- Add RLS policies for order_attachments
CREATE POLICY "Allow all employees to view order attachments" 
ON order_attachments 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to modify order attachments" 
ON order_attachments 
FOR ALL
USING (true)
WITH CHECK (true);

-- Add RLS policies for order_steps
CREATE POLICY "Allow all employees to view order steps" 
ON order_steps 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to modify order steps" 
ON order_steps 
FOR ALL
USING (true)
WITH CHECK (true);