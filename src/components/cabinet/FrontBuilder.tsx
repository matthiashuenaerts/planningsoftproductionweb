import { useState, useEffect } from 'react';
import { Plus, Trash2, DoorOpen, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CabinetFront {
  id: string;
  name: string;
  front_type: 'hinged_door' | 'drawer_front' | 'lift_up' | 'sliding';
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  thickness: string;
  hinge_side?: 'left' | 'right' | 'top' | 'bottom';
  hardware_id?: string;
  quantity: number;
  material_type: string;
  visible: boolean;
}

interface Product {
  id: string;
  name: string;
  article_code: string | null;
  price_per_unit: number;
  supplier: string | null;
}

interface FrontBuilderProps {
  modelId?: string;
  fronts: CabinetFront[];
  onFrontsChange: (fronts: CabinetFront[]) => void;
}

export function FrontBuilder({ modelId, fronts, onFrontsChange }: FrontBuilderProps) {
  const { toast } = useToast();
  const [selectedFrontId, setSelectedFrontId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const selectedFront = fronts.find(f => f.id === selectedFrontId);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, article_code, price_per_unit, supplier')
      .order('name');
    if (data) setProducts(data);
  };

  const addFront = () => {
    const newFront: CabinetFront = {
      id: uuidv4(),
      name: 'New Door',
      front_type: 'hinged_door',
      position_x: '0',
      position_y: '0',
      position_z: 'depth',
      width: 'width',
      height: 'height',
      thickness: 'door_thickness',
      hinge_side: 'left',
      quantity: 1,
      material_type: 'door',
      visible: true,
    };
    onFrontsChange([...fronts, newFront]);
    setSelectedFrontId(newFront.id);
    toast({ title: 'Door/Front added' });
  };

  const deleteFront = (id: string) => {
    onFrontsChange(fronts.filter(f => f.id !== id));
    if (selectedFrontId === id) setSelectedFrontId(null);
    toast({ title: 'Front deleted' });
  };

  const updateFront = (id: string, updates: Partial<CabinetFront>) => {
    onFrontsChange(fronts.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const frontTypeIcons = {
    hinged_door: <DoorOpen className="h-4 w-4" />,
    drawer_front: <LayoutGrid className="h-4 w-4" />,
    lift_up: <DoorOpen className="h-4 w-4" />,
    sliding: <DoorOpen className="h-4 w-4" />,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Front List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Doors & Fronts ({fronts.length})</span>
            <Button size="sm" onClick={addFront}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {fronts.map((front) => (
                <div
                  key={front.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedFrontId === front.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedFrontId(front.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {frontTypeIcons[front.front_type]}
                      <div>
                        <div className="font-medium">{front.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {front.front_type.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFront(front.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {fronts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No doors/fronts yet. Click "Add" to create one.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Front Editor */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Front Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedFront ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={selectedFront.name}
                      onChange={(e) => updateFront(selectedFront.id, { name: e.target.value })}
                      placeholder="e.g., Main Door"
                    />
                  </div>

                  <div>
                    <Label>Front Type</Label>
                    <Select
                      value={selectedFront.front_type}
                      onValueChange={(value: CabinetFront['front_type']) => 
                        updateFront(selectedFront.id, { front_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hinged_door">Hinged Door</SelectItem>
                        <SelectItem value="drawer_front">Drawer Front</SelectItem>
                        <SelectItem value="lift_up">Lift-up Door</SelectItem>
                        <SelectItem value="sliding">Sliding Door</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Position</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">X</Label>
                      <Input
                        value={selectedFront.position_x}
                        onChange={(e) => updateFront(selectedFront.id, { position_x: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y</Label>
                      <Input
                        value={selectedFront.position_y}
                        onChange={(e) => updateFront(selectedFront.id, { position_y: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Z</Label>
                      <Input
                        value={selectedFront.position_z}
                        onChange={(e) => updateFront(selectedFront.id, { position_z: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Dimensions</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input
                        value={selectedFront.width}
                        onChange={(e) => updateFront(selectedFront.id, { width: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input
                        value={selectedFront.height}
                        onChange={(e) => updateFront(selectedFront.id, { height: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Thickness</Label>
                      <Select
                        value={selectedFront.thickness}
                        onValueChange={(value) => updateFront(selectedFront.id, { thickness: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="door_thickness">Door Thickness</SelectItem>
                          <SelectItem value="18">18mm</SelectItem>
                          <SelectItem value="19">19mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Hinge Side (for hinged doors) */}
                {selectedFront.front_type === 'hinged_door' && (
                  <div>
                    <Label>Hinge Side</Label>
                    <Select
                      value={selectedFront.hinge_side || 'left'}
                      onValueChange={(value: 'left' | 'right' | 'top' | 'bottom') => 
                        updateFront(selectedFront.id, { hinge_side: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Hardware Selection */}
                <div>
                  <Label>Hardware (Hinges/Runners)</Label>
                  <Select
                    value={selectedFront.hardware_id || ''}
                    onValueChange={(value) => updateFront(selectedFront.id, { hardware_id: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select hardware..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.price_per_unit > 0 && `(€${product.price_per_unit})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={selectedFront.quantity}
                      onChange={(e) => updateFront(selectedFront.id, { quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Quick Presets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFront(selectedFront.id, {
                        name: 'Single Door',
                        front_type: 'hinged_door',
                        position_x: '0',
                        position_y: '0',
                        position_z: 'depth',
                        width: 'width',
                        height: 'height',
                        thickness: 'door_thickness',
                        hinge_side: 'left',
                      })}
                    >
                      Single Door
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFront(selectedFront.id, {
                        name: 'Double Door Left',
                        front_type: 'hinged_door',
                        position_x: '0',
                        position_y: '0',
                        position_z: 'depth',
                        width: 'width/2',
                        height: 'height',
                        thickness: 'door_thickness',
                        hinge_side: 'left',
                      })}
                    >
                      Double Door (Left)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFront(selectedFront.id, {
                        name: 'Drawer Front',
                        front_type: 'drawer_front',
                        position_x: '0',
                        position_y: '0',
                        position_z: 'depth',
                        width: 'width',
                        height: '200',
                        thickness: 'door_thickness',
                      })}
                    >
                      Drawer Front
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFront(selectedFront.id, {
                        name: 'Lift-up Door',
                        front_type: 'lift_up',
                        position_x: '0',
                        position_y: 'height-400',
                        position_z: 'depth',
                        width: 'width',
                        height: '400',
                        thickness: 'door_thickness',
                        hinge_side: 'top',
                      })}
                    >
                      Lift-up Door
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Select a door/front from the list to edit
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
