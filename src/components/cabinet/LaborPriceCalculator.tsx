import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { v4 as uuidv4 } from 'uuid';

export interface LaborLine {
  id: string;
  name: string;
  formula: string; // e.g., "panels * 5" or "fronts * 15"
  unit: 'minutes' | 'euros';
}

export interface LaborConfig {
  hourly_rate: number;
  lines?: LaborLine[];
  // Legacy fields for backwards compatibility
  base_minutes?: number;
  per_panel_minutes?: number;
  per_front_minutes?: number;
  per_compartment_item_minutes?: number;
}

interface LaborPriceCalculatorProps {
  config: LaborConfig;
  onChange: (config: LaborConfig) => void;
}

const AVAILABLE_VARIABLES = [
  { name: 'panels', description: 'Number of visible panels' },
  { name: 'total_panels', description: 'Total panel count (visible + hidden)' },
  { name: 'interior_panels', description: 'Interior panels (shelves, dividers)' },
  { name: 'fronts', description: 'Number of visible fronts' },
  { name: 'compartment_items', description: 'Number of compartment items' },
  { name: 'total_edges', description: 'Total edge length in meters' },
  { name: 'body_area', description: 'Body material area in m²' },
  { name: 'door_area', description: 'Door/front material area in m²' },
  { name: 'shelf_area', description: 'Shelf material area in m²' },
  { name: 'total_area', description: 'Total material area in m²' },
  { name: 'door_count', description: 'Number of hinged doors' },
  { name: 'drawer_count', description: 'Number of drawer fronts' },
  { name: 'hardware_count', description: 'Total hardware items' },
  { name: 'width', description: 'Cabinet width in mm' },
  { name: 'height', description: 'Cabinet height in mm' },
  { name: 'depth', description: 'Cabinet depth in mm' },
  { name: 'volume', description: 'Cabinet volume in m³' },
  { name: 'front_area', description: 'Total front area in m²' },
];

const DEFAULT_LINES: LaborLine[] = [
  { id: uuidv4(), name: 'Base Assembly', formula: '30', unit: 'minutes' },
  { id: uuidv4(), name: 'Panel Work', formula: 'panels * 5', unit: 'minutes' },
  { id: uuidv4(), name: 'Front Installation', formula: 'fronts * 15', unit: 'minutes' },
  { id: uuidv4(), name: 'Interior Items', formula: 'compartment_items * 10', unit: 'minutes' },
];

export function LaborPriceCalculator({ config, onChange }: LaborPriceCalculatorProps) {
  const [showVariables, setShowVariables] = useState(false);

  // Migrate legacy config to new format
  const lines: LaborLine[] = config.lines || migrateFromLegacy(config);

  const handleRateChange = (value: number) => {
    onChange({ ...config, hourly_rate: value, lines });
  };

  const addLine = () => {
    const newLine: LaborLine = {
      id: uuidv4(),
      name: 'New Line',
      formula: '0',
      unit: 'minutes',
    };
    onChange({ ...config, lines: [...lines, newLine] });
  };

  const updateLine = (id: string, updates: Partial<LaborLine>) => {
    onChange({
      ...config,
      lines: lines.map(l => l.id === id ? { ...l, ...updates } : l),
    });
  };

  const deleteLine = (id: string) => {
    onChange({ ...config, lines: lines.filter(l => l.id !== id) });
  };

  const resetToDefaults = () => {
    onChange({ ...config, lines: DEFAULT_LINES.map(l => ({ ...l, id: uuidv4() })) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Labor & Cost Settings</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowVariables(!showVariables)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p>Define calculation lines using formulas with cabinet variables.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hourly Rate */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Hourly Rate (€)</Label>
            <span className="text-sm font-medium">€{config.hourly_rate}</span>
          </div>
          <Input
            type="number"
            value={config.hourly_rate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            min={0}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Used to convert minutes to cost
          </p>
        </div>

        {/* Available Variables Reference */}
        {showVariables && (
          <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
            <p className="font-semibold mb-2">Available Variables:</p>
            <div className="grid grid-cols-2 gap-1">
              {AVAILABLE_VARIABLES.map(v => (
                <div key={v.name} className="flex justify-between">
                  <code className="text-primary">{v.name}</code>
                  <span className="text-muted-foreground">{v.description}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-muted-foreground">
              Example formulas: <code>panels * 3.5</code>, <code>total_area * 10</code>, <code>fronts * 15 + 30</code>
            </p>
          </div>
        )}

        {/* Calculation Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Calculation Lines</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                Reset
              </Button>
              <Button size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={line.name}
                    onChange={(e) => updateLine(line.id, { name: e.target.value })}
                    placeholder="Line name"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteLine(line.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={line.formula}
                    onChange={(e) => updateLine(line.id, { formula: e.target.value })}
                    placeholder="e.g., panels * 5"
                    className="flex-1 font-mono text-sm"
                  />
                  <select
                    value={line.unit}
                    onChange={(e) => updateLine(line.id, { unit: e.target.value as 'minutes' | 'euros' })}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="minutes">min</option>
                    <option value="euros">€</option>
                  </select>
                </div>
              </div>
            ))}

            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No calculation lines. Click "Add Line" or "Reset" to add defaults.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to migrate legacy config to new format
function migrateFromLegacy(config: LaborConfig): LaborLine[] {
  const lines: LaborLine[] = [];
  
  if (config.base_minutes) {
    lines.push({ id: uuidv4(), name: 'Base Assembly', formula: String(config.base_minutes), unit: 'minutes' });
  }
  if (config.per_panel_minutes) {
    lines.push({ id: uuidv4(), name: 'Panel Work', formula: `panels * ${config.per_panel_minutes}`, unit: 'minutes' });
  }
  if (config.per_front_minutes) {
    lines.push({ id: uuidv4(), name: 'Front Installation', formula: `fronts * ${config.per_front_minutes}`, unit: 'minutes' });
  }
  if (config.per_compartment_item_minutes) {
    lines.push({ id: uuidv4(), name: 'Interior Items', formula: `compartment_items * ${config.per_compartment_item_minutes}`, unit: 'minutes' });
  }
  
  return lines.length > 0 ? lines : DEFAULT_LINES.map(l => ({ ...l, id: uuidv4() }));
}

// Export evaluation helper for use in calculation
export function evaluateLaborFormula(
  formula: string,
  variables: Record<string, number>
): number {
  let evaluated = formula;
  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
  
  sortedKeys.forEach((key) => {
    evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), String(variables[key]));
  });
  
  try {
    const result = Function(`"use strict"; return (${evaluated})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (e) {
    return 0;
  }
}
