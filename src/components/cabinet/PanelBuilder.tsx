import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParametricPanel, PanelType, DimensionVariable } from '@/types/cabinet';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';

interface PanelBuilderProps {
  panels: ParametricPanel[];
  onPanelsChange: (panels: ParametricPanel[]) => void;
  onSave: () => void;
}

export function PanelBuilder({ panels, onPanelsChange, onSave }: PanelBuilderProps) {
  const { toast } = useToast();
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  const selectedPanel = panels.find(p => p.id === selectedPanelId);

  const addPanel = () => {
    const newPanel: ParametricPanel = {
      id: uuidv4(),
      name: 'New Panel',
      type: 'bottom',
      x: 0,
      y: 0,
      z: 0,
      length: 'width',
      width: 'depth',
      thickness: 'body_thickness',
      material_type: 'body',
      visible: true,
    };
    onPanelsChange([...panels, newPanel]);
    setSelectedPanelId(newPanel.id);
    toast({ title: 'Panel added', description: 'Configure the panel properties' });
  };

  const deletePanel = (id: string) => {
    onPanelsChange(panels.filter(p => p.id !== id));
    if (selectedPanelId === id) setSelectedPanelId(null);
    toast({ title: 'Panel deleted' });
  };

  const updatePanel = (id: string, updates: Partial<ParametricPanel>) => {
    onPanelsChange(panels.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const dimensionVariables: DimensionVariable[] = [
    'width', 'height', 'depth', 'body_thickness', 'door_thickness', 'shelf_thickness'
  ];

  const panelTypes: PanelType[] = [
    'bottom', 'top', 'left_side', 'right_side', 'back', 'shelf', 'divider', 'door', 'drawer_front'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Panels ({panels.length})</span>
            <Button size="sm" onClick={addPanel}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPanelId === panel.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPanelId(panel.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{panel.name}</div>
                      <div className="text-xs text-muted-foreground">{panel.type}</div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePanel(panel.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {panels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No panels yet. Click "Add" to create one.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Panel Editor */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Panel Properties</span>
            <Button onClick={onSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Model
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Define panels using variables: <strong>width</strong>, <strong>height</strong>, <strong>depth</strong> for dimensions; <strong>body_thickness</strong>, <strong>door_thickness</strong>, <strong>shelf_thickness</strong> for material thicknesses. 
            Use expressions like "width - body_thickness*2" for dynamic sizing.
          </p>
        </CardHeader>
        <CardContent>
          {selectedPanel ? (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  
                  <div>
                    <Label>Panel Name</Label>
                    <Input
                      value={selectedPanel.name}
                      onChange={(e) => updatePanel(selectedPanel.id, { name: e.target.value })}
                      placeholder="e.g., Bottom Plate, Left Side"
                    />
                  </div>

                  <div>
                    <Label>Panel Type</Label>
                    <Select
                      value={selectedPanel.type}
                      onValueChange={(value: PanelType) => updatePanel(selectedPanel.id, { type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {panelTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Material Type</Label>
                    <Select
                      value={selectedPanel.material_type}
                      onValueChange={(value: 'body' | 'door' | 'shelf') => 
                        updatePanel(selectedPanel.id, { material_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="body">Body Material</SelectItem>
                        <SelectItem value="door">Door Material</SelectItem>
                        <SelectItem value="shelf">Shelf Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Position (X, Y, Z) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Position (X, Y, Z)</h3>
                  <p className="text-sm text-muted-foreground">
                    Use numbers (e.g., 0, 10) or variables (e.g., width, body_thickness) or expressions (e.g., width/2, width-body_thickness*2)
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>X Position</Label>
                      <Input
                        value={selectedPanel.x}
                        onChange={(e) => updatePanel(selectedPanel.id, { x: e.target.value })}
                        placeholder="0 or variable"
                      />
                    </div>
                    <div>
                      <Label>Y Position</Label>
                      <Input
                        value={selectedPanel.y}
                        onChange={(e) => updatePanel(selectedPanel.id, { y: e.target.value })}
                        placeholder="0 or variable"
                      />
                    </div>
                    <div>
                      <Label>Z Position</Label>
                      <Input
                        value={selectedPanel.z}
                        onChange={(e) => updatePanel(selectedPanel.id, { z: e.target.value })}
                        placeholder="0 or variable"
                      />
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dimensions</h3>
                  
                  <div>
                    <Label>Length (X dimension)</Label>
                    <Input
                      value={selectedPanel.length}
                      onChange={(e) => updatePanel(selectedPanel.id, { length: e.target.value })}
                      placeholder="width or expression"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Common: width, depth, height, or expressions like width-body_thickness*2
                    </p>
                  </div>

                  <div>
                    <Label>Width (Y dimension)</Label>
                    <Input
                      value={selectedPanel.width}
                      onChange={(e) => updatePanel(selectedPanel.id, { width: e.target.value })}
                      placeholder="depth or expression"
                    />
                  </div>

                  <div>
                    <Label>Thickness</Label>
                    <Select
                      value={String(selectedPanel.thickness)}
                      onValueChange={(value) => {
                        const numValue = parseFloat(value);
                        updatePanel(selectedPanel.id, { 
                          thickness: isNaN(numValue) ? value : numValue 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="body_thickness">Body Thickness</SelectItem>
                        <SelectItem value="door_thickness">Door Thickness</SelectItem>
                        <SelectItem value="shelf_thickness">Shelf Thickness</SelectItem>
                        <SelectItem value="18">18mm (custom)</SelectItem>
                        <SelectItem value="16">16mm (custom)</SelectItem>
                        <SelectItem value="12">12mm (custom)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Common Presets */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Quick Presets</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Bottom Plate',
                        type: 'bottom',
                        x: 0,
                        y: 0,
                        z: 0,
                        length: 'width',
                        width: 'depth',
                        thickness: 'body_thickness',
                        material_type: 'body',
                      })}
                    >
                      Bottom Plate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Top Plate',
                        type: 'top',
                        x: 0,
                        y: 'height-body_thickness',
                        z: 0,
                        length: 'width',
                        width: 'depth',
                        thickness: 'body_thickness',
                        material_type: 'body',
                      })}
                    >
                      Top Plate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Left Side',
                        type: 'left_side',
                        x: 0,
                        y: 0,
                        z: 0,
                        length: 'body_thickness',
                        width: 'depth',
                        thickness: 'height',
                        material_type: 'body',
                      })}
                    >
                      Left Side
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Right Side',
                        type: 'right_side',
                        x: 'width-body_thickness',
                        y: 0,
                        z: 0,
                        length: 'body_thickness',
                        width: 'depth',
                        thickness: 'height',
                        material_type: 'body',
                      })}
                    >
                      Right Side
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Back Panel',
                        type: 'back',
                        x: 'body_thickness',
                        y: 'body_thickness',
                        z: 0,
                        length: 'width-body_thickness*2',
                        width: 'body_thickness',
                        thickness: 'height-body_thickness*2',
                        material_type: 'body',
                      })}
                    >
                      Back Panel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePanel(selectedPanel.id, {
                        name: 'Shelf',
                        type: 'shelf',
                        x: 'body_thickness',
                        y: 'height/2',
                        z: 'body_thickness',
                        length: 'width-body_thickness*2',
                        width: 'depth-body_thickness*2',
                        thickness: 'shelf_thickness',
                        material_type: 'shelf',
                      })}
                    >
                      Shelf
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-[600px] text-muted-foreground">
              Select a panel from the list to edit its properties
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
