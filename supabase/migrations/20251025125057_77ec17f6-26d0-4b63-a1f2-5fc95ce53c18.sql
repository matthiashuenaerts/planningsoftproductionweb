-- Add 'charged' status to orders table status check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'delivered', 'canceled', 'delayed', 'partially_delivered', 'charged'));