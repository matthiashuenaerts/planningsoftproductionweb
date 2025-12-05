import type { CabinetConfiguration, ParametricPanel } from '@/types/cabinet';
import type { Database } from '@/integrations/supabase/types';

type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

interface ModelHardware {
  id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  quantity: string | number;
  unit_price: number;
  notes?: string;
}

interface LaborLine {
  id: string;
  name: string;
  formula: string;
  unit: 'minutes' | 'euros';
}

interface LaborConfig {
  hourly_rate: number;
  lines?: LaborLine[];
  // Legacy fields for backwards compatibility
  base_minutes?: number;
  per_panel_minutes?: number;
  per_front_minutes?: number;
  per_compartment_item_minutes?: number;
}

interface CabinetFront {
  id: string;
  name: string;
  front_type: string;
  width: string;
  height: string;
  thickness: string;
  quantity: number;
  material_type: string;
  visible: boolean;
}

interface CompartmentData {
  id: string;
  name: string;
  width: string;
  height: string;
  depth: string;
  items: any[];
}

interface ModelParameters {
  panels?: ParametricPanel[];
  fronts?: CabinetFront[];
  compartments?: CompartmentData[];
  parametric_compartments?: CompartmentData[];
  hardware?: ModelHardware[];
  laborConfig?: LaborConfig;
  frontHardware?: any[];
}

interface PanelCut {
  name: string;
  width: number;
  height: number;
  thickness: number;
  material_id: string;
  material_name: string;
  quantity: number;
  edge_banding: string[];
  area: number;
}

interface CostBreakdown {
  materials_cost: number;
  hardware_cost: number;
  labor_minutes: number;
  labor_cost: number;
  subtotal: number;
  overhead_cost: number;
  overhead_percentage: number;
  margin_amount: number;
  margin_percentage: number;
  tax_amount: number;
  tax_percentage: number;
  total_cost: number;
  panels: PanelCut[];
  material_areas: {
    body: number;
    door: number;
    shelf: number;
    total: number;
  };
  hardware_items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

function evaluateExpression(expr: string | number, variables: Record<string, number>): number {
  if (typeof expr === 'number') return expr;
  
  let evaluated = String(expr);
  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
  
  sortedKeys.forEach((key) => {
    evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), String(variables[key]));
  });
  
  try {
    return Function(`"use strict"; return (${evaluated})`)();
  } catch (e) {
    return 0;
  }
}

export class CabinetCalculationService {
  private materials: CabinetMaterial[];
  private overheadPercentage: number = 15;
  private defaultLaborLines: LaborLine[] = [
    { id: '1', name: 'Base Assembly', formula: '30', unit: 'minutes' },
    { id: '2', name: 'Panel Work', formula: 'panels * 5', unit: 'minutes' },
    { id: '3', name: 'Front Installation', formula: 'fronts * 15', unit: 'minutes' },
    { id: '4', name: 'Interior Items', formula: 'compartment_items * 10', unit: 'minutes' },
  ];

  constructor(materials: CabinetMaterial[]) {
    this.materials = materials;
  }

