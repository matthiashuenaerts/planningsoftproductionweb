import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PanelBuilder } from '@/components/cabinet/PanelBuilder';
import { FrontBuilder } from '@/components/cabinet/FrontBuilder';
import { EnhancedCompartmentBuilder } from '@/components/cabinet/EnhancedCompartmentBuilder';
import { LegraboxManager } from '@/components/cabinet/LegraboxManager';
import { ModelHardwareManager, ModelHardware } from '@/components/cabinet/ModelHardwareManager';
import { ModelCalculationSummary } from '@/components/cabinet/ModelCalculationSummary';
import { LaborPriceCalculator, LaborConfig } from '@/components/cabinet/LaborPriceCalculator';
import { Interactive3DCabinetVisualizer } from '@/components/cabinet/Interactive3DCabinetVisualizer';
import { cabinetService } from '@/services/cabinetService';
import { ParametricPanel, CabinetConfiguration } from '@/types/cabinet';
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

export default function CabinetModelBuilder() {
  const { modelId } = useParams<{ modelId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('panels');
  
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
  const [fronts, setFronts] = useState<CabinetFront[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [hardware, setHardware] = useState<ModelHardware[]>([]);
  const [laborConfig, setLaborConfig] = useState<LaborConfig>({
    base_minutes: 30,
    per_panel_minutes: 5,
    per_front_minutes: 15,
    per_compartment_item_minutes: 10,
    hourly_rate: 50,
  });
  
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
          
          // Load panels, fronts, compartments, hardware from model parameters
          if (model.parameters && typeof model.parameters === 'object') {
            const params = model.parameters as any;
            if (params.panels) setPanels(params.panels);
            if (params.fronts) setFronts(params.fronts);
            if (params.compartments) setCompartments(params.compartments);
            if (params.hardware) setHardware(params.hardware);
            if (params.laborConfig) setLaborConfig(params.laborConfig);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_failed_load_model'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parameters = { panels, fronts, compartments, hardware, laborConfig } as any;
      
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
        title: t('calc_success'),
        description: t('calc_model_saved'),
      });
      
      navigate(createLocalizedPath('/calculation'));
    } catch (error) {
      console.error('Error saving model:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_failed_save_model'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">{t('calc_loading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(createLocalizedPath('/calculation'))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('calc_back_to_library')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t('calc_saving') : t('calc_save_model')}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">
          {modelId ? t('calc_edit_cabinet_model') : t('calc_create_cabinet_model')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('calc_define_parametric')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Properties */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('calc_model_properties')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('calc_model_name')}</Label>
              <Input
                value={modelData.name}
                onChange={(e) => setModelData({ ...modelData, name: e.target.value })}
                placeholder={t('calc_model_name_placeholder')}
              />
            </div>
            
            <div>
              <Label>{t('calc_category')}</Label>
              <Input
                value={modelData.category}
                onChange={(e) => setModelData({ ...modelData, category: e.target.value })}
                placeholder={t('calc_category_placeholder')}
              />
            </div>
            
            <div>
              <Label>{t('calc_description')}</Label>
              <Textarea
                value={modelData.description}
                onChange={(e) => setModelData({ ...modelData, description: e.target.value })}
                placeholder={t('calc_describe_model')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">{t('calc_default_dimensions')}</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{t('calc_width')}</Label>
                  <Input
                    type="number"
                    value={modelData.default_width}
                    onChange={(e) => setModelData({ ...modelData, default_width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('calc_height')}</Label>
                  <Input
                    type="number"
                    value={modelData.default_height}
                    onChange={(e) => setModelData({ ...modelData, default_height: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('calc_depth')}</Label>
                  <Input
                    type="number"
                    value={modelData.default_depth}
                    onChange={(e) => setModelData({ ...modelData, default_depth: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">{t('calc_size_constraints')}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('calc_min_width')}</Label>
                  <Input
                    type="number"
                    value={modelData.min_width}
                    onChange={(e) => setModelData({ ...modelData, min_width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('calc_max_width')}</Label>
                  <Input
                    type="number"
                    value={modelData.max_width}
                    onChange={(e) => setModelData({ ...modelData, max_width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Min. {t('calc_height')}</Label>
                  <Input
                    type="number"
                    value={modelData.min_height}
                    onChange={(e) => setModelData({ ...modelData, min_height: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max. {t('calc_height')}</Label>
                  <Input
                    type="number"
                    value={modelData.max_height}
                    onChange={(e) => setModelData({ ...modelData, max_height: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Min. {t('calc_depth')}</Label>
                  <Input
                    type="number"
                    value={modelData.min_depth}
                    onChange={(e) => setModelData({ ...modelData, min_depth: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max. {t('calc_depth')}</Label>
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
            <CardTitle>{t('calc_3d_preview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Interactive3DCabinetVisualizer
              config={previewConfig}
              materials={materials}
              panels={panels}
              fronts={fronts}
              compartments={compartments}
            />
          </CardContent>
        </Card>
      </div>

      {/* Component Builders */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="panels">{t('calc_panels_tab')} ({panels.length})</TabsTrigger>
          <TabsTrigger value="fronts">{t('calc_fronts_tab')} ({fronts.length})</TabsTrigger>
          <TabsTrigger value="compartments">{t('calc_compartments_tab')}</TabsTrigger>
          <TabsTrigger value="hardware">{t('calc_hardware_tab')} ({hardware.length})</TabsTrigger>
          <TabsTrigger value="labor">{t('calc_labor_tab')}</TabsTrigger>
          <TabsTrigger value="calculation">{t('calc_calculation_tab')}</TabsTrigger>
          <TabsTrigger value="legrabox">{t('calc_legrabox_db_tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="panels" className="mt-6">
          <PanelBuilder
            panels={panels}
            onPanelsChange={setPanels}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="fronts" className="mt-6">
          <FrontBuilder
            modelId={modelId}
            fronts={fronts}
            onFrontsChange={setFronts}
          />
        </TabsContent>

        <TabsContent value="compartments" className="mt-6">
          <EnhancedCompartmentBuilder
            modelId={modelId}
            compartments={compartments}
            onCompartmentsChange={setCompartments}
            defaultWidth={modelData.default_width}
            defaultHeight={modelData.default_height}
            defaultDepth={modelData.default_depth}
          />
        </TabsContent>

        <TabsContent value="hardware" className="mt-6">
          <ModelHardwareManager
            hardware={hardware}
            onHardwareChange={setHardware}
          />
        </TabsContent>

        <TabsContent value="labor" className="mt-6">
          <div className="max-w-xl">
            <LaborPriceCalculator
              config={laborConfig}
              onChange={setLaborConfig}
            />
          </div>
        </TabsContent>

        <TabsContent value="calculation" className="mt-6">
          <ModelCalculationSummary
            modelData={modelData}
            panels={panels}
            fronts={fronts}
            compartments={compartments}
            hardware={hardware}
            laborConfig={laborConfig}
          />
        </TabsContent>

        <TabsContent value="legrabox" className="mt-6">
          <LegraboxManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
