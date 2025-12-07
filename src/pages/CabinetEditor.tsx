import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, ChevronDown, ChevronUp, Ruler, Palette, Box, DoorOpen, Grid3X3 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import { Interactive3DCabinetVisualizer } from '@/components/cabinet/Interactive3DCabinetVisualizer';
import { Enhanced2DVisualizer } from '@/components/cabinet/Enhanced2DVisualizer';
import { ModuleEditor } from '@/components/cabinet/ModuleEditor';
import { FrontBuilder } from '@/components/cabinet/FrontBuilder';
import { EnhancedCompartmentBuilder } from '@/components/cabinet/EnhancedCompartmentBuilder';
import type { Database } from '@/integrations/supabase/types';
import { CabinetConfiguration, Compartment, ParametricPanel } from '@/types/cabinet';
import { CabinetCalculationService } from '@/services/cabinetCalculationService';
import { v4 as uuidv4 } from 'uuid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];
type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

interface ProjectModel {
  id: string;
  project_id: string;
  name: string;
  body_material_id?: string;
  door_material_id?: string;
  shelf_material_id?: string;
  edge_banding: string;
  finish: string;
  plinth_height: number;
  body_thickness: number;
  door_thickness: number;
  shelf_thickness: number;
  is_default: boolean;
}

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
  hardware?: any[];
  quantity: number;
  material_type: string;
  visible: boolean;
}

interface CompartmentData {
  id: string;
  name: string;
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  depth: string;
  items: any[];
}

interface ModelHardware {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: string;
  unit_price: number;
  notes: string;
}

interface LaborLine {
  id: string;
  name: string;
  formula: string;
  unit: 'minutes' | 'euros';
}

interface LaborConfig {
  hourly_rate: number;
  lines?: LaborLine[];
  base_minutes?: number;
  per_panel_minutes?: number;
  per_front_minutes?: number;
  per_compartment_item_minutes?: number;
}

