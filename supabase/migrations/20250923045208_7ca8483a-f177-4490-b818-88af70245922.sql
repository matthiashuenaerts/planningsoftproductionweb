-- Update RLS policies for placement_team_members to allow managers and admins to modify team memberships

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Only admins can modify team members" ON public.placement_team_members;

-- Create new policies that allow admins and managers to modify team members
CREATE POLICY "Admins and managers can insert team members" 
ON public.placement_team_members 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can update team members" 
ON public.placement_team_members 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete team members" 
ON public.placement_team_members 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);