  calculateCostsWithModel(
    config: CabinetConfiguration,
    modelParameters?: ModelParameters
  ): CostBreakdown {
    const bodyThickness = config.material_config.body_thickness || 18;
    const doorThickness = config.material_config.door_thickness || 18;
    const shelfThickness = config.material_config.shelf_thickness || 18;

    const variables: Record<string, number> = {
      width: config.width,
      height: config.height,
      depth: config.depth,
      body_thickness: bodyThickness,
      door_thickness: doorThickness,
      shelf_thickness: shelfThickness,
      door_count: 0,
      drawer_count: 0,
    };

    // Count doors and drawers from fronts
    const fronts = modelParameters?.fronts || [];
    variables.door_count = fronts.filter(f => f.front_type === 'hinged_door' && f.visible).length;
    variables.drawer_count = fronts.filter(f => f.front_type === 'drawer_front' && f.visible).length;

    // Get materials
    const bodyMaterial = this.materials.find(m => m.id === config.material_config.body_material);
    const doorMaterial = this.materials.find(m => m.id === config.material_config.door_material);
    const shelfMaterial = this.materials.find(m => m.id === config.material_config.shelf_material);

    // Calculate material areas
    const materialAreas = this.calculateMaterialAreas(
      modelParameters?.panels || [],
      fronts,
      modelParameters?.parametric_compartments || modelParameters?.compartments || [],
      variables
    );

    // Calculate material costs based on areas
    const materialCosts = this.calculateMaterialCostsFromAreas(
      materialAreas,
      bodyMaterial,
      doorMaterial,
      shelfMaterial
    );

    // Calculate hardware costs (model hardware + front hardware)
    const hardwareResult = this.calculateHardwareCostsFromModel(
      modelParameters?.hardware || [],
      modelParameters?.frontHardware || [],
      variables
    );

    // Calculate labor with full variable context
    const laborConfig = modelParameters?.laborConfig || { hourly_rate: 45, lines: this.defaultLaborLines };
    const laborResult = this.calculateLaborFromModel(
      modelParameters?.panels || [],
      fronts,
      modelParameters?.parametric_compartments || modelParameters?.compartments || [],
      laborConfig,
      { ...variables, ...materialAreas, total_area: materialAreas.body + materialAreas.door + materialAreas.shelf },
      modelParameters?.hardware || []
    );

    const subtotal = materialCosts + hardwareResult.total + laborResult.cost;
    const overhead_cost = subtotal * (this.overheadPercentage / 100);
    const total_cost = subtotal + overhead_cost;

    return {
      materials_cost: Math.round(materialCosts * 100) / 100,
      hardware_cost: Math.round(hardwareResult.total * 100) / 100,
      labor_minutes: laborResult.minutes,
      labor_cost: Math.round(laborResult.cost * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      overhead_cost: Math.round(overhead_cost * 100) / 100,
      overhead_percentage: this.overheadPercentage,
      margin_amount: 0,
      margin_percentage: 0,
      tax_amount: 0,
      tax_percentage: 0,
      total_cost: Math.round(total_cost * 100) / 100,
      panels: [],
      material_areas: {
        body: Math.round(materialAreas.body * 1000) / 1000,
        door: Math.round(materialAreas.door * 1000) / 1000,
        shelf: Math.round(materialAreas.shelf * 1000) / 1000,
        total: Math.round((materialAreas.body + materialAreas.door + materialAreas.shelf) * 1000) / 1000,
      },
      hardware_items: hardwareResult.items,
    };
  }

  private calculateMaterialAreas(
    panels: ParametricPanel[],
    fronts: CabinetFront[],
    compartments: CompartmentData[],
    variables: Record<string, number>
  ): { body: number; door: number; shelf: number } {
    const areas = { body: 0, door: 0, shelf: 0 };

    // Calculate panel areas
    panels.filter(p => p.visible).forEach((panel) => {
      const length = evaluateExpression(panel.length, variables);
      const width = evaluateExpression(panel.width, variables);
      const area = (length * width) / 1000000; // Convert to m²

      if (panel.material_type === 'door') {
        areas.door += area;
      } else if (panel.material_type === 'shelf') {
        areas.shelf += area;
      } else {
        areas.body += area;
      }
    });

    // Calculate front areas
    fronts.filter(f => f.visible).forEach((front) => {
      const w = evaluateExpression(front.width, variables);
      const h = evaluateExpression(front.height, variables);
      const qty = front.quantity || 1;
      const area = (w * h * qty) / 1000000;
      areas.door += area;
    });

    // Calculate compartment item areas
    compartments.forEach((comp) => {
      const compW = evaluateExpression(comp.width, variables);
      const compD = evaluateExpression(comp.depth, variables);
      const compH = evaluateExpression(comp.height, variables);

      (comp.items || []).forEach((item) => {
        const qty = item.quantity || 1;
        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const area = (compW * compD * qty) / 1000000;
          areas.shelf += area;
        } else if (item.item_type === 'vertical_divider') {
          const area = (compH * compD) / 1000000;
          areas.body += area;
        }
      });
    });

    return areas;
  }

  private calculateMaterialCostsFromAreas(
    areas: { body: number; door: number; shelf: number },
    bodyMaterial?: CabinetMaterial | null,
    doorMaterial?: CabinetMaterial | null,
    shelfMaterial?: CabinetMaterial | null
  ): number {
    let totalCost = 0;
    const wasteFactor = 1.1; // 10% waste

    if (bodyMaterial) {
      totalCost += areas.body * wasteFactor * bodyMaterial.cost_per_unit;
    }
    if (doorMaterial) {
      totalCost += areas.door * wasteFactor * doorMaterial.cost_per_unit;
    }
    if (shelfMaterial) {
      totalCost += areas.shelf * wasteFactor * shelfMaterial.cost_per_unit;
    }

    // Edge banding estimate: €2 per linear meter, roughly 4m per m² of panels
    const totalArea = areas.body + areas.door + areas.shelf;
    totalCost += totalArea * 4 * 2;

    return totalCost;
  }

