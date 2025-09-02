-- Add order_id column to parts_lists table to link parts lists to orders
ALTER TABLE parts_lists ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_parts_lists_order_id ON parts_lists(order_id);