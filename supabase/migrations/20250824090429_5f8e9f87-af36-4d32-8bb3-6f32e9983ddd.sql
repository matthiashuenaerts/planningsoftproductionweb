-- Add delivered_quantity to order_items table
ALTER TABLE order_items 
ADD COLUMN delivered_quantity integer NOT NULL DEFAULT 0;

-- Add stock_location to order_items table  
ALTER TABLE order_items
ADD COLUMN stock_location text;

-- Update orders status to include partially_delivered
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'delivered', 'canceled', 'delayed', 'partially_delivered'));