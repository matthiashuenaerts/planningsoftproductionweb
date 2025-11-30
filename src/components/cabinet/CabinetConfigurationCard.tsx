import { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cabinet3DThumbnail } from './Cabinet3DThumbnail';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];

interface ModelHardware {
  id: string;
  product_id: string;
  product_name: string;
  quantity: string | number;
  unit_price: number;
}

interface LaborConfig {
  hourly_rate: number;
  base_minutes: number;
  per_panel_minutes: number;
  per_front_minutes: number;
  per_compartment_item_minutes: number;
}

interface CabinetConfigurationCardProps {
  config: CabinetConfiguration;
  modelParameters?: {
    panels?: any[];
    fronts?: any[];
    compartments?: any[];
    hardware?: ModelHardware[];
    laborConfig?: LaborConfig;
  };
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

export function CabinetConfigurationCard({ config, modelParameters, onEdit }: CabinetConfigurationCardProps) {
  const calculatedPrice = useMemo(() => {
    if (!modelParameters) return null;

    const variables = {
      width: config.width,
      height: config.height,
      depth: config.depth,
      body_thickness: 18,
      door_thickness: 18,
      shelf_thickness: 18,
      door_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'hinged_door').length || 0,
      drawer_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'drawer_front').length || 0,
    };

    // Calculate material areas (simplified - would need actual material prices)
    let materialCost = 0;
    const panels = modelParameters.panels || [];
    const fronts = modelParameters.fronts || [];
    const compartments = modelParameters.compartments || [];

    // Estimate material cost at €50/m² average
    const materialPricePerM2 = 50;
    
    panels.filter((p: any) => p.visible !== false).forEach((panel: any) => {
      const length = evaluateExpression(panel.length || 0, variables);
      const width = evaluateExpression(panel.width || 0, variables);
      materialCost += (length * width / 1000000) * materialPricePerM2;
    });

    fronts.filter((f: any) => f.visible !== false).forEach((front: any) => {
      const w = evaluateExpression(front.width || 0, variables);
      const h = evaluateExpression(front.height || 0, variables);
      const qty = front.quantity || 1;
      materialCost += (w * h * qty / 1000000) * materialPricePerM2;
    });

    // Hardware cost
    let hardwareCost = 0;
    (modelParameters.hardware || []).forEach((h: ModelHardware) => {
      const qty = evaluateExpression(h.quantity, variables);
      hardwareCost += Math.ceil(qty) * h.unit_price;
    });

    // Labor cost
    let laborCost = 0;
    const laborConfig = modelParameters.laborConfig;
    if (laborConfig) {
      const panelMinutes = panels.filter((p: any) => p.visible !== false).length * laborConfig.per_panel_minutes;
      const frontMinutes = fronts.filter((f: any) => f.visible !== false).reduce((sum: number, f: any) => 
        sum + ((f.quantity || 1) * laborConfig.per_front_minutes), 0);
      const compartmentItemMinutes = compartments.reduce((sum: number, c: any) => 
        sum + (c.items?.length || 0) * laborConfig.per_compartment_item_minutes, 0);
      
      const totalMinutes = laborConfig.base_minutes + panelMinutes + frontMinutes + compartmentItemMinutes;
      laborCost = (totalMinutes / 60) * laborConfig.hourly_rate;
    }

    return {
      material: materialCost,
      hardware: hardwareCost,
      labor: laborCost,
      total: materialCost + hardwareCost + laborCost,
    };
  }, [config, modelParameters]);

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
    hardware?: ModelHardware[];
    laborConfig?: LaborConfig;
  }
) {
  if (!modelParameters) return { material: 0, hardware: 0, labor: 0, total: 0 };

  const variables = {
    width: config.width,
    height: config.height,
    depth: config.depth,
    body_thickness: 18,
    door_thickness: 18,
    shelf_thickness: 18,
    door_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'hinged_door').length || 0,
    drawer_count: modelParameters.fronts?.filter((f: any) => f.front_type === 'drawer_front').length || 0,
  };

  let materialCost = 0;
  const materialPricePerM2 = 50;
  const panels = modelParameters.panels || [];
  const fronts = modelParameters.fronts || [];
  const compartments = modelParameters.compartments || [];

  panels.filter((p: any) => p.visible !== false).forEach((panel: any) => {
    const length = evaluateExpression(panel.length || 0, variables);
    const width = evaluateExpression(panel.width || 0, variables);
    materialCost += (length * width / 1000000) * materialPricePerM2;
  });

  fronts.filter((f: any) => f.visible !== false).forEach((front: any) => {
    const w = evaluateExpression(front.width || 0, variables);
    const h = evaluateExpression(front.height || 0, variables);
    const qty = front.quantity || 1;
    materialCost += (w * h * qty / 1000000) * materialPricePerM2;
  });

  let hardwareCost = 0;
  (modelParameters.hardware || []).forEach((h: ModelHardware) => {
    const qty = evaluateExpression(h.quantity, variables);
    hardwareCost += Math.ceil(qty) * h.unit_price;
  });

  let laborCost = 0;
  const laborConfig = modelParameters.laborConfig;
  if (laborConfig) {
    const panelMinutes = panels.filter((p: any) => p.visible !== false).length * laborConfig.per_panel_minutes;
    const frontMinutes = fronts.filter((f: any) => f.visible !== false).reduce((sum: number, f: any) => 
      sum + ((f.quantity || 1) * laborConfig.per_front_minutes), 0);
    const compartmentItemMinutes = compartments.reduce((sum: number, c: any) => 
      sum + (c.items?.length || 0) * laborConfig.per_compartment_item_minutes, 0);
    
    const totalMinutes = laborConfig.base_minutes + panelMinutes + frontMinutes + compartmentItemMinutes;
    laborCost = (totalMinutes / 60) * laborConfig.hourly_rate;
  }

  return {
    material: materialCost,
    hardware: hardwareCost,
    labor: laborCost,
    total: materialCost + hardwareCost + laborCost,
  };
}
