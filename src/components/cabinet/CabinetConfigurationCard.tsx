import { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cabinet3DThumbnail } from './Cabinet3DThumbnail';
import { LaborConfig, LaborLine, evaluateLaborFormula } from './LaborPriceCalculator';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];

interface ModelHardware {
  id: string;
  product_id: string;
  product_name: string;
  quantity: string | number;
  unit_price: number;
}

interface CabinetConfigurationCardProps {
  config: CabinetConfiguration;
  modelParameters?: {
    panels?: any[];
    fronts?: any[];
    compartments?: any[];
    parametric_compartments?: any[];
    hardware?: ModelHardware[];
    frontHardware?: any[];
    laborConfig?: LaborConfig;
  };
  materials?: Array<{ id: string; cost_per_unit: number }>;
  onEdit: () => void;
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

export function CabinetConfigurationCard({ config, modelParameters, materials = [], onEdit }: CabinetConfigurationCardProps) {
  const calculatedPrice = useMemo(() => {
    return calculateConfigurationPrice(config, modelParameters, materials);
  }, [config, modelParameters, materials]);

  return (
    <Card className="hover:bg-accent/50 transition-colors overflow-hidden">
      {/* 3D preview */}
      <div className="h-36 bg-gradient-to-br from-muted to-muted/50 relative">
        <Cabinet3DThumbnail
          width={config.width}
          height={config.height}
          depth={config.depth}
          panels={modelParameters?.panels}
          fronts={modelParameters?.fronts}
          doorType={config.door_type || 'hinged'}
        />
        <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
          {config.width} × {config.height}
        </Badge>
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{config.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">
          Dimensions: {config.width} × {config.height} × {config.depth} mm
        </div>
        <div className="text-sm text-muted-foreground">
          Door: {config.door_type || 'None'}
        </div>
        <div className="text-sm text-muted-foreground">
          Finish: {config.finish || 'Standard'}
        </div>
        
        {calculatedPrice && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Material:</span>
              <span>€{calculatedPrice.material.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hardware:</span>
              <span>€{calculatedPrice.hardware.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Labor:</span>
              <span>€{calculatedPrice.labor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold mt-1 pt-1 border-t">
              <span>Total:</span>
              <span className="text-primary">€{calculatedPrice.total.toFixed(2)}</span>
            </div>
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2"
          onClick={onEdit}
        >
          <Pencil className="mr-2 h-3 w-3" />
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}

export function calculateConfigurationPrice(
  config: CabinetConfiguration,
  modelParameters?: {
    panels?: any[];
    fronts?: any[];
    compartments?: any[];
    parametric_compartments?: any[];
    hardware?: ModelHardware[];
    frontHardware?: any[];
    laborConfig?: LaborConfig;
  },
  materials?: Array<{ id: string; cost_per_unit: number }>
) {
  if (!modelParameters) return { material: 0, hardware: 0, labor: 0, overhead: 0, total: 0 };

  const variables = {
    width: config.width,
    height: config.height,
    depth: config.depth,
    body_thickness: (config.material_config as any)?.body_thickness || 18,
    door_thickness: (config.material_config as any)?.door_thickness || 18,
    shelf_thickness: (config.material_config as any)?.shelf_thickness || 18,
    door_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'hinged_door').length || 0,
    drawer_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'drawer_front').length || 0,
  };

  const areas = { body: 0, door: 0, shelf: 0 };
  const panels = modelParameters.panels || [];
  const fronts = modelParameters.fronts || [];
  const compartments = modelParameters.parametric_compartments || modelParameters.compartments || [];

  panels.filter((p: any) => p.visible !== false).forEach((panel: any) => {
    const length = evaluateExpression(panel.length || 0, variables);
    const width = evaluateExpression(panel.width || 0, variables);
    const area = (length * width) / 1000000;
    if (panel.material_type === 'door') areas.door += area;
    else if (panel.material_type === 'shelf') areas.shelf += area;
    else areas.body += area;
  });

  fronts.filter((f: any) => f.visible !== false).forEach((front: any) => {
    const w = evaluateExpression(front.width || 0, variables);
    const h = evaluateExpression(front.height || 0, variables);
    const qty = front.quantity || 1;
    areas.door += (w * h * qty) / 1000000;
  });

  compartments.forEach((c: any) => {
    const cW = evaluateExpression(c.width || 0, variables);
    const cD = evaluateExpression(c.depth || 0, variables);
    const cH = evaluateExpression(c.height || 0, variables);
    (c.items || []).forEach((i: any) => {
      const qty = i.quantity || 1;
      if (i.item_type === 'shelf' || i.item_type === 'horizontal_divider') areas.shelf += (cW * cD * qty) / 1000000;
      else if (i.item_type === 'vertical_divider') areas.body += (cH * cD) / 1000000;
    });
  });

  const matCfg = config.material_config as any;
  const wasteFactor = 1.1;
  const defaultPrice = 50;
  let materialCost = 0;

  if (materials?.length) {
    materialCost += areas.body * wasteFactor * (materials.find(m => m.id === matCfg?.body_material)?.cost_per_unit || defaultPrice);
    materialCost += areas.door * wasteFactor * (materials.find(m => m.id === matCfg?.door_material)?.cost_per_unit || defaultPrice);
    materialCost += areas.shelf * wasteFactor * (materials.find(m => m.id === matCfg?.shelf_material)?.cost_per_unit || defaultPrice);
  } else {
    materialCost = (areas.body + areas.door + areas.shelf) * wasteFactor * defaultPrice;
  }
  materialCost += (areas.body + areas.door + areas.shelf) * 4 * 2; // Edge banding

  // Calculate hardware cost (model hardware + front hardware)
  let hardwareCost = 0;
  
  // Model-level hardware
  (modelParameters.hardware || []).forEach((h: ModelHardware) => {
    const qty = evaluateExpression(h.quantity, variables);
    hardwareCost += Math.ceil(qty) * h.unit_price;
  });
  
  // Front-level hardware
  (modelParameters.frontHardware || []).forEach((fh: any) => {
    const productData = fh.products;
    if (productData && productData.price) {
      const qty = fh.quantity || 1;
      hardwareCost += qty * productData.price;
    }
  });

  let laborCost = 0;
  const laborConfig = modelParameters.laborConfig;
  if (laborConfig) {
    const visiblePanels = panels.filter((p: any) => p.visible !== false);
    const visibleFronts = fronts.filter((f: any) => f.visible !== false);
    const totalFronts = visibleFronts.reduce((sum: number, f: any) => sum + (f.quantity || 1), 0);
    const compartmentItemCount = compartments.reduce((sum: number, c: any) => sum + (c.items?.length || 0), 0);
    
    // Calculate areas and edges for labor variables
    const totalArea = areas.body + areas.door + areas.shelf;
    let totalEdges = 0;
    visiblePanels.forEach((panel: any) => {
      const length = evaluateExpression(panel.length || 0, variables);
      const width = evaluateExpression(panel.width || 0, variables);
      totalEdges += 2 * (length + width) / 1000;
    });
    visibleFronts.forEach((front: any) => {
      const w = evaluateExpression(front.width || 0, variables);
      const h = evaluateExpression(front.height || 0, variables);
      totalEdges += (2 * (w + h) * (front.quantity || 1)) / 1000;
    });

    // Build full labor variables
    const laborVariables: Record<string, number> = {
      ...variables,
      panels: visiblePanels.length,
      total_panels: panels.length,
      interior_panels: compartmentItemCount,
      fronts: totalFronts,
      compartment_items: compartmentItemCount,
      total_edges: totalEdges,
      body_area: areas.body,
      door_area: areas.door,
      shelf_area: areas.shelf,
      total_area: totalArea,
      front_area: areas.door,
      hardware_count: Math.ceil((modelParameters.hardware || []).reduce((sum: number, h: any) => 
        sum + evaluateExpression(h.quantity, variables), 0)),
      volume: (config.width * config.height * config.depth) / 1000000000,
    };

    // Use new formula-based calculation if lines exist
    if (laborConfig.lines && laborConfig.lines.length > 0) {
      let totalMinutes = 0;
      let totalEuros = 0;
      
      laborConfig.lines.forEach((line: LaborLine) => {
        const value = evaluateLaborFormula(line.formula, laborVariables);
        if (line.unit === 'minutes') {
          totalMinutes += value;
        } else {
          totalEuros += value;
        }
      });
      
      laborCost = (totalMinutes / 60) * laborConfig.hourly_rate + totalEuros;
    } else {
      // Fallback to legacy calculation
      const panelMinutes = visiblePanels.length * (laborConfig.per_panel_minutes || 0);
      const frontMinutes = totalFronts * (laborConfig.per_front_minutes || 0);
      const compartmentItemMinutes = compartmentItemCount * (laborConfig.per_compartment_item_minutes || 0);
      const totalMinutes = (laborConfig.base_minutes || 0) + panelMinutes + frontMinutes + compartmentItemMinutes;
      laborCost = (totalMinutes / 60) * laborConfig.hourly_rate;
    }
  }

  const subtotal = materialCost + hardwareCost + laborCost;
  const overhead = subtotal * 0.15; // 15% overhead

  return {
    material: materialCost,
    hardware: hardwareCost,
    labor: laborCost,
    overhead: overhead,
    total: subtotal + overhead,
  };
}
