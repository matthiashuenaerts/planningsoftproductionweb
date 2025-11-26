import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import { InteractiveCabinetVisualizer } from '@/components/cabinet/InteractiveCabinetVisualizer';
import { ModuleEditor } from '@/components/cabinet/ModuleEditor';
import type { Database } from '@/integrations/supabase/types';
import { CabinetConfiguration, Compartment } from '@/types/cabinet';
import { v4 as uuidv4 } from 'uuid';

type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];
type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

export default function CabinetEditor() {
  const { projectId, modelId } = useParams<{ projectId: string; modelId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [model, setModel] = useState<CabinetModel | null>(null);
  const [materials, setMaterials] = useState<CabinetMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<CabinetConfiguration>({
    name: '',
    width: 800,
    height: 2000,
    depth: 600,
    material_config: {
      body_material: '',
      door_material: '',
      shelf_material: '',
      body_thickness: 18,
      door_thickness: 18,
      shelf_thickness: 18,
    },
    edge_banding: 'PVC',
    finish: 'matte',
    door_type: 'hinged',
    compartments: [],
  });

  useEffect(() => {
    loadData();
  }, [modelId]);

  const loadData = async () => {
    if (!modelId) return;
    
    try {
      const [modelData, materialsData] = await Promise.all([
        cabinetService.getModel(modelId),
        cabinetService.getAllMaterials(),
      ]);
      
      setModel(modelData);
      setMaterials(materialsData);
      
      // Set default values from model and create initial compartment
      if (modelData) {
        const initialCompartment: Compartment = {
          id: uuidv4(),
          x: 0,
          y: 0,
          width: modelData.default_width || 800,
          height: modelData.default_height || 2000,
          modules: [],
        };

        setConfig(prev => ({
          ...prev,
          name: modelData.name,
          width: modelData.default_width || prev.width,
          height: modelData.default_height || prev.height,
          depth: modelData.default_depth || prev.depth,
          compartments: [initialCompartment],
        }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cabinet data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompartment = (updatedCompartment: Compartment) => {
    setConfig(prev => ({
      ...prev,
      compartments: prev.compartments.map(c => 
        c.id === updatedCompartment.id ? updatedCompartment : c
      ),
    }));
  };

  const selectedCompartment = config.compartments.find(c => c.id === selectedCompartmentId) || null;

  const handleSave = async () => {
    if (!projectId || !modelId) return;
    
    setSaving(true);
    try {
      await cabinetService.createConfiguration({
        project_id: projectId,
        model_id: modelId,
        name: config.name,
        width: config.width,
        height: config.height,
        depth: config.depth,
        horizontal_divisions: 0, // Legacy field
        vertical_divisions: 0, // Legacy field
        drawer_count: config.compartments.reduce((sum, c) => 
          sum + c.modules.filter(m => m.type === 'drawer').length, 0
        ),
        door_type: config.door_type,
        material_config: config.material_config as any,
        edge_banding: config.edge_banding,
        finish: config.finish,
        parameters: { compartments: config.compartments } as any,
      });
      
      toast({
        title: 'Success',
        description: 'Cabinet configuration saved',
      });
      
      navigate(`/calculation/project/${projectId}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Model not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(`/calculation/project/${projectId}/library`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Library
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Configure Cabinet</h1>
        <p className="text-muted-foreground mt-2">
          {model.name} - {model.category}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Configuration */}
        <div className="space-y-6 lg:col-span-1">
          {/* Cabinet Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Cabinet Structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Cabinet Name</Label>
                <Input
                  id="name"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Enter cabinet name"
                />
              </div>

              <div className="space-y-4">
                <Label htmlFor="width">Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={config.width}
                  onChange={(e) => setConfig({ ...config, width: Number(e.target.value) })}
                  min={model.min_width || 0}
                  max={model.max_width || undefined}
                />
              </div>
              <div>
                <Label htmlFor="height">Height (mm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={config.height}
                  onChange={(e) => setConfig({ ...config, height: Number(e.target.value) })}
                  min={model.min_height || 0}
                  max={model.max_height || undefined}
                />
              </div>
              <div>
                <Label htmlFor="depth">Depth (mm)</Label>
                <Input
                  id="depth"
                  type="number"
                  value={config.depth}
                  onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })}
                  min={model.min_depth || 0}
                  max={model.max_depth || undefined}
                />
              </div>

              <div>
                <Label htmlFor="door_type">Door Type</Label>
                <Select
                  value={config.door_type}
                  onValueChange={(value) => setConfig({ ...config, door_type: value })}
                >
                  <SelectTrigger id="door_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hinged">Hinged</SelectItem>
                    <SelectItem value="sliding">Sliding</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader>
              <CardTitle>Materials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="body_material">Body Material</Label>
                <Select
                  value={config.material_config.body_material}
                  onValueChange={(value) => {
                    const selectedMaterial = materials.find(m => m.id === value);
                    setConfig({
                      ...config,
                      material_config: { 
                        ...config.material_config, 
                        body_material: value,
                        body_thickness: selectedMaterial?.thickness || 18,
                      }
                    });
                  }}
                >
                  <SelectTrigger id="body_material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.filter(m => m.category === 'panel').map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} - {material.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="door_material">Door Material</Label>
                <Select
                  value={config.material_config.door_material}
                  onValueChange={(value) => setConfig({
                    ...config,
                    material_config: { ...config.material_config, door_material: value }
                  })}
                >
                  <SelectTrigger id="door_material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.filter(m => m.category === 'panel').map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} - {material.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="shelf_material">Shelf Material</Label>
                <Select
                  value={config.material_config.shelf_material}
                  onValueChange={(value) => setConfig({
                    ...config,
                    material_config: { ...config.material_config, shelf_material: value }
                  })}
                >
                  <SelectTrigger id="shelf_material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.filter(m => m.category === 'panel').map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} - {material.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edge_banding">Edge Banding</Label>
                <Select
                  value={config.edge_banding}
                  onValueChange={(value) => setConfig({ ...config, edge_banding: value })}
                >
                  <SelectTrigger id="edge_banding">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PVC">PVC</SelectItem>
                    <SelectItem value="ABS">ABS</SelectItem>
                    <SelectItem value="veneer">Veneer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="finish">Finish</Label>
                <Select
                  value={config.finish}
                  onValueChange={(value) => setConfig({ ...config, finish: value })}
                >
                  <SelectTrigger id="finish">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matte">Matte</SelectItem>
                    <SelectItem value="glossy">Glossy</SelectItem>
                    <SelectItem value="textured">Textured</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual Preview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Cabinet Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <InteractiveCabinetVisualizer 
                config={config}
                selectedCompartmentId={selectedCompartmentId || undefined}
                onCompartmentSelect={setSelectedCompartmentId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Module Editor */}
        <div className="lg:col-span-1">
          <ModuleEditor
            compartment={selectedCompartment}
            materials={materials}
            onUpdateCompartment={handleUpdateCompartment}
          />
        </div>
      </div>
    </div>
  );
}
