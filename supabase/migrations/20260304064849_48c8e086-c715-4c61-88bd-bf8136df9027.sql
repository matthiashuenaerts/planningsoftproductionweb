
-- Add buffer location coordinates to workstation_positions
ALTER TABLE public.workstation_positions
ADD COLUMN buffer_x_position numeric DEFAULT 0,
ADD COLUMN buffer_y_position numeric DEFAULT 0;
