import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

interface FrontHardware {
  id: string;
  hardware_type: 'hinge' | 'damper' | 'runner' | 'handle' | 'other';
  product_id?: string;
  quantity: number;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
  article_code: string | null;
  price_per_unit: number;
}

interface FrontHardwareManagerProps {
  hardware: FrontHardware[];
  onHardwareChange: (hardware: FrontHardware[]) => void;
  frontType: string;
}

const hardwareTypes = [
  { value: 'hinge', label: 'Hinge' },
  { value: 'damper', label: 'Damper / Soft Close' },
  { value: 'runner', label: 'Drawer Runner' },
  { value: 'handle', label: 'Handle / Pull' },
  { value: 'other', label: 'Other' },
];

const defaultQuantities: Record<string, Record<string, number>> = {
  hinged_door: { hinge: 3, damper: 1, handle: 1 },
  drawer_front: { runner: 2, damper: 0, handle: 1 },
  lift_up: { hinge: 2, damper: 2, handle: 0 },
  sliding: { runner: 2, handle: 1 },
};

export function FrontHardwareManager({ hardware, onHardwareChange, frontType }: FrontHardwareManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, article_code, price_per_unit')
      .order('name');
    if (data) setProducts(data);
  };

  const addHardware = (type: FrontHardware['hardware_type']) => {
    const defaults = defaultQuantities[frontType] || {};
    const newHardware: FrontHardware = {
      id: uuidv4(),
      hardware_type: type,
      quantity: defaults[type] || 1,
    };
    onHardwareChange([...hardware, newHardware]);
  };

  const updateHardware = (id: string, updates: Partial<FrontHardware>) => {
    onHardwareChange(hardware.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const deleteHardware = (id: string) => {
    onHardwareChange(hardware.filter(h => h.id !== id));
  };

  const addDefaultHardware = () => {
    const defaults = defaultQuantities[frontType] || {};
    const newHardware: FrontHardware[] = Object.entries(defaults)
      .filter(([, qty]) => qty > 0)
      .map(([type, qty]) => ({
        id: uuidv4(),
        hardware_type: type as FrontHardware['hardware_type'],
        quantity: qty,
      }));
    onHardwareChange([...hardware, ...newHardware]);
  };

  const totalCost = hardware.reduce((sum, h) => {
    const product = products.find(p => p.id === h.product_id);
    return sum + (product?.price_per_unit || 0) * h.quantity;
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Hardware ({hardware.length})</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={addDefaultHardware}>
              Add Defaults
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hardware.map((item) => (
          <div key={item.id} className="p-2 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <Select
                value={item.hardware_type}
                onValueChange={(value: FrontHardware['hardware_type']) => 
                  updateHardware(item.id, { hardware_type: value })
                }
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hardwareTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteHardware(item.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Product</Label>
                <Select
                  value={item.product_id || 'none'}
                  onValueChange={(value) => updateHardware(item.id, { product_id: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.price_per_unit > 0 && `(€${p.price_per_unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateHardware(item.id, { quantity: parseInt(e.target.value) || 1 })}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        ))}
        
        {hardware.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No hardware added. Click "Add Defaults" or add individually.
          </p>
        )}
        
        <div className="flex flex-wrap gap-1 pt-2">
          {hardwareTypes.map(t => (
            <Button
              key={t.value}
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => addHardware(t.value as FrontHardware['hardware_type'])}
            >
              + {t.label}
            </Button>
          ))}
        </div>
        
        {totalCost > 0 && (
          <div className="pt-2 border-t text-sm flex justify-between">
            <span className="text-muted-foreground">Hardware Total:</span>
            <span className="font-medium">€{totalCost.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
