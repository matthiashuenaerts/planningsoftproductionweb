-- Add team_id column to project_team_assignments
ALTER TABLE project_team_assignments 
ADD COLUMN team_id uuid REFERENCES placement_teams(id);

-- Create index for better query performance
CREATE INDEX idx_project_team_assignments_team_id ON project_team_assignments(team_id);

-- Update existing records to populate team_id based on team name
UPDATE project_team_assignments pta
SET team_id = pt.id
FROM placement_teams pt
WHERE pta.team = pt.name;