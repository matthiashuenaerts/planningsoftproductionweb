import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PanelBuilder } from '@/components/cabinet/PanelBuilder';
import { Enhanced3DCabinetVisualizer } from '@/components/cabinet/Enhanced3DCabinetVisualizer';
import { cabinetService } from '@/services/cabinetService';
import { ParametricPanel, CabinetConfiguration } from '@/types/cabinet';
import { supabase } from '@/integrations/supabase/client';

export default function CabinetModelBuilder() {
  const { modelId } = useParams<{ modelId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [modelData, setModelData] = useState({
    name: '',
    category: 'wardrobe',
    description: '',
    default_width: 800,
    default_height: 2000,
    default_depth: 600,
    min_width: 400,
    max_width: 3000,
    min_height: 500,
    max_height: 3000,
    min_depth: 300,
    max_depth: 800,
  });
  
  const [panels, setPanels] = useState<ParametricPanel[]>([]);
  
  // Preview config for 3D view
  const previewConfig: CabinetConfiguration = {
    name: modelData.name,
    width: modelData.default_width,
    height: modelData.default_height,
    depth: modelData.default_depth,
    material_config: {
      body_material: materials[0]?.id || '',
      door_material: materials[0]?.id || '',
      shelf_material: materials[0]?.id || '',
      body_thickness: 18,
      door_thickness: 18,
      shelf_thickness: 18,
    },
    edge_banding: 'PVC',
    finish: 'matte',
    door_type: 'hinged',
    compartments: [],
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const loadData = async () => {
    try {
      const materialsData = await cabinetService.getAllMaterials();
      setMaterials(materialsData);
      
      if (modelId) {
        const model = await cabinetService.getModel(modelId);
        if (model) {
          setModelData({
            name: model.name,
            category: model.category,
            description: model.description || '',
            default_width: model.default_width || 800,
            default_height: model.default_height || 2000,
            default_depth: model.default_depth || 600,
            min_width: model.min_width || 400,
            max_width: model.max_width || 3000,
            min_height: model.min_height || 500,
            max_height: model.max_height || 3000,
            min_depth: model.min_depth || 300,
            max_depth: model.max_depth || 800,
          });
          
          // Load panels from model parameters
          if (model.parameters && typeof model.parameters === 'object' && 'panels' in model.parameters) {
            setPanels((model.parameters as any).panels || []);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load model data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parameters = { panels } as any;
      
      if (modelId) {
        // Update existing model
        const { error } = await supabase
          .from('cabinet_models')
          .update({
            name: modelData.name,
            category: modelData.category,
            description: modelData.description,
            default_width: modelData.default_width,
            default_height: modelData.default_height,
            default_depth: modelData.default_depth,
            min_width: modelData.min_width,
            max_width: modelData.max_width,
            min_height: modelData.min_height,
            max_height: modelData.max_height,
            min_depth: modelData.min_depth,
            max_depth: modelData.max_depth,
            parameters,
            updated_at: new Date().toISOString(),
          })
          .eq('id', modelId);
        
        if (error) throw error;
      } else {
        // Create new model
        const { error } = await supabase
          .from('cabinet_models')
          .insert({
            name: modelData.name,
            category: modelData.category,
            description: modelData.description,
            default_width: modelData.default_width,
            default_height: modelData.default_height,
            default_depth: modelData.default_depth,
            min_width: modelData.min_width,
            max_width: modelData.max_width,
            min_height: modelData.min_height,
            max_height: modelData.max_height,
            min_depth: modelData.min_depth,
            max_depth: modelData.max_depth,
            parameters,
            is_active: true,
            is_template: true,
          });
        
        if (error) throw error;
      }
      
      toast({
        title: 'Success',
        description: 'Cabinet model saved successfully',
      });
      
      navigate('/settings');
    } catch (error) {
      console.error('Error saving model:', error);
      toast({
        title: 'Error',
        description: 'Failed to save cabinet model',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/settings')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">
          {modelId ? 'Edit' : 'Create'} Cabinet Model
        </h1>
        <p className="text-muted-foreground mt-2">
          Define parametric panels that adapt to cabinet dimensions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Properties */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Model Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Model Name</Label>
              <Input
                value={modelData.name}
                onChange={(e) => setModelData({ ...modelData, name: e.target.value })}
                placeholder="e.g., Standard Wardrobe"
              />
            </div>
            
            <div>
              <Label>Category</Label>
              <Input
                value={modelData.category}
                onChange={(e) => setModelData({ ...modelData, category: e.target.value })}
                placeholder="e.g., wardrobe, kitchen"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={modelData.description}
                onChange={(e) => setModelData({ ...modelData, description: e.target.value })}
                placeholder="Describe this cabinet model..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Default Dimensions (mm)</h4>
              <div>
                <Label>Width</Label>
                <Input
                  type="number"
                  value={modelData.default_width}
                  onChange={(e) => setModelData({ ...modelData, default_width: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Height</Label>
                <Input
                  type="number"
                  value={modelData.default_height}
                  onChange={(e) => setModelData({ ...modelData, default_height: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Depth</Label>
                <Input
                  type="number"
                  value={modelData.default_depth}
                  onChange={(e) => setModelData({ ...modelData, default_depth: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Size Constraints</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Min Width</Label>
                  <Input
                    type="number"
                    value={modelData.min_width}
                    onChange={(e) => setModelData({ ...modelData, min_width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Width</Label>
                  <Input
                    type="number"
                    value={modelData.max_width}
                    onChange={(e) => setModelData({ ...modelData, max_width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Min Height</Label>
                  <Input
                    type="number"
                    value={modelData.min_height}
                    onChange={(e) => setModelData({ ...modelData, min_height: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Height</Label>
                  <Input
                    type="number"
                    value={modelData.max_height}
                    onChange={(e) => setModelData({ ...modelData, max_height: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Min Depth</Label>
                  <Input
                    type="number"
                    value={modelData.min_depth}
                    onChange={(e) => setModelData({ ...modelData, min_depth: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Depth</Label>
                  <Input
                    type="number"
                    value={modelData.max_depth}
                    onChange={(e) => setModelData({ ...modelData, max_depth: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3D Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>3D Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <Enhanced3DCabinetVisualizer
              config={previewConfig}
              materials={materials}
              panels={panels}
            />
          </CardContent>
        </Card>
      </div>

      {/* Panel Builder */}
      <PanelBuilder
        panels={panels}
        onPanelsChange={setPanels}
        onSave={handleSave}
      />
    </div>
  );
}
