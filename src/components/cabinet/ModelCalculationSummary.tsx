import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ParametricPanel } from '@/types/cabinet';
import { ModelHardware } from './ModelHardwareManager';

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

interface Compartment {
  id: string;
  name: string;
  width: string;
  height: string;
  depth: string;
  items: any[];
}

interface ModelCalculationSummaryProps {
  modelData: {
    name: string;
    category: string;
    default_width: number;
    default_height: number;
    default_depth: number;
  };
  panels: ParametricPanel[];
  fronts: CabinetFront[];
  compartments: Compartment[];
  hardware: ModelHardware[];
  laborConfig: {
    base_minutes: number;
    per_panel_minutes: number;
    per_front_minutes: number;
    per_compartment_item_minutes: number;
    hourly_rate: number;
  };
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

export function ModelCalculationSummary({
  modelData,
  panels,
  fronts,
  compartments,
  hardware,
  laborConfig,
}: ModelCalculationSummaryProps) {
  const variables = useMemo(() => ({
    width: modelData.default_width,
    height: modelData.default_height,
    depth: modelData.default_depth,
    body_thickness: 18,
    door_thickness: 18,
    shelf_thickness: 18,
    door_count: fronts.filter(f => f.front_type === 'hinged_door').length,
    drawer_count: fronts.filter(f => f.front_type === 'drawer_front').length,
  }), [modelData, fronts]);

  const materialAreas = useMemo(() => {
    const areas = {
      body: 0,
      door: 0,
      shelf: 0,
    };

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
      const area = (w * h * front.quantity) / 1000000;
      areas.door += area;
    });

    // Calculate compartment item areas
    compartments.forEach((comp) => {
      const compW = evaluateExpression(comp.width, variables);
      const compD = evaluateExpression(comp.depth, variables);
      
      comp.items.forEach((item) => {
        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const area = (compW * compD * item.quantity) / 1000000;
          areas.shelf += area;
        } else if (item.item_type === 'vertical_divider') {
          const compH = evaluateExpression(comp.height, variables);
          const area = (compH * compD) / 1000000;
          areas.body += area;
        }
      });
    });

    return areas;
  }, [panels, fronts, compartments, variables]);

  const hardwareList = useMemo(() => {
    return hardware.map((h) => {
      const qty = evaluateExpression(h.quantity, variables);
      return {
        ...h,
        calculatedQty: Math.ceil(qty),
        totalPrice: Math.ceil(qty) * h.unit_price,
      };
    });
  }, [hardware, variables]);

  const totalHardwareCost = hardwareList.reduce((sum, h) => sum + h.totalPrice, 0);

  const laborCalculation = useMemo(() => {
    const panelMinutes = panels.filter(p => p.visible).length * laborConfig.per_panel_minutes;
    const frontMinutes = fronts.filter(f => f.visible).reduce((sum, f) => 
      sum + (f.quantity * laborConfig.per_front_minutes), 0);
    const compartmentItemMinutes = compartments.reduce((sum, c) => 
      sum + c.items.length * laborConfig.per_compartment_item_minutes, 0);
    
    const totalMinutes = laborConfig.base_minutes + panelMinutes + frontMinutes + compartmentItemMinutes;
    const laborCost = (totalMinutes / 60) * laborConfig.hourly_rate;

    return {
      baseMinutes: laborConfig.base_minutes,
      panelMinutes,
      frontMinutes,
      compartmentItemMinutes,
      totalMinutes,
      laborCost,
    };
  }, [panels, fronts, compartments, laborConfig]);

  const compartmentItemCount = compartments.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Material Areas */}
      <Card>
        <CardHeader>
          <CardTitle>Material Areas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span>Body Material</span>
            <Badge variant="secondary">{materialAreas.body.toFixed(3)} m²</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span>Door/Front Material</span>
            <Badge variant="secondary">{materialAreas.door.toFixed(3)} m²</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span>Shelf Material</span>
            <Badge variant="secondary">{materialAreas.shelf.toFixed(3)} m²</Badge>
          </div>
          <Separator />
          <div className="flex justify-between items-center font-semibold">
            <span>Total Material Area</span>
            <Badge>{(materialAreas.body + materialAreas.door + materialAreas.shelf).toFixed(3)} m²</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cabinet Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Cabinet Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{modelData.name || 'Unnamed'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>
              <p className="font-medium">{modelData.category}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Dimensions:</span>
              <p className="font-medium">
                {modelData.default_width} × {modelData.default_height} × {modelData.default_depth} mm
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Panels:</span>
              <p className="font-medium">{panels.filter(p => p.visible).length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Doors/Fronts:</span>
              <p className="font-medium">{fronts.filter(f => f.visible).length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Compartments:</span>
              <p className="font-medium">{compartments.length} ({compartmentItemCount} items)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hardware List */}
      <Card>
        <CardHeader>
          <CardTitle>Hardware Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {hardwareList.length > 0 ? (
            <div className="space-y-3">
              {hardwareList.map((h) => (
                <div key={h.id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{h.product_name || 'Unknown'}</span>
                    <span className="text-muted-foreground ml-2">× {h.calculatedQty}</span>
                  </div>
                  <span>€{h.totalPrice.toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center font-semibold">
                <span>Total Hardware Cost</span>
                <span>€{totalHardwareCost.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hardware attached to this model
            </p>
          )}
        </CardContent>
      </Card>

      {/* Labor Calculation */}
      <Card>
        <CardHeader>
          <CardTitle>Labor Estimate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base assembly:</span>
              <span>{laborCalculation.baseMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Panel work ({panels.filter(p => p.visible).length} panels):</span>
              <span>{laborCalculation.panelMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Front installation ({fronts.filter(f => f.visible).length} fronts):</span>
              <span>{laborCalculation.frontMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interior items ({compartmentItemCount} items):</span>
              <span>{laborCalculation.compartmentItemMinutes} min</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Total Time:</span>
              <span>{laborCalculation.totalMinutes} min ({(laborCalculation.totalMinutes / 60).toFixed(1)} hrs)</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Labor Cost (@ €{laborConfig.hourly_rate}/hr):</span>
              <span>€{laborCalculation.laborCost.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
