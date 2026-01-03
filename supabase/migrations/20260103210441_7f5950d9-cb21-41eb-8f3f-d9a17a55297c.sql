-- Add margin percentage columns to project_costing table
ALTER TABLE public.project_costing
ADD COLUMN labor_margin_percentage numeric DEFAULT 35,
ADD COLUMN order_materials_margin_percentage numeric DEFAULT 35,
ADD COLUMN accessories_margin_percentage numeric DEFAULT 35;