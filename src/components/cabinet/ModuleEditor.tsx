import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Compartment, Module, ModuleType } from '@/types/cabinet';
import { v4 as uuidv4 } from 'uuid';

interface ModuleEditorProps {
  compartment: Compartment | null;
  materials: Array<{ id: string; name: string; sku: string; category: string }>;
  onUpdateCompartment: (compartment: Compartment) => void;
}

export function ModuleEditor({ compartment, materials, onUpdateCompartment }: ModuleEditorProps) {
  const [newModuleType, setNewModuleType] = useState<ModuleType>('horizontal_division');
  const [newModulePosition, setNewModulePosition] = useState<number>(100);
  const [newModuleHeight, setNewModuleHeight] = useState<number>(100);
  const [newModuleHardware, setNewModuleHardware] = useState<string>('');

  if (!compartment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Module Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a compartment from the cabinet preview to add modules
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleAddModule = () => {
    const newModule: Module = {
      id: uuidv4(),
      type: newModuleType,
      position: newModulePosition,
      height: newModuleType === 'drawer' ? newModuleHeight : undefined,
      hardware_id: newModuleType === 'drawer' && newModuleHardware ? newModuleHardware : undefined,
    };

    const updatedCompartment: Compartment = {
      ...compartment,
      modules: [...compartment.modules, newModule],
    };

    onUpdateCompartment(updatedCompartment);
    
    // Reset form
    setNewModulePosition(100);
    setNewModuleHeight(100);
    setNewModuleHardware('');
  };

  const handleDeleteModule = (moduleId: string) => {
    const updatedCompartment: Compartment = {
      ...compartment,
      modules: compartment.modules.filter(m => m.id !== moduleId),
    };
    onUpdateCompartment(updatedCompartment);
  };

  const hardwareMaterials = materials.filter(m => m.category === 'hardware');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Editor - Compartment {compartment.id.slice(0, 8)}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compartment size: {compartment.width}mm × {compartment.height}mm
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Module */}
        <div className="space-y-4 border rounded-lg p-4">
          <h4 className="font-medium">Add Module</h4>
          
          <div>
            <Label htmlFor="module-type">Module Type</Label>
            <Select
              value={newModuleType}
              onValueChange={(value) => setNewModuleType(value as ModuleType)}
            >
              <SelectTrigger id="module-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal_division">Horizontal Division</SelectItem>
                <SelectItem value="vertical_division">Vertical Division</SelectItem>
                <SelectItem value="drawer">Drawer</SelectItem>
                <SelectItem value="shelf">Shelf</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="position">
              Position from {newModuleType.includes('vertical') ? 'left' : 'top'} (mm)
            </Label>
            <Input
              id="position"
              type="number"
              value={newModulePosition}
              onChange={(e) => setNewModulePosition(Number(e.target.value))}
              min={0}
              max={newModuleType.includes('vertical') ? compartment.width : compartment.height}
            />
          </div>

          {newModuleType === 'drawer' && (
            <>
              <div>
                <Label htmlFor="drawer-height">Drawer Height (mm)</Label>
                <Input
                  id="drawer-height"
                  type="number"
                  value={newModuleHeight}
                  onChange={(e) => setNewModuleHeight(Number(e.target.value))}
                  min={50}
                  max={500}
                />
              </div>

              <div>
                <Label htmlFor="hardware">Drawer Hardware</Label>
                <Select
                  value={newModuleHardware}
                  onValueChange={setNewModuleHardware}
                >
                  <SelectTrigger id="hardware">
                    <SelectValue placeholder="Select hardware" />
                  </SelectTrigger>
                  <SelectContent>
                    {hardwareMaterials.map((hw) => (
                      <SelectItem key={hw.id} value={hw.id}>
                        {hw.name} - {hw.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button onClick={handleAddModule} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Module
          </Button>
        </div>

        {/* Existing Modules */}
        <div className="space-y-2">
          <h4 className="font-medium">Existing Modules</h4>
          {compartment.modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules added yet</p>
          ) : (
            <div className="space-y-2">
              {compartment.modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {module.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position: {module.position}mm
                      {module.height && ` | Height: ${module.height}mm`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteModule(module.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
