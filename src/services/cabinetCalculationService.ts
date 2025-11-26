import type { CabinetConfiguration } from '@/types/cabinet';
import type { Database } from '@/integrations/supabase/types';

type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

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
}

export class CabinetCalculationService {
  private materials: CabinetMaterial[];
  private laborRatePerHour: number = 45; // €45/hour
  private overheadPercentage: number = 15;
  private marginPercentage: number = 20;
  private taxPercentage: number = 21;

  constructor(materials: CabinetMaterial[]) {
    this.materials = materials;
  }

  calculateCosts(config: CabinetConfiguration): CostBreakdown {
    const panels = this.generateCutList(config);
    const materials_cost = this.calculateMaterialCost(panels);
    const hardware_cost = this.calculateHardwareCost(config);
    const labor_minutes = this.calculateLaborTime(config);
    const labor_cost = (labor_minutes / 60) * this.laborRatePerHour;
    
    const subtotal = materials_cost + hardware_cost + labor_cost;
    const overhead_cost = subtotal * (this.overheadPercentage / 100);
    const margin_amount = (subtotal + overhead_cost) * (this.marginPercentage / 100);
    const tax_amount = (subtotal + overhead_cost + margin_amount) * (this.taxPercentage / 100);
    const total_cost = subtotal + overhead_cost + margin_amount + tax_amount;

    return {
      materials_cost,
      hardware_cost,
      labor_minutes,
      labor_cost,
      subtotal,
      overhead_cost,
      overhead_percentage: this.overheadPercentage,
      margin_amount,
      margin_percentage: this.marginPercentage,
      tax_amount,
      tax_percentage: this.taxPercentage,
      total_cost,
      panels,
    };
  }

  private generateCutList(config: CabinetConfiguration): PanelCut[] {
    const panels: PanelCut[] = [];
    const bodyThickness = config.material_config.body_thickness || 18;
    const bodyMaterial = this.materials.find(m => m.id === config.material_config.body_material);
    const shelfMaterial = this.materials.find(m => m.id === config.material_config.shelf_material);

    if (!bodyMaterial) return panels;

    // Cabinet body panels
    // Top and bottom
    panels.push({
      name: 'Top Panel',
      width: config.width,
      height: config.depth,
      thickness: bodyThickness,
      material_id: bodyMaterial.id,
      material_name: bodyMaterial.name,
      quantity: 1,
      edge_banding: ['front', 'left', 'right'],
      area: (config.width * config.depth) / 1000000, // Convert to m²
    });
    panels.push({
      name: 'Bottom Panel',
      width: config.width,
      height: config.depth,
      thickness: bodyThickness,
      material_id: bodyMaterial.id,
      material_name: bodyMaterial.name,
      quantity: 1,
      edge_banding: ['front', 'left', 'right'],
      area: (config.width * config.depth) / 1000000,
    });

    // Left and right sides
    panels.push({
      name: 'Left Side',
      width: config.depth,
      height: config.height - 2 * bodyThickness,
      thickness: bodyThickness,
      material_id: bodyMaterial.id,
      material_name: bodyMaterial.name,
      quantity: 1,
      edge_banding: ['front', 'top', 'bottom'],
      area: (config.depth * (config.height - 2 * bodyThickness)) / 1000000,
    });
    panels.push({
      name: 'Right Side',
      width: config.depth,
      height: config.height - 2 * bodyThickness,
      thickness: bodyThickness,
      material_id: bodyMaterial.id,
      material_name: bodyMaterial.name,
      quantity: 1,
      edge_banding: ['front', 'top', 'bottom'],
      area: (config.depth * (config.height - 2 * bodyThickness)) / 1000000,
    });

    // Back panel
    panels.push({
      name: 'Back Panel',
      width: config.width - 2 * bodyThickness,
      height: config.height - 2 * bodyThickness,
      thickness: 8, // Back panels typically thinner
      material_id: bodyMaterial.id,
      material_name: bodyMaterial.name,
      quantity: 1,
      edge_banding: [],
      area: ((config.width - 2 * bodyThickness) * (config.height - 2 * bodyThickness)) / 1000000,
    });

    // Shelves and divisions from compartments
    config.compartments.forEach((compartment) => {
      compartment.modules.forEach((module) => {
        const material = module.material_id 
          ? this.materials.find(m => m.id === module.material_id)
          : shelfMaterial || bodyMaterial;

        if (module.type === 'horizontal_division' || module.type === 'shelf') {
          panels.push({
            name: `${module.type === 'shelf' ? 'Shelf' : 'Horizontal Division'} at ${module.position}mm`,
            width: compartment.width - 2 * bodyThickness,
            height: config.depth - bodyThickness,
            thickness: bodyThickness,
            material_id: material.id,
            material_name: material.name,
            quantity: 1,
            edge_banding: ['front'],
            area: ((compartment.width - 2 * bodyThickness) * (config.depth - bodyThickness)) / 1000000,
          });
        }

        if (module.type === 'vertical_division') {
          panels.push({
            name: `Vertical Division at ${module.position}mm`,
            width: config.depth - bodyThickness,
            height: compartment.height - 2 * bodyThickness,
            thickness: bodyThickness,
            material_id: material.id,
            material_name: material.name,
            quantity: 1,
            edge_banding: ['front'],
            area: ((config.depth - bodyThickness) * (compartment.height - 2 * bodyThickness)) / 1000000,
          });
        }

        if (module.type === 'drawer' && module.height) {
          // Drawer front
          panels.push({
            name: `Drawer Front at ${module.position}mm`,
            width: compartment.width - 4,
            height: module.height - 4,
            thickness: config.material_config.door_thickness || 18,
            material_id: config.material_config.door_material || bodyMaterial.id,
            material_name: this.materials.find(m => m.id === config.material_config.door_material)?.name || bodyMaterial.name,
            quantity: 1,
            edge_banding: ['all'],
            area: ((compartment.width - 4) * (module.height - 4)) / 1000000,
          });
        }
      });
    });

    return panels;
  }

