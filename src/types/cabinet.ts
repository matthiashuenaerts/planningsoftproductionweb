export type ModuleType = 'horizontal_division' | 'vertical_division' | 'drawer' | 'shelf';

export interface Module {
  id: string;
  type: ModuleType;
  position: number; // Position from top (for horizontal) or left (for vertical) in mm
  height?: number; // For drawers and horizontal divisions
  width?: number; // For vertical divisions
  hardware_id?: string; // For drawers - references cabinet_materials table
  material_id?: string; // Material override for this specific module
}

// Parametric panel system for cabinet models
export type DimensionVariable = 'width' | 'height' | 'depth' | 'body_thickness' | 'door_thickness' | 'shelf_thickness';
export type PanelType = 'bottom' | 'top' | 'left_side' | 'right_side' | 'back' | 'shelf' | 'divider' | 'door' | 'drawer_front';

export interface ParametricPanel {
  id: string;
  name: string;
  type: PanelType;
  // Position variables (can be numbers or variable references or expressions)
  x: number | string;
  y: number | string;
  z: number | string;
  // Dimension variables (can be numbers or variable references or expressions)
  length: number | string;
  width: number | string;
  thickness: number | string;
  // Material reference
  material_type: 'body' | 'door' | 'shelf';
  // Visual properties
  visible: boolean;
  color?: string;
}

export interface Compartment {
  id: string;
  x: number; // Position from left in mm
  y: number; // Position from top in mm
  width: number; // Width in mm
  height: number; // Height in mm
  modules: Module[];
}

export interface CabinetConfiguration {
  name: string;
  width: number;
  height: number;
  depth: number;
  material_config: {
    body_material: string;
    door_material: string;
    shelf_material: string;
    body_thickness?: number;
    door_thickness?: number;
    shelf_thickness?: number;
  };
  edge_banding: string;
  finish: string;
  door_type: string;
  compartments: Compartment[];
}
