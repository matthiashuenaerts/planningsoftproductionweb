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
