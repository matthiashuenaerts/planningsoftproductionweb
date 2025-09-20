-- Create placement teams table
CREATE TABLE public.placement_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create placement team members table (for default team members)
CREATE TABLE public.placement_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.placement_teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, employee_id)
);

-- Create daily team assignments table (for daily assignments including manual ones)
CREATE TABLE public.daily_team_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.placement_teams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, employee_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.placement_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_team_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for placement teams
CREATE POLICY "Allow all employees to view placement teams" 
ON public.placement_teams 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify placement teams" 
ON public.placement_teams 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create RLS policies for placement team members
CREATE POLICY "Allow all employees to view team members" 
ON public.placement_team_members 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify team members" 
ON public.placement_team_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create RLS policies for daily team assignments
CREATE POLICY "Allow all employees to view daily assignments" 
ON public.daily_team_assignments 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all employees to modify daily assignments" 
ON public.daily_team_assignments 
FOR ALL 
USING (true);

-- Create update trigger for placement teams
CREATE TRIGGER update_placement_teams_updated_at
  BEFORE UPDATE ON public.placement_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create update trigger for daily team assignments  
CREATE TRIGGER update_daily_team_assignments_updated_at
  BEFORE UPDATE ON public.daily_team_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample placement teams
INSERT INTO public.placement_teams (name, color) VALUES 
('Installation Team Green', 'green'),
('Installation Team Blue', 'blue'),
('Installation Team Orange', 'orange');