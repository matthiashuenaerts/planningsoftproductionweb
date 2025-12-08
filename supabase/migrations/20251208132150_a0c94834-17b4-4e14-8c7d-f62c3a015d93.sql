-- Add drawer accessory cost columns to legrabox_configurations
ALTER TABLE public.legrabox_configurations 
ADD COLUMN IF NOT EXISTS antislip_mat_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_on_cost numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.legrabox_configurations.antislip_mat_cost IS 'Additional cost for anti-slip fiber mat option';
COMMENT ON COLUMN public.legrabox_configurations.tip_on_cost IS 'Additional cost for TIP-ON mechanical opening system';