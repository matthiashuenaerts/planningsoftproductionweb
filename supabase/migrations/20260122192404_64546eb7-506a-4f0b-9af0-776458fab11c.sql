-- First, remove duplicate workstation_positions keeping only the most recent one per workstation_id
DELETE FROM public.workstation_positions a
USING public.workstation_positions b
WHERE a.workstation_id = b.workstation_id
  AND a.created_at < b.created_at;

-- Now add unique constraint on workstation_id
ALTER TABLE public.workstation_positions 
ADD CONSTRAINT workstation_positions_workstation_id_key UNIQUE (workstation_id);