import { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ParametricPanel } from '@/types/cabinet';
import { ModelHardware } from './ModelHardwareManager';
import { LaborConfig, evaluateLaborFormula } from './LaborPriceCalculator';
import { supabase } from '@/integrations/supabase/client';

interface FrontHardware {
  id: string;
  hardware_type: string;
  product_id?: string;
  quantity: number;
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
  hardware?: FrontHardware[];
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
  laborConfig: LaborConfig;
}

interface Product {
  id: string;
  name: string;
  price_per_unit: number;
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
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price_per_unit');
      if (data) setProducts(data);
    };
    loadProducts();
  }, []);

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

  // Calculate total edges (perimeter of all panels and fronts in meters)
  const totalEdges = useMemo(() => {
    let edges = 0;
    
    panels.filter(p => p.visible).forEach((panel) => {
      const length = evaluateExpression(panel.length, variables);
      const width = evaluateExpression(panel.width, variables);
      edges += 2 * (length + width) / 1000; // Convert mm to m
    });

    fronts.filter(f => f.visible).forEach((front) => {
      const w = evaluateExpression(front.width, variables);
      const h = evaluateExpression(front.height, variables);
      edges += (2 * (w + h) * front.quantity) / 1000;
    });

    return edges;
  }, [panels, fronts, variables]);

  // Model hardware list
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

  // Front hardware list (from doors/fronts)
  const frontHardwareList = useMemo(() => {
    const items: Array<{
      id: string;
      frontName: string;
      hardwareType: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    fronts.forEach((front) => {
      if (!front.hardware) return;
      
      front.hardware.forEach((hw) => {
        const product = products.find(p => p.id === hw.product_id);
        const totalQty = hw.quantity * front.quantity;
        items.push({
          id: hw.id,
          frontName: front.name,
          hardwareType: hw.hardware_type,
          productName: product?.name || 'Unknown',
          quantity: totalQty,
          unitPrice: product?.price_per_unit || 0,
          totalPrice: totalQty * (product?.price_per_unit || 0),
        });
      });
    });

    return items;
  }, [fronts, products]);

  const totalModelHardwareCost = hardwareList.reduce((sum, h) => sum + h.totalPrice, 0);
  const totalFrontHardwareCost = frontHardwareList.reduce((sum, h) => sum + h.totalPrice, 0);
  const totalHardwareCost = totalModelHardwareCost + totalFrontHardwareCost;

  const compartmentItemCount = compartments.reduce((sum, c) => sum + c.items.length, 0);
  const totalHardwareCount = hardwareList.reduce((sum, h) => sum + h.calculatedQty, 0) + 
    frontHardwareList.reduce((sum, h) => sum + h.quantity, 0);

  // Build full variables for labor calculation
  const laborVariables = useMemo(() => ({
    ...variables,
    panels: panels.filter(p => p.visible).length,
    fronts: fronts.filter(f => f.visible).reduce((sum, f) => sum + f.quantity, 0),
    compartment_items: compartmentItemCount,
    total_edges: totalEdges,
    body_area: materialAreas.body,
    door_area: materialAreas.door,
    shelf_area: materialAreas.shelf,
    total_area: materialAreas.body + materialAreas.door + materialAreas.shelf,
    hardware_count: totalHardwareCount,
  }), [variables, panels, fronts, compartmentItemCount, totalEdges, materialAreas, totalHardwareCount]);

  // Calculate labor using new formula-based system
  const laborCalculation = useMemo(() => {
    const lines = laborConfig.lines || [];
    let totalMinutes = 0;
    let totalEuros = 0;

    const lineResults = lines.map((line) => {
      const value = evaluateLaborFormula(line.formula, laborVariables);
      if (line.unit === 'minutes') {
        totalMinutes += value;
      } else {
        totalEuros += value;
      }
      return { ...line, calculatedValue: value };
    });

    const laborCostFromMinutes = (totalMinutes / 60) * laborConfig.hourly_rate;
    const totalLaborCost = laborCostFromMinutes + totalEuros;

    return {
      lineResults,
      totalMinutes,
      totalEuros,
      laborCostFromMinutes,
      totalLaborCost,
    };
  }, [laborConfig, laborVariables]);

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
          <div className="flex justify-between items-center">
            <span>Total Edges</span>
            <Badge variant="outline">{totalEdges.toFixed(2)} m</Badge>
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

      {/* Model Hardware */}
      <Card>
        <CardHeader>
          <CardTitle>Model Hardware</CardTitle>
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
                <span>Model Hardware Total</span>
                <span>€{totalModelHardwareCost.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No model-level hardware attached
            </p>
          )}
        </CardContent>
      </Card>

      {/* Front Hardware */}
      <Card>
        <CardHeader>
          <CardTitle>Front Hardware</CardTitle>
        </CardHeader>
        <CardContent>
          {frontHardwareList.length > 0 ? (
            <div className="space-y-3">
              {frontHardwareList.map((h) => (
                <div key={h.id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{h.productName}</span>
                    <span className="text-muted-foreground ml-2">
                      ({h.frontName}, {h.hardwareType})
                    </span>
                    <span className="text-muted-foreground ml-1">× {h.quantity}</span>
                  </div>
                  <span>€{h.totalPrice.toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center font-semibold">
                <span>Front Hardware Total</span>
                <span>€{totalFrontHardwareCost.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No front hardware assigned. Add hardware to doors/fronts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Labor Calculation */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Labor & Cost Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Line breakdown */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm mb-3">Calculation Lines</h4>
              {laborCalculation.lineResults.map((line) => (
                <div key={line.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{line.name}:</span>
                  <span>
                    {line.calculatedValue.toFixed(1)} {line.unit === 'minutes' ? 'min' : '€'}
                  </span>
                </div>
              ))}
              {laborCalculation.lineResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No calculation lines defined.</p>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm mb-3">Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Time:</span>
                <span>{laborCalculation.totalMinutes.toFixed(0)} min ({(laborCalculation.totalMinutes / 60).toFixed(1)} hrs)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Labor Cost (@ €{laborConfig.hourly_rate}/hr):</span>
                <span>€{laborCalculation.laborCostFromMinutes.toFixed(2)}</span>
              </div>
              {laborCalculation.totalEuros > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Direct Costs:</span>
                  <span>€{laborCalculation.totalEuros.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Labor Cost:</span>
                <span>€{laborCalculation.totalLaborCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <Separator className="my-4" />
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total Hardware Cost:</span>
            <span className="text-primary">€{totalHardwareCost.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
