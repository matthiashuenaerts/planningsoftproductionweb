
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "date" DATE NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('production', 'installation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holidays_date_team_unique UNIQUE (date, team)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to holidays" 
ON public.holidays
FOR ALL
USING (true)
WITH CHECK (true);
