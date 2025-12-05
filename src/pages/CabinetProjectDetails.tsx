import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cabinetService } from '@/services/cabinetService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProjectModelManager } from '@/components/cabinet/ProjectModelManager';
import { CabinetConfigurationCard } from '@/components/cabinet/CabinetConfigurationCard';
import { ProjectPricingSummary } from '@/components/cabinet/ProjectPricingSummary';
import type { Database } from '@/integrations/supabase/types';

type CabinetProject = Database['public']['Tables']['cabinet_projects']['Row'];
type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];

interface ModelParameters {
  panels?: any[];
  fronts?: any[];
  compartments?: any[];
  hardware?: any[];
  laborConfig?: any;
  frontHardware?: any[];
}

export default function CabinetProjectDetails() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [project, setProject] = useState<CabinetProject | null>(null);
  const [configurations, setConfigurations] = useState<CabinetConfiguration[]>([]);
  const [modelParametersMap, setModelParametersMap] = useState<Record<string, ModelParameters>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;
    
    try {
      const [projectData, configurationsData, materialsData] = await Promise.all([
        cabinetService.getProject(projectId),
        cabinetService.getProjectConfigurations(projectId),
        cabinetService.getAllMaterials(),
      ]);
      setProject(projectData);
      setConfigurations(configurationsData);
      setMaterials(materialsData);

      // Load model parameters for each unique model
      const modelIds = [...new Set(configurationsData.map(c => c.model_id).filter(Boolean))] as string[];
      const parametersMap: Record<string, ModelParameters> = {};
      
      await Promise.all(modelIds.map(async (modelId) => {
        try {
          const model = await cabinetService.getModel(modelId);
          
          if (model?.parameters) {
            const params = typeof model.parameters === 'string' 
              ? JSON.parse(model.parameters) 
              : model.parameters;
            
            // Extract front hardware from fronts and fetch product prices
            const fronts = (params as any).fronts || [];
            const frontHardwareItems: any[] = [];
            const productIds: string[] = [];
            
            fronts.forEach((front: any) => {
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
            
            let enrichedFrontHardware: any[] = [];
            if (productIds.length > 0) {
              const uniqueProductIds = [...new Set(productIds)];
              const { data: products } = await supabase
                .from('products')
                .select('id, name, price_per_unit')
                .in('id', uniqueProductIds);
              
              const productMap = new Map(products?.map(p => [p.id, p]) || []);
              
              enrichedFrontHardware = frontHardwareItems.map(hw => ({
                ...hw,
                products: productMap.get(hw.product_id) || null,
              }));
            }
            
            // Include front hardware in parameters
            parametersMap[modelId] = {
              ...params as ModelParameters,
              frontHardware: enrichedFrontHardware,
            };
          }
        } catch (err) {
          console.error(`Error loading model ${modelId}:`, err);
        }
      }));
      
      setModelParametersMap(parametersMap);
    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_failed_load_projects'),
        variant: 'destructive',
      });
      navigate(createLocalizedPath('/calculation'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">{t('calc_loading_project')}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">{t('calc_project_not_found')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(createLocalizedPath('/calculation'))}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('calc_back_to_projects')}
      </Button>

      <div>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-2">
          {project.client_name || t('calc_no_client_specified')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('calc_project_information')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc_status')}:</span>
              <span className="font-medium capitalize">{project.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc_project_number')}:</span>
              <span>{project.project_number || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc_currency')}:</span>
              <span>{project.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc_units')}:</span>
              <span className="capitalize">{project.units}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc_created')}:</span>
              <span>{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('calc_client_information')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-muted-foreground block mb-1">{t('calc_name')}:</span>
              <span>{project.client_name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">{t('calc_address')}:</span>
              <span>{project.client_address || '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {project.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('calc_notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{project.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Project Models */}
      <ProjectModelManager projectId={projectId!} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('calc_cabinet_configurations')}</CardTitle>
          <Button onClick={() => navigate(createLocalizedPath(`/calculation/project/${projectId}/library`))}>
            <Plus className="mr-2 h-4 w-4" />
            {t('calc_add_cabinet')}
          </Button>
        </CardHeader>
        <CardContent>
          {configurations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('calc_no_cabinets_yet')}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {configurations.map((config) => (
                <CabinetConfigurationCard
                  key={config.id}
                  config={config}
                  modelParameters={config.model_id ? modelParametersMap[config.model_id] : undefined}
                  materials={materials}
                  onEdit={() => navigate(createLocalizedPath(`/calculation/project/${projectId}/editor/${config.model_id}?configId=${config.id}`))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Summary */}
      <ProjectPricingSummary
        configurations={configurations}
        modelParametersMap={modelParametersMap}
        materials={materials}
        currency={project.currency}
      />
    </div>
  );
}
