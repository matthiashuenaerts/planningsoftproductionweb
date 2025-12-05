import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { calculateConfigurationPrice } from './CabinetConfigurationCard';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];

interface ModelParameters {
  panels?: any[];
  fronts?: any[];
  compartments?: any[];
  hardware?: any[];
  laborConfig?: any;
  frontHardware?: any[];
}

interface ProjectModel {
  id: string;
  body_material_id?: string;
  door_material_id?: string;
  shelf_material_id?: string;
}

interface ProjectPricingSummaryProps {
  configurations: CabinetConfiguration[];
  modelParametersMap: Record<string, ModelParameters>;
  materials: Array<{ id: string; cost_per_unit: number }>;
  currency?: string;
  projectModelsMap?: Record<string, ProjectModel>;
}

export function ProjectPricingSummary({ 
  configurations, 
  modelParametersMap,
  materials,
  currency = 'EUR',
  projectModelsMap = {}
}: ProjectPricingSummaryProps) {
  const summary = useMemo(() => {
    const cabinetPrices = configurations.map(config => {
      const modelParams = config.model_id ? modelParametersMap[config.model_id] : undefined;
      const projectModel = config.project_model_id ? projectModelsMap[config.project_model_id] : undefined;
      const price = calculateConfigurationPrice(config, modelParams, materials, projectModel);
      return {
        config,
        price,
      };
    });

    const totals = cabinetPrices.reduce(
      (acc, { price }) => ({
        material: acc.material + price.material,
        hardware: acc.hardware + price.hardware,
        labor: acc.labor + price.labor,
        overhead: acc.overhead + price.overhead,
        total: acc.total + price.total,
      }),
      { material: 0, hardware: 0, labor: 0, overhead: 0, total: 0 }
    );

    // Collect all unique hardware items across all models (including front hardware)
    const hardwareItems: Record<string, { name: string; quantity: number; unitPrice: number; total: number }> = {};
    
    configurations.forEach(config => {
      const modelParams = config.model_id ? modelParametersMap[config.model_id] : undefined;
      if (!modelParams) return;

      const variables = {
        width: config.width,
        height: config.height,
        depth: config.depth,
        body_thickness: 18,
        door_thickness: 18,
        shelf_thickness: 18,
        door_count: modelParams.fronts?.filter((f: any) => f.front_type === 'hinged_door').length || 0,
        drawer_count: modelParams.fronts?.filter((f: any) => f.front_type === 'drawer_front').length || 0,
      };

      // Model-level hardware
      modelParams.hardware?.forEach((h: any) => {
        let qty: number;
        if (typeof h.quantity === 'number') {
          qty = h.quantity;
        } else {
          let evaluated = String(h.quantity);
          Object.keys(variables).sort((a, b) => b.length - a.length).forEach(key => {
            evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), String((variables as any)[key]));
          });
          try {
            qty = Function(`"use strict"; return (${evaluated})`)();
          } catch {
            qty = 0;
          }
        }
        qty = Math.ceil(qty);

        const key = h.product_id || h.product_name;
        if (hardwareItems[key]) {
          hardwareItems[key].quantity += qty;
          hardwareItems[key].total += qty * h.unit_price;
        } else {
          hardwareItems[key] = {
            name: h.product_name,
            quantity: qty,
            unitPrice: h.unit_price,
            total: qty * h.unit_price,
          };
        }
      });

      // Front-level hardware
      modelParams.frontHardware?.forEach((fh: any) => {
        const productData = fh.products;
        const unitPrice = productData?.price_per_unit || productData?.price || 0;
        if (productData && unitPrice > 0) {
          const qty = fh.quantity || 1;
          const key = productData.id || productData.name;
          
          if (hardwareItems[key]) {
            hardwareItems[key].quantity += qty;
            hardwareItems[key].total += qty * unitPrice;
          } else {
            hardwareItems[key] = {
              name: productData.name,
              quantity: qty,
              unitPrice: unitPrice,
              total: qty * unitPrice,
            };
          }
        }
      });
    });

    return {
      cabinetPrices,
      totals,
      hardwareItems: Object.values(hardwareItems),
    };
  }, [configurations, modelParametersMap, materials]);

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;

  if (configurations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cabinet List */}
        <div>
          <h4 className="font-medium mb-3">Cabinets ({configurations.length})</h4>
          <div className="space-y-2">
            {summary.cabinetPrices.map(({ config, price }) => (
              <div key={config.id} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
                <div>
                  <span className="font-medium">{config.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {config.width} × {config.height} × {config.depth} mm
                  </span>
                </div>
                <Badge variant="outline">{currencySymbol}{price.total.toFixed(2)}</Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Hardware Summary */}
        {summary.hardwareItems.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Hardware Summary</h4>
            <div className="space-y-1">
              {summary.hardwareItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                  </span>
                  <span>{currencySymbol}{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.hardwareItems.length > 0 && <Separator />}

        {/* Cost Breakdown */}
        <div>
          <h4 className="font-medium mb-3">Cost Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Materials</span>
              <span>{currencySymbol}{summary.totals.material.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hardware</span>
              <span>{currencySymbol}{summary.totals.hardware.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Labor</span>
              <span>{currencySymbol}{summary.totals.labor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overhead (15%)</span>
              <span>{currencySymbol}{summary.totals.overhead.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Project Total</span>
          <span className="text-primary">{currencySymbol}{summary.totals.total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
