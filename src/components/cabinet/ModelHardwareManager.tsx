import { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  article_code: string;
  price_per_unit: number;
  supplier: string;
}

export interface ModelHardware {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: string; // Can be expression like "2" or "door_count * 3"
  unit_price: number;
  notes: string;
}

interface ModelHardwareManagerProps {
  hardware: ModelHardware[];
  onHardwareChange: (hardware: ModelHardware[]) => void;
}

export function ModelHardwareManager({ hardware, onHardwareChange }: ModelHardwareManagerProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedHardware = hardware.find(h => h.id === selectedId);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, article_code, price_per_unit, supplier')
        .order('supplier', { ascending: true })
        .order('name', { ascending: true });
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addHardware = () => {
    const newHardware: ModelHardware = {
      id: uuidv4(),
      product_id: '',
      product_name: '',
      product_code: '',
      quantity: '1',
      unit_price: 0,
      notes: '',
    };
    onHardwareChange([...hardware, newHardware]);
    setSelectedId(newHardware.id);
    toast({ title: 'Hardware item added' });
  };

  const deleteHardware = (id: string) => {
    onHardwareChange(hardware.filter(h => h.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast({ title: 'Hardware item removed' });
  };

  const updateHardware = (id: string, updates: Partial<ModelHardware>) => {
    onHardwareChange(hardware.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const handleProductSelect = (hardwareId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    updateHardware(hardwareId, {
      product_id: productId,
      product_name: product.name,
      product_code: product.article_code || '',
      unit_price: product.price_per_unit || 0,
    });
  };

  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.supplier || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Hardware List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Model Hardware ({hardware.length})</span>
            <Button size="sm" onClick={addHardware}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {hardware.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === item.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-sm">
                          {item.product_name || 'Select product...'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × €{item.unit_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHardware(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {hardware.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hardware attached. Add items like handles, hinges, runners.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Hardware Editor */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Hardware Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedHardware ? (
            <div className="space-y-6">
              <div>
                <Label>Product</Label>
                <Select
                  value={selectedHardware.product_id}
                  onValueChange={(value) => handleProductSelect(selectedHardware.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedProducts).map(([category, prods]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                          {category}
                        </div>
                        {prods.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.article_code || 'N/A'}) - €{product.price_per_unit?.toFixed(2) || '0.00'}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity (or expression)</Label>
                  <Input
                    value={selectedHardware.quantity}
                    onChange={(e) => updateHardware(selectedHardware.id, { quantity: e.target.value })}
                    placeholder="1, 2, door_count * 3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use numbers or expressions like "door_count * 3"
                  </p>
                </div>
                <div>
                  <Label>Unit Price (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={selectedHardware.unit_price}
                    onChange={(e) => updateHardware(selectedHardware.id, { unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={selectedHardware.notes}
                  onChange={(e) => updateHardware(selectedHardware.id, { notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              {selectedHardware.product_id && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Selected Product</h4>
                  <div className="text-sm space-y-1">
                    <p>Name: <strong>{selectedHardware.product_name}</strong></p>
                    <p>Code: <strong>{selectedHardware.product_code}</strong></p>
                    <p>Unit Price: <strong>€{selectedHardware.unit_price.toFixed(2)}</strong></p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">
              Select a hardware item to edit its properties
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
