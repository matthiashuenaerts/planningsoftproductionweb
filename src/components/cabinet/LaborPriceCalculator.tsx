import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export interface LaborConfig {
  base_minutes: number;
  per_panel_minutes: number;
  per_front_minutes: number;
  per_compartment_item_minutes: number;
  hourly_rate: number;
}

interface LaborPriceCalculatorProps {
  config: LaborConfig;
  onChange: (config: LaborConfig) => void;
}

export function LaborPriceCalculator({ config, onChange }: LaborPriceCalculatorProps) {
  const handleChange = (field: keyof LaborConfig, value: number) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Labor Price Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Hourly Rate (€)</Label>
            <span className="text-sm font-medium">€{config.hourly_rate}</span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[config.hourly_rate]}
              onValueChange={([value]) => handleChange('hourly_rate', value)}
              min={20}
              max={150}
              step={5}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.hourly_rate}
              onChange={(e) => handleChange('hourly_rate', Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Base Assembly Time (min)</Label>
            <span className="text-sm font-medium">{config.base_minutes} min</span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[config.base_minutes]}
              onValueChange={([value]) => handleChange('base_minutes', value)}
              min={0}
              max={120}
              step={5}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.base_minutes}
              onChange={(e) => handleChange('base_minutes', Number(e.target.value))}
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Fixed time for cabinet base assembly regardless of complexity
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Per Panel (min)</Label>
            <span className="text-sm font-medium">{config.per_panel_minutes} min</span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[config.per_panel_minutes]}
              onValueChange={([value]) => handleChange('per_panel_minutes', value)}
              min={0}
              max={30}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.per_panel_minutes}
              onChange={(e) => handleChange('per_panel_minutes', Number(e.target.value))}
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Time per panel (cutting, drilling, edging)
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Per Door/Front (min)</Label>
            <span className="text-sm font-medium">{config.per_front_minutes} min</span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[config.per_front_minutes]}
              onValueChange={([value]) => handleChange('per_front_minutes', value)}
              min={0}
              max={45}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.per_front_minutes}
              onChange={(e) => handleChange('per_front_minutes', Number(e.target.value))}
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Time per door/drawer front (including hardware installation)
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Per Interior Item (min)</Label>
            <span className="text-sm font-medium">{config.per_compartment_item_minutes} min</span>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[config.per_compartment_item_minutes]}
              onValueChange={([value]) => handleChange('per_compartment_item_minutes', value)}
              min={0}
              max={30}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.per_compartment_item_minutes}
              onChange={(e) => handleChange('per_compartment_item_minutes', Number(e.target.value))}
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Time per shelf, divider, or drawer system installation
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