  private calculateMaterialCost(panels: PanelCut[]): number {
    let totalCost = 0;

    panels.forEach((panel) => {
      const material = this.materials.find(m => m.id === panel.material_id);
      if (!material) return;

      const wasteFactor = material.waste_factor || 1.1;
      const areaWithWaste = panel.area * wasteFactor * panel.quantity;
      
      // Cost per m²
      totalCost += areaWithWaste * material.cost_per_unit;

      // Edge banding cost (estimate €2 per linear meter)
      const edgeBandingMeters = panel.edge_banding.reduce((sum, edge) => {
        if (edge === 'front' || edge === 'back') return sum + (panel.width / 1000);
        if (edge === 'left' || edge === 'right') return sum + (panel.height / 1000);
        if (edge === 'all') return sum + 2 * ((panel.width + panel.height) / 1000);
        return sum;
      }, 0);
      totalCost += edgeBandingMeters * 2 * panel.quantity;
    });

    return Math.round(totalCost * 100) / 100;
  }

  private calculateHardwareCost(config: CabinetConfiguration): number {
    let hardwareCost = 0;
    let drawerCount = 0;

    config.compartments.forEach((compartment) => {
      compartment.modules.forEach((module) => {
        if (module.type === 'drawer' && module.hardware_id) {
          const hardware = this.materials.find(m => m.id === module.hardware_id);
          if (hardware) {
            hardwareCost += hardware.cost_per_unit;
            drawerCount++;
          }
        }
      });
    });

    // Hinges for doors (estimate €3 per hinge, 2-3 hinges per door)
    if (config.door_type === 'hinged') {
      hardwareCost += 3 * 3; // 3 hinges per door
    }

    return Math.round(hardwareCost * 100) / 100;
  }

  private calculateLaborTime(config: CabinetConfiguration): number {
    // Base assembly time
    let minutes = 60; // 1 hour base

    // Add time per compartment
    minutes += config.compartments.length * 15;

    // Add time per module
    config.compartments.forEach((compartment) => {
      compartment.modules.forEach((module) => {
        if (module.type === 'drawer') {
          minutes += 30; // 30 min per drawer assembly
        } else if (module.type === 'horizontal_division' || module.type === 'vertical_division') {
          minutes += 10;
        } else if (module.type === 'shelf') {
          minutes += 5;
        }
      });
    });

    // Door installation
    if (config.door_type === 'hinged') {
      minutes += 20;
    } else if (config.door_type === 'sliding') {
      minutes += 30;
    }

    // Edge banding time (estimate based on panel count)
    minutes += 10 * config.compartments.length;

    return minutes;
  }
}