  private calculateHardwareCostsFromModel(
    hardware: ModelHardware[],
    frontHardware: any[],
    variables: Record<string, number>
  ): { total: number; items: Array<{ name: string; quantity: number; unit_price: number; total_price: number }> } {
    const items: Array<{ name: string; quantity: number; unit_price: number; total_price: number }> = [];
    let total = 0;

    // Model-level hardware
    hardware.forEach((h) => {
      const qty = Math.ceil(evaluateExpression(h.quantity, variables));
      const totalPrice = qty * h.unit_price;
      total += totalPrice;
      items.push({
        name: h.product_name || 'Unknown hardware',
        quantity: qty,
        unit_price: h.unit_price,
        total_price: totalPrice,
      });
    });

    // Front-level hardware
    frontHardware.forEach((fh) => {
      const productData = fh.products;
      const unitPrice = productData?.price_per_unit || productData?.price || 0;
      if (productData && unitPrice > 0) {
        const qty = fh.quantity || 1;
        const totalPrice = qty * unitPrice;
        total += totalPrice;
        items.push({
          name: productData.name || 'Unknown hardware',
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
        });
      }
    });

    return { total, items };
  }

  private calculateLaborFromModel(
    panels: ParametricPanel[],
    fronts: CabinetFront[],
    compartments: CompartmentData[],
    laborConfig: LaborConfig,
    baseVariables: Record<string, number>,
    hardware: ModelHardware[]
  ): { minutes: number; cost: number } {
    const visiblePanels = panels.filter(p => p.visible);
    const visibleFronts = fronts.filter(f => f.visible);
    const panelCount = visiblePanels.length;
    const totalPanelCount = panels.length;
    const interiorPanels = panels.filter(p => p.material_type === 'shelf' || p.name?.toLowerCase().includes('shelf')).length;
    const frontCount = visibleFronts.reduce((sum, f) => sum + (f.quantity || 1), 0);
    const compartmentItemCount = compartments.reduce((sum, c) => sum + (c.items?.length || 0), 0);
    const hardwareCount = hardware.reduce((sum, h) => sum + Math.ceil(evaluateExpression(h.quantity, baseVariables)), 0);
    
    // Calculate front area and total edges accurately
    let frontArea = 0;
    let totalEdges = 0;
    
    visiblePanels.forEach(panel => {
      const length = evaluateExpression(panel.length, baseVariables);
      const width = evaluateExpression(panel.width, baseVariables);
      totalEdges += 2 * (length + width) / 1000; // Convert to meters
    });
    
    visibleFronts.forEach(f => {
      const w = evaluateExpression(f.width, baseVariables);
      const h = evaluateExpression(f.height, baseVariables);
      const qty = f.quantity || 1;
      frontArea += (w * h * qty) / 1000000;
      totalEdges += (2 * (w + h) * qty) / 1000; // Convert to meters
    });

    // Build complete variable set for formula evaluation
    const variables: Record<string, number> = {
      ...baseVariables,
      panels: panelCount,
      total_panels: totalPanelCount,
      interior_panels: interiorPanels,
      fronts: frontCount,
      compartment_items: compartmentItemCount,
      hardware_count: hardwareCount,
      body_area: baseVariables.body || 0,
      door_area: baseVariables.door || 0,
      shelf_area: baseVariables.shelf || 0,
      front_area: frontArea,
      volume: (baseVariables.width * baseVariables.height * baseVariables.depth) / 1000000000, // m³
      total_edges: totalEdges,
    };

    // Use formula-based lines if available, otherwise fall back to legacy
    const lines = laborConfig.lines || this.migrateToLines(laborConfig);
    
    let totalMinutes = 0;
    let directCost = 0;
    
    lines.forEach(line => {
      const value = evaluateExpression(line.formula, variables);
      if (line.unit === 'minutes') {
        totalMinutes += value;
      } else {
        directCost += value;
      }
    });

    const laborCost = (totalMinutes / 60) * laborConfig.hourly_rate + directCost;

    return { minutes: Math.round(totalMinutes), cost: laborCost };
  }

  private migrateToLines(config: LaborConfig): LaborLine[] {
    const lines: LaborLine[] = [];
    if (config.base_minutes) {
      lines.push({ id: '1', name: 'Base', formula: String(config.base_minutes), unit: 'minutes' });
    }
    if (config.per_panel_minutes) {
      lines.push({ id: '2', name: 'Panels', formula: `panels * ${config.per_panel_minutes}`, unit: 'minutes' });
    }
    if (config.per_front_minutes) {
      lines.push({ id: '3', name: 'Fronts', formula: `fronts * ${config.per_front_minutes}`, unit: 'minutes' });
    }
    if (config.per_compartment_item_minutes) {
      lines.push({ id: '4', name: 'Items', formula: `compartment_items * ${config.per_compartment_item_minutes}`, unit: 'minutes' });
    }
    return lines.length > 0 ? lines : this.defaultLaborLines;
  }

  // Legacy method for backward compatibility
  calculateCosts(config: CabinetConfiguration): CostBreakdown {
    return this.calculateCostsWithModel(config);
  }
}
