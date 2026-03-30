ALTER TABLE service_ticket_items ADD COLUMN IF NOT EXISTS order_article_code text;
ALTER TABLE service_ticket_items ADD COLUMN IF NOT EXISTS order_supplier text;
ALTER TABLE service_ticket_items ADD COLUMN IF NOT EXISTS order_quantity integer DEFAULT 1;