export default function CabinetEditor() {
  const { projectId, modelId } = useParams<{ projectId: string; modelId: string }>();
  const [searchParams] = useSearchParams();
  const configId = searchParams.get('configId');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createLocalizedPath, t } = useLanguage();
  const [model, setModel] = useState<CabinetModel | null>(null);
  const [materials, setMaterials] = useState<CabinetMaterial[]>([]);
  const [projectModels, setProjectModels] = useState<ProjectModel[]>([]);
  const [legraboxConfigs, setLegraboxConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('3d');
  const [selectedProjectModelId, setSelectedProjectModelId] = useState<string | null>(null);
  
  // Collapsible sections state
  const [dimensionsOpen, setDimensionsOpen] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [interiorOpen, setInteriorOpen] = useState(false);
  
  // Parametric elements from model
  const [panels, setPanels] = useState<ParametricPanel[]>([]);
  const [fronts, setFronts] = useState<CabinetFront[]>([]);
  const [compartments, setCompartments] = useState<CompartmentData[]>([]);
  
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

  const [modelHardware, setModelHardware] = useState<ModelHardware[]>([]);
  const [frontHardware, setFrontHardware] = useState<any[]>([]);
  const [laborConfig, setLaborConfig] = useState<LaborConfig>({
    hourly_rate: 45,
    lines: [
      { id: '1', name: 'Base Assembly', formula: '30', unit: 'minutes' },
      { id: '2', name: 'Panel Work', formula: 'panels * 5', unit: 'minutes' },
      { id: '3', name: 'Front Installation', formula: 'fronts * 15', unit: 'minutes' },
      { id: '4', name: 'Interior Items', formula: 'compartment_items * 10', unit: 'minutes' },
    ],
  });

  useEffect(() => {
    loadData();
  }, [modelId, projectId]);

  useEffect(() => {
    if (materials.length > 0 && config.material_config.body_material) {
      const calculator = new CabinetCalculationService(materials);
      const costs = calculator.calculateCostsWithModel(config, {
        panels,
        fronts,
        parametric_compartments: compartments,
        hardware: modelHardware,
        frontHardware,
        laborConfig,
      });
      setCostBreakdown(costs);
    }
  }, [config, materials, panels, fronts, compartments, modelHardware, frontHardware, laborConfig]);

  const loadData = async () => {
    if (!modelId || !projectId) return;
    
    try {
      const [modelData, materialsData, projectModelsData, legraboxData] = await Promise.all([
        cabinetService.getModel(modelId),
        cabinetService.getAllMaterials(),
        supabase
          .from('project_models')
          .select('*')
          .eq('project_id', projectId)
          .order('is_default', { ascending: false }),
        supabase
          .from('legrabox_configurations')
          .select('*')
          .eq('is_active', true),
      ]);
      
      setModel(modelData);
      setMaterials(materialsData);
      setProjectModels(projectModelsData.data || []);
      setLegraboxConfigs(legraboxData.data || []);
      
      let loadedFronts: CabinetFront[] = [];
      if (modelData?.parameters && typeof modelData.parameters === 'object') {
        const params = modelData.parameters as any;
        if (params.panels) setPanels(params.panels);
        if (params.fronts) {
          loadedFronts = params.fronts;
          setFronts(params.fronts);
        }
        if (params.compartments) setCompartments(params.compartments);
        if (params.hardware) setModelHardware(params.hardware);
        if (params.laborConfig) setLaborConfig(params.laborConfig);
      }
      
      const frontHardwareItems: any[] = [];
      const productIds: string[] = [];
      
      loadedFronts.forEach((front: any) => {
        if (front.hardware && Array.isArray(front.hardware)) {
          front.hardware.forEach((hw: any) => {
            if (hw.product_id) {
              productIds.push(hw.product_id);
              frontHardwareItems.push({
                ...hw,
                front_id: front.id,
              });
            }
          });
        }
      });
      
      if (productIds.length > 0) {
        const uniqueProductIds = [...new Set(productIds)];
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price_per_unit')
          .in('id', uniqueProductIds);
        
        const productMap = new Map(products?.map(p => [p.id, p]) || []);
        
        const enrichedFrontHardware = frontHardwareItems.map(hw => ({
          ...hw,
          products: productMap.get(hw.product_id) || null,
        }));
        
        setFrontHardware(enrichedFrontHardware);
      } else {
        setFrontHardware([]);
      }

      if (configId) {
        try {
          const existingConfig = await cabinetService.getConfiguration(configId);
          if (existingConfig) {
            const params = existingConfig.parameters as any;
            setConfig({
              name: existingConfig.name,
              width: existingConfig.width,
              height: existingConfig.height,
              depth: existingConfig.depth,
              material_config: existingConfig.material_config as any || {
                body_material: '',
                door_material: '',
                shelf_material: '',
                body_thickness: 18,
                door_thickness: 18,
                shelf_thickness: 18,
              },
              edge_banding: existingConfig.edge_banding || 'PVC',
              finish: existingConfig.finish || 'matte',
              door_type: existingConfig.door_type || 'hinged',
              compartments: params?.compartments || [],
            });
            if (params?.fronts) setFronts(params.fronts);
            if (params?.panels) setPanels(params.panels);
            if (params?.parametric_compartments) setCompartments(params.parametric_compartments);
            if (existingConfig.project_model_id) {
              setSelectedProjectModelId(existingConfig.project_model_id);
            }
          }
        } catch (err) {
          console.error('Error loading existing config:', err);
        }
      } else if (modelData) {
        const initialCompartment: Compartment = {
          id: uuidv4(),
          x: 0,
          y: 0,
          width: modelData.default_width || 800,
          height: modelData.default_height || 2000,
          modules: [],
        };

        const defaultModel = projectModelsData.data?.find((m: ProjectModel) => m.is_default);
        
        setConfig(prev => ({
          ...prev,
          name: modelData.name,
          width: modelData.default_width || prev.width,
          height: modelData.default_height || prev.height,
          depth: modelData.default_depth || prev.depth,
          compartments: [initialCompartment],
          ...(defaultModel && {
            material_config: {
              body_material: defaultModel.body_material_id || '',
              door_material: defaultModel.door_material_id || '',
              shelf_material: defaultModel.shelf_material_id || '',
              body_thickness: defaultModel.body_thickness,
              door_thickness: defaultModel.door_thickness,
              shelf_thickness: defaultModel.shelf_thickness,
            },
            edge_banding: defaultModel.edge_banding,
            finish: defaultModel.finish,
          }),
        }));
        
        if (defaultModel) {
          setSelectedProjectModelId(defaultModel.id);
        }
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

  const handleProjectModelSelect = (modelId: string) => {
    const projectModel = projectModels.find(m => m.id === modelId);
    if (!projectModel) return;
    
    setSelectedProjectModelId(modelId);
    setConfig(prev => ({
      ...prev,
      material_config: {
        body_material: projectModel.body_material_id || '',
        door_material: projectModel.door_material_id || '',
        shelf_material: projectModel.shelf_material_id || '',
        body_thickness: projectModel.body_thickness,
        door_thickness: projectModel.door_thickness,
        shelf_thickness: projectModel.shelf_thickness,
      },
      edge_banding: projectModel.edge_banding,
      finish: projectModel.finish,
    }));
    
    toast({ title: `Instellingen "${projectModel.name}" toegepast` });
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
      const configData = {
        name: config.name,
        width: config.width,
        height: config.height,
        depth: config.depth,
        horizontal_divisions: 0,
        vertical_divisions: 0,
        drawer_count: config.compartments.reduce((sum, c) => 
          sum + c.modules.filter(m => m.type === 'drawer').length, 0
        ),
        door_type: config.door_type,
        material_config: config.material_config as any,
        edge_banding: config.edge_banding,
        finish: config.finish,
        project_model_id: selectedProjectModelId || null,
        parameters: { 
          compartments: config.compartments,
          fronts,
          panels,
          parametric_compartments: compartments,
          hardware: modelHardware,
          laborConfig,
        } as any,
      };

      if (configId) {
        await cabinetService.updateConfiguration(configId, configData);
        toast({
          title: 'Succes',
          description: 'Kastconfiguratie bijgewerkt',
        });
      } else {
        await cabinetService.createConfiguration({
          project_id: projectId,
          model_id: modelId,
          ...configData,
        });
        toast({
          title: 'Succes',
          description: 'Kastconfiguratie opgeslagen',
        });
      }
      
      navigate(createLocalizedPath(`/calculation/project/${projectId}`));
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Fout',
        description: 'Kon configuratie niet opslaan',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const validateDimension = (value: number, min?: number | null, max?: number | null) => {
    if (min && value < min) return min;
    if (max && value > max) return max;
    return value;
  };

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.name || 'Geen geselecteerd';
  };

  const getMaterialColor = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.color || '#e5e7eb';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Configurator laden...</p>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Model niet gevonden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(createLocalizedPath(`/calculation/project/${projectId}/library`))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <Input
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="text-lg font-semibold border-none bg-transparent h-auto p-0 focus-visible:ring-0"
                placeholder="Kastnaam"
              />
              <p className="text-xs text-muted-foreground">{model.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {costBreakdown && (
              <Badge variant="secondary" className="text-lg px-4 py-2">
                €{costBreakdown.total_cost.toFixed(2)}
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left Sidebar - Configuration */}
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-4 space-y-3">
            
            {/* Quick Project Model Selection */}
            {projectModels.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <Label className="text-xs text-muted-foreground mb-2 block">Project Sjabloon</Label>
                <Select
                  value={selectedProjectModelId || 'none'}
                  onValueChange={(v) => v !== 'none' && handleProjectModelSelect(v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecteer sjabloon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Handmatig configureren</SelectItem>
                    {projectModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.is_default && '(Standaard)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dimensions Section */}
            <Collapsible open={dimensionsOpen} onOpenChange={setDimensionsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    <span className="font-medium">Afmetingen</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {config.width} × {config.height} × {config.depth}
                    </span>
                    {dimensionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                {/* Width */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Breedte</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={config.width}
                        onChange={(e) => setConfig({ ...config, width: Number(e.target.value) })}
                        onBlur={(e) => setConfig({ 
                          ...config, 
                          width: validateDimension(Number(e.target.value), model.min_width, model.max_width)
                        })}
                        className="w-20 h-8 text-right"
                      />
                      <span className="text-xs text-muted-foreground">mm</span>
                    </div>
                  </div>
                  <Slider
                    value={[config.width]}
                    onValueChange={([v]) => setConfig({ ...config, width: v })}
                    min={model.min_width || 300}
                    max={model.max_width || 1200}
                    step={10}
                    className="py-2"
                  />
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Hoogte</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={config.height}
                        onChange={(e) => setConfig({ ...config, height: Number(e.target.value) })}
                        onBlur={(e) => setConfig({ 
                          ...config, 
                          height: validateDimension(Number(e.target.value), model.min_height, model.max_height)
                        })}
                        className="w-20 h-8 text-right"
                      />
                      <span className="text-xs text-muted-foreground">mm</span>
                    </div>
                  </div>
                  <Slider
                    value={[config.height]}
                    onValueChange={([v]) => setConfig({ ...config, height: v })}
                    min={model.min_height || 500}
                    max={model.max_height || 2600}
                    step={10}
                    className="py-2"
                  />
                </div>

                {/* Depth */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Diepte</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={config.depth}
                        onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })}
                        onBlur={(e) => setConfig({ 
                          ...config, 
                          depth: validateDimension(Number(e.target.value), model.min_depth, model.max_depth)
                        })}
                        className="w-20 h-8 text-right"
                      />
                      <span className="text-xs text-muted-foreground">mm</span>
                    </div>
                  </div>
                  <Slider
                    value={[config.depth]}
                    onValueChange={([v]) => setConfig({ ...config, depth: v })}
                    min={model.min_depth || 300}
                    max={model.max_depth || 700}
                    step={10}
                    className="py-2"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Materials Section */}
            <Collapsible open={materialsOpen} onOpenChange={setMaterialsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="font-medium">Materialen</span>
                  </div>
                  {materialsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                {/* Body Material */}
                <div className="space-y-2">
                  <Label className="text-sm">Korpus</Label>
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
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: getMaterialColor(config.material_config.body_material) }}
                        />
                        <SelectValue placeholder="Selecteer materiaal" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {materials.filter(m => m.category === 'panel').map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: material.color || '#e5e7eb' }}
                            />
                            {material.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Door Material */}
                <div className="space-y-2">
                  <Label className="text-sm">Deuren</Label>
                  <Select
                    value={config.material_config.door_material}
                    onValueChange={(value) => setConfig({
                      ...config,
                      material_config: { ...config.material_config, door_material: value }
                    })}
                  >
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: getMaterialColor(config.material_config.door_material) }}
                        />
                        <SelectValue placeholder="Selecteer materiaal" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {materials.filter(m => m.category === 'panel').map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: material.color || '#e5e7eb' }}
                            />
                            {material.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Shelf Material */}
                <div className="space-y-2">
                  <Label className="text-sm">Legplanken</Label>
                  <Select
                    value={config.material_config.shelf_material}
                    onValueChange={(value) => setConfig({
                      ...config,
                      material_config: { ...config.material_config, shelf_material: value }
                    })}
                  >
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: getMaterialColor(config.material_config.shelf_material) }}
                        />
                        <SelectValue placeholder="Selecteer materiaal" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {materials.filter(m => m.category === 'panel').map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: material.color || '#e5e7eb' }}
                            />
                            {material.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Edge & Finish */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Kantafwerking</Label>
                    <Select
                      value={config.edge_banding}
                      onValueChange={(value) => setConfig({ ...config, edge_banding: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PVC">PVC</SelectItem>
                        <SelectItem value="ABS">ABS</SelectItem>
                        <SelectItem value="veneer">Fineer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Afwerking</Label>
                    <Select
                      value={config.finish}
                      onValueChange={(value) => setConfig({ ...config, finish: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matte">Mat</SelectItem>
                        <SelectItem value="glossy">Glanzend</SelectItem>
                        <SelectItem value="textured">Gestructureerd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Door Type */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Deurtype</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'hinged', label: 'Scharnierend' },
                  { value: 'sliding', label: 'Schuif' },
                  { value: 'none', label: 'Geen' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setConfig({ ...config, door_type: option.value })}
                    className={cn(
                      "px-3 py-2 text-xs rounded-md border transition-colors",
                      config.door_type === option.value 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interior Section */}
            <Collapsible open={interiorOpen} onOpenChange={setInteriorOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-primary" />
                    <span className="font-medium">Interieur</span>
                  </div>
                  {interiorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <EnhancedCompartmentBuilder
                  modelId={modelId}
                  compartments={compartments}
                  onCompartmentsChange={setCompartments}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Cost Summary */}
            {costBreakdown && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Materiaal</span>
                  <span>€{costBreakdown.materials_cost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Beslag</span>
                  <span>€{costBreakdown.hardware_cost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Arbeid ({costBreakdown.labor_minutes} min)</span>
                  <span>€{costBreakdown.labor_cost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overhead</span>
                  <span>€{costBreakdown.overhead_cost.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between font-bold">
                  <span>Totaal</span>
                  <span className="text-primary text-lg">€{costBreakdown.total_cost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - 3D Preview */}
        <div className="flex-1 flex flex-col">
          {/* View Tabs */}
          <div className="border-b bg-card px-4 py-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="3d" className="gap-2">
                  <Box className="h-4 w-4" />
                  3D Weergave
                </TabsTrigger>
                <TabsTrigger value="2d" className="gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  2D Tekening
                </TabsTrigger>
                <TabsTrigger value="fronts" className="gap-2">
                  <DoorOpen className="h-4 w-4" />
                  Fronten
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* View Content */}
          <div className="flex-1 bg-muted/30">
            {activeTab === '3d' && (
              <div className="h-full">
                <Interactive3DCabinetVisualizer 
                  config={config}
                  materials={materials}
                  panels={panels}
                  fronts={fronts}
                  compartments={compartments}
                  legraboxConfigs={legraboxConfigs}
                />
              </div>
            )}
            
            {activeTab === '2d' && (
              <div className="h-full p-4 overflow-auto">
                <Enhanced2DVisualizer 
                  config={config}
                  panels={panels}
                  fronts={fronts}
                  compartments={compartments}
                  selectedCompartmentId={selectedCompartmentId || undefined}
                  onCompartmentSelect={setSelectedCompartmentId}
                />
                {selectedCompartment && (
                  <div className="mt-4">
                    <ModuleEditor
                      compartment={selectedCompartment}
                      materials={materials}
                      onUpdateCompartment={handleUpdateCompartment}
                    />
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'fronts' && (
              <div className="h-full p-4 overflow-auto">
                <FrontBuilder
                  modelId={modelId}
                  fronts={fronts}
                  onFrontsChange={setFronts}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
