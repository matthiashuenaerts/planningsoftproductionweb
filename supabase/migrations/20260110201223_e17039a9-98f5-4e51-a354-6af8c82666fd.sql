-- Insert default mappings for accessories CSV import
INSERT INTO public.csv_import_configs (config_name, csv_header, db_column, is_required, display_order, description) VALUES
('accessories', 'article_name', 'article_name', true, 1, 'Name of the accessory item'),
('accessories', 'article_description', 'article_description', false, 2, 'Description of the accessory'),
('accessories', 'article_code', 'article_code', false, 3, 'Article/product code'),
('accessories', 'quantity', 'quantity', false, 4, 'Quantity to import'),
('accessories', 'stock_location', 'stock_location', false, 5, 'Stock location'),
('accessories', 'status', 'status', false, 6, 'Status (to_check, in_stock, delivered, to_order, ordered)'),
('accessories', 'supplier', 'supplier', false, 7, 'Supplier name'),
('accessories', 'qr_code_text', 'qr_code_text', false, 8, 'QR code text');