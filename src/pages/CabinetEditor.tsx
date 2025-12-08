import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  // Legacy fields for backwards compatibility
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
  const { createLocalizedPath } = useLanguage();
  const [model, setModel] = useState<CabinetModel | null>(null);
  const [materials, setMaterials] = useState<CabinetMaterial[]>([]);
  const [projectModels, setProjectModels] = useState<ProjectModel[]>([]);
  const [legraboxConfigs, setLegraboxConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('structure');
  const [selectedProjectModelId, setSelectedProjectModelId] = useState<string | null>(null);
  
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

  // Store model parameters for price calculation
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
        legraboxConfigs,
      });
      setCostBreakdown(costs);
    }
  }, [config, materials, panels, fronts, compartments, modelHardware, frontHardware, laborConfig, legraboxConfigs]);

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
      
      // Load parametric elements from model
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
      
      // Extract front hardware from fronts and fetch product prices
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
      
      // Fetch product prices for front hardware
      if (productIds.length > 0) {
        const uniqueProductIds = [...new Set(productIds)];
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price_per_unit')
          .in('id', uniqueProductIds);
        
        const productMap = new Map(products?.map(p => [p.id, p]) || []);
        
        // Attach product data to front hardware items
        const enrichedFrontHardware = frontHardwareItems.map(hw => ({
          ...hw,
          products: productMap.get(hw.product_id) || null,
        }));
        
        setFrontHardware(enrichedFrontHardware);
      } else {
        setFrontHardware([]);
      }

      // If editing existing configuration, load it
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
            // Load project model ID if saved
            if (existingConfig.project_model_id) {
              setSelectedProjectModelId(existingConfig.project_model_id);
            }
          }
        } catch (err) {
          console.error('Error loading existing config:', err);
        }
      } else if (modelData) {
        // Set default values from model for new configuration
        const initialCompartment: Compartment = {
          id: uuidv4(),
          x: 0,
          y: 0,
          width: modelData.default_width || 800,
          height: modelData.default_height || 2000,
          modules: [],
        };

        // Check for default project model
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
    
    toast({ title: `Applied "${projectModel.name}" settings` });
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
        // Update existing configuration
        await cabinetService.updateConfiguration(configId, configData);
        toast({
          title: 'Success',
          description: 'Cabinet configuration updated',
        });
      } else {
        // Create new configuration
        await cabinetService.createConfiguration({
          project_id: projectId,
          model_id: modelId,
          ...configData,
        });
        toast({
          title: 'Success',
          description: 'Cabinet configuration saved',
        });
      }
      
      navigate(createLocalizedPath(`/calculation/project/${projectId}`));
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

  // Validate dimensions against model constraints
  const validateDimension = (value: number, min?: number | null, max?: number | null) => {
    if (min && value < min) return min;
    if (max && value > max) return max;
    return value;
  };

  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">{t('calc_loading_editor')}</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">{t('calc_model_not_found')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(createLocalizedPath(`/calculation/project/${projectId}/library`))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('calc_back_to_library')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t('calc_saving') : t('calc_save_configuration')}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{t('calc_configure_cabinet')}</h1>
        <p className="text-muted-foreground mt-2">
          {model.name} - {model.category}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Properties & Project Model */}
        <div className="space-y-6">
          {/* Project Model Selection */}
          {projectModels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('calc_project_model')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedProjectModelId || 'none'}
                  onValueChange={(v) => v !== 'none' && handleProjectModelSelect(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('calc_select_project_model')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('calc_none_manual')}</SelectItem>
                    {projectModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.is_default && `(${t('calc_default')})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('calc_select_model_desc')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cabinet Structure */}
          <Card>
            <CardHeader>
              <CardTitle>{t('calc_cabinet_structure')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">{t('calc_cabinet_name')}</Label>
                <Input
                  id="name"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder={t('calc_enter_cabinet_name')}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="width">{t('calc_width')}</Label>
                  <Input
                    id="width"
                    type="number"
                    value={config.width}
                    onChange={(e) => setConfig({ ...config, width: Number(e.target.value) })}
                    onBlur={(e) => setConfig({ 
                      ...config, 
                      width: validateDimension(Number(e.target.value), model.min_width, model.max_width)
                    })}
                    min={model.min_width || 0}
                    max={model.max_width || undefined}
                  />
                  {model.min_width && model.max_width && (
                    <span className="text-xs text-muted-foreground">{model.min_width}-{model.max_width}</span>
                  )}
                </div>
                <div>
                  <Label htmlFor="height">{t('calc_height')}</Label>
                  <Input
                    id="height"
                    type="number"
                    value={config.height}
                    onChange={(e) => setConfig({ ...config, height: Number(e.target.value) })}
                    onBlur={(e) => setConfig({ 
                      ...config, 
                      height: validateDimension(Number(e.target.value), model.min_height, model.max_height)
                    })}
                    min={model.min_height || 0}
                    max={model.max_height || undefined}
                  />
                  {model.min_height && model.max_height && (
                    <span className="text-xs text-muted-foreground">{model.min_height}-{model.max_height}</span>
                  )}
                </div>
                <div>
                  <Label htmlFor="depth">{t('calc_depth')}</Label>
                  <Input
                    id="depth"
                    type="number"
                    value={config.depth}
                    onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })}
                    onBlur={(e) => setConfig({ 
                      ...config, 
                      depth: validateDimension(Number(e.target.value), model.min_depth, model.max_depth)
                    })}
                    min={model.min_depth || 0}
                    max={model.max_depth || undefined}
                  />
                  {model.min_depth && model.max_depth && (
                    <span className="text-xs text-muted-foreground">{model.min_depth}-{model.max_depth}</span>
                  )}
                </div>
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
              <CardTitle>{t('calc_materials')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="body_material">{t('calc_body_material')}</Label>
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
                    <SelectValue placeholder={t('calc_select_body_material')} />
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
                <Label htmlFor="door_material">{t('calc_door_material')}</Label>
                <Select
                  value={config.material_config.door_material}
                  onValueChange={(value) => setConfig({
                    ...config,
                    material_config: { ...config.material_config, door_material: value }
                  })}
                >
                <SelectTrigger id="door_material">
                    <SelectValue placeholder={t('calc_select_door_material')} />
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
                <Label htmlFor="shelf_material">{t('calc_shelf_material')}</Label>
                <Select
                  value={config.material_config.shelf_material}
                  onValueChange={(value) => setConfig({
                    ...config,
                    material_config: { ...config.material_config, shelf_material: value }
                  })}
                >
                <SelectTrigger id="shelf_material">
                    <SelectValue placeholder={t('calc_select_shelf_material')} />
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edge_banding">{t('calc_edge_banding')}</Label>
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
                  <Label htmlFor="finish">{t('calc_finish')}</Label>
                  <Select
                    value={config.finish}
                    onValueChange={(value) => setConfig({ ...config, finish: value })}
                  >
                    <SelectTrigger id="finish">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matte">{t('calc_matte')}</SelectItem>
                      <SelectItem value="glossy">{t('calc_gloss')}</SelectItem>
                      <SelectItem value="textured">{t('calc_textured')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: 3D Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('calc_3d_preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Interactive3DCabinetVisualizer 
                config={config}
                materials={materials}
                panels={panels}
                fronts={fronts}
                compartments={compartments}
                legraboxConfigs={legraboxConfigs}
              />
            </CardContent>
          </Card>

          {/* Component Configuration Tabs */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="structure">{t('calc_structure')}</TabsTrigger>
                  <TabsTrigger value="fronts">{t('calc_fronts')}</TabsTrigger>
                  <TabsTrigger value="compartments">{t('interior')}</TabsTrigger>
                </TabsList>

                <TabsContent value="structure" className="mt-4">
                  <Enhanced2DVisualizer 
                    config={config}
                    panels={panels}
                    fronts={fronts}
                    compartments={compartments}
                    selectedCompartmentId={selectedCompartmentId || undefined}
                    onCompartmentSelect={setSelectedCompartmentId}
                    legraboxConfigs={legraboxConfigs}
                    onItemUpdate={(compartmentId, itemId, updates) => {
                      setCompartments(prev => prev.map(comp => {
                        if (comp.id === compartmentId) {
                          return {
                            ...comp,
                            items: comp.items.map((item: any) => 
                              item.id === itemId ? { ...item, ...updates } : item
                            )
                          };
                        }
                        return comp;
                      }));
                    }}
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
                </TabsContent>

                <TabsContent value="fronts" className="mt-4">
                  <FrontBuilder
                    modelId={modelId}
                    fronts={fronts}
                    onFrontsChange={setFronts}
                  />
                </TabsContent>

                <TabsContent value="compartments" className="mt-4">
                  <EnhancedCompartmentBuilder
                    modelId={modelId}
                    compartments={compartments}
                    onCompartmentsChange={setCompartments}
                    cabinetDepth={config.depth}
                  />
                  
                  {/* Drawer Summary with Accessories */}
                  {(() => {
                    const drawers = compartments.flatMap(c => 
                      c.items.filter((i: any) => i.item_type === 'legrabox_drawer')
                    );
                    if (drawers.length === 0) return null;
                    
                    return (
                      <Card className="mt-4">
                        <CardHeader>
                          <CardTitle className="text-base">Drawer Accessories Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {drawers.map((drawer: any, index: number) => {
                              const legrabox = legraboxConfigs.find((c: any) => c.id === drawer.legrabox_id);
                              const matCost = drawer.has_antislip_mat && legrabox ? (legrabox.antislip_mat_cost || 0) : 0;
                              const tipOnCost = drawer.has_tip_on && legrabox ? (legrabox.tip_on_cost || 0) : 0;
                              
                              return (
                                <div key={drawer.id} className="flex items-center justify-between p-2 border rounded">
                                  <div className="flex items-center gap-4">
                                    <span className="font-medium">Drawer {index + 1}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {legrabox?.name || 'Not configured'} 
                                      {drawer.legrabox_height_type && ` (${drawer.legrabox_height_type})`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    {drawer.has_antislip_mat && (
                                      <Badge variant="secondary">Mat +€{matCost.toFixed(2)}</Badge>
                                    )}
                                    {drawer.has_tip_on && (
                                      <Badge variant="secondary">TIP-ON +€{tipOnCost.toFixed(2)}</Badge>
                                    )}
                                    <span className="font-medium">
                                      €{((legrabox?.price || 0) + matCost + tipOnCost).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          {costBreakdown && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t('cost_breakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('materials_cost')}</span>
                      <span className="font-medium">€{costBreakdown.materials_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('hardware_cost')}</span>
                      <span className="font-medium">€{costBreakdown.hardware_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('labor')} ({costBreakdown.labor_minutes} min)</span>
                      <span className="font-medium">€{costBreakdown.labor_cost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">€{costBreakdown.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('calc_overhead')} ({costBreakdown.overhead_percentage}%)</span>
                      <span className="font-medium">€{costBreakdown.overhead_cost.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>{t('total')}</span>
                      <span className="text-primary">€{costBreakdown.total_cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
