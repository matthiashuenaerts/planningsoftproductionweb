import { useState, useEffect } from 'react';
import { Plus, Trash2, Box, Layers, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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

interface CompartmentBuilderProps {
  modelId?: string;
  compartments: Compartment[];
  onCompartmentsChange: (compartments: Compartment[]) => void;
}

export function CompartmentBuilder({ modelId, compartments, onCompartmentsChange }: CompartmentBuilderProps) {
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
            <Button size="sm" onClick={addCompartment}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
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
                          + H-Divider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addItem(compartment.id, 'vertical_divider')}
                        >
                          + V-Divider
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
                <p className="text-sm text-muted-foreground text-center py-8">
                  No compartments yet. Add one to define interior zones.
                </p>
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
                  /* Legrabox Drawer Configuration */
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
                              {config.name} - €{config.price}
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

                    {selectedItem.legrabox_id && (
                      <div className="p-3 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">Selected Legrabox Details</h4>
                        {(() => {
                          const config = legraboxConfigs.find(c => c.id === selectedItem.legrabox_id);
                          if (!config) return null;
                          return (
                            <div className="text-sm space-y-1">
                              <p>Height Type: <strong>{config.height_type}</strong> ({config.height_mm}mm)</p>
                              <p>Side Colour: <strong>{config.side_colour}</strong></p>
                              <p>Bottom Colour: <strong>{config.bottom_colour}</strong></p>
                              <p>Nominal Length: <strong>{config.nominal_length}mm</strong></p>
                              <p>Price: <strong>€{config.price}</strong></p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Shelf/Divider Configuration */
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
                            Shelves will be evenly distributed in the compartment
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={selectedItem.has_drilling}
                            onCheckedChange={(checked) => 
                              updateItem(selectedCompartment.id, selectedItem.id, { has_drilling: checked })
                            }
                          />
                          <Label>Include drilling for adjustable shelves</Label>
                        </div>

                        {selectedItem.has_drilling && (
                          <div>
                            <Label>Drilling Pattern</Label>
                            <Select
                              value={selectedItem.drilling_pattern || '32mm'}
                              onValueChange={(value) => 
                                updateItem(selectedCompartment.id, selectedItem.id, { drilling_pattern: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="32mm">32mm System</SelectItem>
                                <SelectItem value="37mm">37mm System</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
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
                    placeholder="e.g., Main Interior"
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Position (relative to cabinet)</h4>
                  <div className="grid grid-cols-3 gap-4">
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
                  <h4 className="font-semibold">Dimensions</h4>
                  <div className="grid grid-cols-3 gap-4">
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
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Quick Presets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCompartment(selectedCompartment.id, {
                        name: 'Full Interior',
                        position_x: 'body_thickness',
                        position_y: 'body_thickness',
                        position_z: 'body_thickness',
                        width: 'width - body_thickness*2',
                        height: 'height - body_thickness*2',
                        depth: 'depth - body_thickness',
                      })}
                    >
                      Full Interior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCompartment(selectedCompartment.id, {
                        name: 'Left Half',
                        position_x: 'body_thickness',
                        position_y: 'body_thickness',
                        position_z: 'body_thickness',
                        width: '(width - body_thickness*2)/2',
                        height: 'height - body_thickness*2',
                        depth: 'depth - body_thickness',
                      })}
                    >
                      Left Half
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCompartment(selectedCompartment.id, {
                        name: 'Top Section',
                        position_x: 'body_thickness',
                        position_y: 'height/2',
                        position_z: 'body_thickness',
                        width: 'width - body_thickness*2',
                        height: 'height/2 - body_thickness',
                        depth: 'depth - body_thickness',
                      })}
                    >
                      Top Section
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCompartment(selectedCompartment.id, {
                        name: 'Bottom Section',
                        position_x: 'body_thickness',
                        position_y: 'body_thickness',
                        position_z: 'body_thickness',
                        width: 'width - body_thickness*2',
                        height: 'height/2 - body_thickness',
                        depth: 'depth - body_thickness',
                      })}
                    >
                      Bottom Section
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
              Select a compartment to define interior zones
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
