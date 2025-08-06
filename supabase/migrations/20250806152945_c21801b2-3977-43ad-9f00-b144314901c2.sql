-- Create table for workstation positions on floorplan
CREATE TABLE workstation_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workstation_id UUID NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for production flow lines
CREATE TABLE production_flow_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_x NUMERIC NOT NULL,
  start_y NUMERIC NOT NULL,
  end_x NUMERIC NOT NULL,
  end_y NUMERIC NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  stroke_width INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE workstation_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_flow_lines ENABLE ROW LEVEL SECURITY;

-- Create policies for workstation_positions
CREATE POLICY "All employees can view workstation positions" 
ON workstation_positions FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify workstation positions" 
ON workstation_positions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM employees 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Create policies for production_flow_lines
CREATE POLICY "All employees can view production flow lines" 
ON production_flow_lines FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify production flow lines" 
ON production_flow_lines FOR ALL 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM employees 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Create triggers for updated_at
CREATE TRIGGER update_workstation_positions_updated_at
BEFORE UPDATE ON workstation_positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_flow_lines_updated_at
BEFORE UPDATE ON production_flow_lines
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();