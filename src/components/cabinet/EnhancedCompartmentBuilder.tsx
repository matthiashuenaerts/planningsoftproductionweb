import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Box, Layers, LayoutGrid, SplitSquareVertical, SplitSquareHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CompartmentItem {
  id: string;
  item_type: 'horizontal_divider' | 'vertical_divider' | 'shelf' | 'legrabox_drawer';
  position_y: string;
  position_x: string;
  thickness: string;
  quantity: number;
  has_drilling: boolean;
  drilling_pattern?: string;
  legrabox_id?: string;
  material_type: string;
}

interface Compartment {
  id: string;
  name: string;
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  depth: string;
  items: CompartmentItem[];
}

interface LegraboxConfig {
  id: string;
  name: string;
  height_type: string;
  height_mm: number;
  side_colour: string;
  bottom_colour: string;
  has_drawer_mat: boolean;
  nominal_length: number;
  price: number;
}

interface EnhancedCompartmentBuilderProps {
  modelId?: string;
  compartments: Compartment[];
  onCompartmentsChange: (compartments: Compartment[]) => void;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultDepth?: number;
}

export function EnhancedCompartmentBuilder({ 
  modelId, 
  compartments, 
  onCompartmentsChange,
  defaultWidth = 800,
  defaultHeight = 2000,
  defaultDepth = 600,
}: EnhancedCompartmentBuilderProps) {
  const { toast } = useToast();
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [legraboxConfigs, setLegraboxConfigs] = useState<LegraboxConfig[]>([]);

  const selectedCompartment = compartments.find(c => c.id === selectedCompartmentId);
  const selectedItem = selectedCompartment?.items.find(i => i.id === selectedItemId);

  useEffect(() => {
    loadLegraboxConfigs();
  }, []);

  const loadLegraboxConfigs = async () => {
    const { data } = await supabase
      .from('legrabox_configurations')
      .select('*')
      .eq('is_active', true)
      .order('height_type', { ascending: true })
      .order('nominal_length', { ascending: true });
    if (data) setLegraboxConfigs(data);
  };

  // Auto-detect interior compartment
  const autoDetectInterior = () => {
    const interiorCompartment: Compartment = {
      id: uuidv4(),
      name: 'Interior',
      position_x: 'body_thickness',
      position_y: 'body_thickness',
      position_z: 'body_thickness',
      width: 'width - body_thickness * 2',
      height: 'height - body_thickness * 2',
      depth: 'depth - body_thickness',
      items: [],
    };
    onCompartmentsChange([...compartments, interiorCompartment]);
    setSelectedCompartmentId(interiorCompartment.id);
    toast({ title: 'Interior compartment auto-detected' });
  };

  // Quick division helpers
  const divideHorizontally = (compartmentId: string, divisions: number) => {
    const compartment = compartments.find(c => c.id === compartmentId);
    if (!compartment) return;

    const newItems: CompartmentItem[] = [];
    for (let i = 1; i < divisions; i++) {
      newItems.push({
        id: uuidv4(),
        item_type: 'horizontal_divider',
        position_y: `height * ${i} / ${divisions}`,
        position_x: '0',
        thickness: 'shelf_thickness',
        quantity: 1,
        has_drilling: false,
        material_type: 'shelf',
      });
    }

    updateCompartment(compartmentId, {
      items: [...compartment.items.filter(i => i.item_type !== 'horizontal_divider'), ...newItems],
    });
    toast({ title: `Divided into ${divisions} horizontal sections` });
  };

  const divideVertically = (compartmentId: string, divisions: number) => {
    const compartment = compartments.find(c => c.id === compartmentId);
    if (!compartment) return;

    const newItems: CompartmentItem[] = [];
    for (let i = 1; i < divisions; i++) {
      newItems.push({
        id: uuidv4(),
        item_type: 'vertical_divider',
        position_y: '0',
        position_x: `width * ${i} / ${divisions}`,
        thickness: 'body_thickness',
        quantity: 1,
        has_drilling: false,
        material_type: 'body',
      });
    }

    updateCompartment(compartmentId, {
      items: [...compartment.items.filter(i => i.item_type !== 'vertical_divider'), ...newItems],
    });
    toast({ title: `Divided into ${divisions} vertical sections` });
  };

  const addCompartment = () => {
    const newCompartment: Compartment = {
      id: uuidv4(),
      name: 'New Compartment',
      position_x: 'body_thickness',
      position_y: 'body_thickness',
      position_z: 'body_thickness',
      width: 'width - body_thickness*2',
      height: 'height - body_thickness*2',
      depth: 'depth - body_thickness',
      items: [],
    };
    onCompartmentsChange([...compartments, newCompartment]);
    setSelectedCompartmentId(newCompartment.id);
    toast({ title: 'Compartment added' });
  };

  const deleteCompartment = (id: string) => {
    onCompartmentsChange(compartments.filter(c => c.id !== id));
    if (selectedCompartmentId === id) {
      setSelectedCompartmentId(null);
      setSelectedItemId(null);
    }
    toast({ title: 'Compartment deleted' });
  };

  const updateCompartment = (id: string, updates: Partial<Compartment>) => {
    onCompartmentsChange(compartments.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addItem = (compartmentId: string, type: CompartmentItem['item_type']) => {
    const compartment = compartments.find(c => c.id === compartmentId);
    if (!compartment) return;

    const newItem: CompartmentItem = {
      id: uuidv4(),
      item_type: type,
      position_y: type === 'vertical_divider' ? '0' : 'height/2',
      position_x: type === 'vertical_divider' ? 'width/2' : '0',
      thickness: 'shelf_thickness',
      quantity: 1,
      has_drilling: type === 'shelf',
      material_type: 'shelf',
    };

    updateCompartment(compartmentId, {
      items: [...compartment.items, newItem],
    });
    setSelectedItemId(newItem.id);
    toast({ title: `${type.replace(/_/g, ' ')} added` });
  };

  const deleteItem = (compartmentId: string, itemId: string) => {
    const compartment = compartments.find(c => c.id === compartmentId);
    if (!compartment) return;

    updateCompartment(compartmentId, {
      items: compartment.items.filter(i => i.id !== itemId),
    });
    if (selectedItemId === itemId) setSelectedItemId(null);
    toast({ title: 'Item deleted' });
  };

  const updateItem = (compartmentId: string, itemId: string, updates: Partial<CompartmentItem>) => {
    const compartment = compartments.find(c => c.id === compartmentId);
    if (!compartment) return;

    updateCompartment(compartmentId, {
      items: compartment.items.map(i => i.id === itemId ? { ...i, ...updates } : i),
    });
  };

  const itemTypeIcons = {
    horizontal_divider: <Layers className="h-4 w-4" />,
    vertical_divider: <LayoutGrid className="h-4 w-4" />,
    shelf: <Layers className="h-4 w-4" />,
    legrabox_drawer: <Box className="h-4 w-4" />,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Compartment List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compartments ({compartments.length})</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={autoDetectInterior}>
                Auto
              </Button>
              <Button size="sm" onClick={addCompartment}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {compartments.map((compartment) => (
                <div key={compartment.id} className="space-y-2">
                  <div
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCompartmentId === compartment.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedCompartmentId(compartment.id);
                      setSelectedItemId(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{compartment.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {compartment.items.length} items
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCompartment(compartment.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Items in compartment */}
                  {selectedCompartmentId === compartment.id && (
                    <div className="ml-4 space-y-1">
                      {/* Quick division buttons */}
                      <div className="flex gap-1 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => divideHorizontally(compartment.id, 2)}
                        >
                          <SplitSquareHorizontal className="h-3 w-3 mr-1" />
                          ÷2 H
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => divideHorizontally(compartment.id, 3)}
                        >
                          ÷3 H
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => divideVertically(compartment.id, 2)}
                        >
                          <SplitSquareVertical className="h-3 w-3 mr-1" />
                          ÷2 V
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => divideVertically(compartment.id, 3)}
                        >
                          ÷3 V
                        </Button>
                      </div>

                      {compartment.items.map((item) => (
                        <div
                          key={item.id}
                          className={`p-2 rounded border cursor-pointer text-sm ${
                            selectedItemId === item.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border/50 hover:border-primary/30'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemId(item.id);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {itemTypeIcons[item.item_type]}
                              <span>{item.item_type.replace(/_/g, ' ')}</span>
                              {item.quantity > 1 && <Badge variant="secondary" className="text-xs">×{item.quantity}</Badge>}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(compartment.id, item.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Add item buttons */}
                      <div className="flex flex-wrap gap-1 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addItem(compartment.id, 'shelf')}
                        >
                          + Shelf
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addItem(compartment.id, 'horizontal_divider')}
                        >
                          + H-Div
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addItem(compartment.id, 'vertical_divider')}
                        >
                          + V-Div
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addItem(compartment.id, 'legrabox_drawer')}
                        >
                          + Legrabox
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {compartments.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    No compartments yet. Click "Auto" to detect interior or add manually.
                  </p>
                  <Button onClick={autoDetectInterior} variant="outline">
                    <Box className="h-4 w-4 mr-2" />
                    Auto-detect Interior
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Compartment/Item Editor */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {selectedItem ? 'Item Properties' : selectedCompartment ? 'Compartment Properties' : 'Properties'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedItem && selectedCompartment ? (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                <div>
                  <Label>Item Type</Label>
                  <div className="text-sm text-muted-foreground capitalize">
                    {selectedItem.item_type.replace(/_/g, ' ')}
                  </div>
                </div>

                {selectedItem.item_type === 'legrabox_drawer' ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Legrabox Configuration</Label>
                      <Select
                        value={selectedItem.legrabox_id || ''}
                        onValueChange={(value) => 
                          updateItem(selectedCompartment.id, selectedItem.id, { legrabox_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Legrabox..." />
                        </SelectTrigger>
                        <SelectContent>
                          {legraboxConfigs.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              {config.name} ({config.height_type} - {config.height_mm}mm) - €{config.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Y Position (from bottom)</Label>
                        <Input
                          value={selectedItem.position_y}
                          onChange={(e) => 
                            updateItem(selectedCompartment.id, selectedItem.id, { position_y: e.target.value })
                          }
                          placeholder="0 or expression"
                        />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={selectedItem.quantity}
                          onChange={(e) => 
                            updateItem(selectedCompartment.id, selectedItem.id, { quantity: parseInt(e.target.value) || 1 })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {selectedItem.item_type === 'vertical_divider' ? (
                        <div>
                          <Label>X Position</Label>
                          <Input
                            value={selectedItem.position_x}
                            onChange={(e) => 
                              updateItem(selectedCompartment.id, selectedItem.id, { position_x: e.target.value })
                            }
                            placeholder="width/2"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label>Y Position (from bottom)</Label>
                          <Input
                            value={selectedItem.position_y}
                            onChange={(e) => 
                              updateItem(selectedCompartment.id, selectedItem.id, { position_y: e.target.value })
                            }
                            placeholder="height/2"
                          />
                        </div>
                      )}
                      <div>
                        <Label>Thickness</Label>
                        <Select
                          value={selectedItem.thickness}
                          onValueChange={(value) => 
                            updateItem(selectedCompartment.id, selectedItem.id, { thickness: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shelf_thickness">Shelf Thickness</SelectItem>
                            <SelectItem value="body_thickness">Body Thickness</SelectItem>
                            <SelectItem value="18">18mm</SelectItem>
                            <SelectItem value="16">16mm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedItem.item_type === 'shelf' && (
                      <>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={selectedItem.quantity}
                            onChange={(e) => 
                              updateItem(selectedCompartment.id, selectedItem.id, { quantity: parseInt(e.target.value) || 1 })
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Multiple shelves will be evenly distributed
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Has Drilling Pattern</Label>
                          <Switch
                            checked={selectedItem.has_drilling}
                            onCheckedChange={(checked) => 
                              updateItem(selectedCompartment.id, selectedItem.id, { has_drilling: checked })
                            }
                          />
                        </div>

                        {selectedItem.has_drilling && (
                          <div>
                            <Label>Drilling Pattern</Label>
                            <Select
                              value={selectedItem.drilling_pattern || 'standard'}
                              onValueChange={(value) => 
                                updateItem(selectedCompartment.id, selectedItem.id, { drilling_pattern: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard 32mm System</SelectItem>
                                <SelectItem value="front_only">Front Edge Only</SelectItem>
                                <SelectItem value="all_edges">All Edges</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : selectedCompartment ? (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                <div>
                  <Label>Compartment Name</Label>
                  <Input
                    value={selectedCompartment.name}
                    onChange={(e) => updateCompartment(selectedCompartment.id, { name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Position (parametric)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">X</Label>
                      <Input
                        value={selectedCompartment.position_x}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { position_x: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y</Label>
                      <Input
                        value={selectedCompartment.position_y}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { position_y: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Z</Label>
                      <Input
                        value={selectedCompartment.position_z}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { position_z: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Dimensions (parametric)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input
                        value={selectedCompartment.width}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { width: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input
                        value={selectedCompartment.height}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { height: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Depth</Label>
                      <Input
                        value={selectedCompartment.depth}
                        onChange={(e) => updateCompartment(selectedCompartment.id, { depth: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use expressions like "width - body_thickness * 2" for parametric sizing
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Quick Division</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Quickly divide this compartment into equal sections
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Horizontal (rows)</Label>
                      <div className="flex gap-1 mt-1">
                        {[2, 3, 4, 5].map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant="outline"
                            onClick={() => divideHorizontally(selectedCompartment.id, n)}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Vertical (columns)</Label>
                      <div className="flex gap-1 mt-1">
                        {[2, 3, 4].map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant="outline"
                            onClick={() => divideVertically(selectedCompartment.id, n)}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">
              Select a compartment to edit its properties
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
