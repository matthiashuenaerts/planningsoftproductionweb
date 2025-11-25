import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CabinetLibraryPanel } from './CabinetLibraryPanel';
import { CabinetParametersForm } from './CabinetParametersForm';
import { CabinetVisualViews } from './CabinetVisualViews';
import { CabinetQuotePanel } from './CabinetQuotePanel';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];
type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];

interface CabinetConfiguratorProps {
  projectId: string;
}

export function CabinetConfigurator({ projectId }: CabinetConfiguratorProps) {
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<CabinetConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<CabinetConfiguration | null>(null);
  const [models, setModels] = useState<CabinetModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [configsData, modelsData] = await Promise.all([
        cabinetService.getProjectConfigurations(projectId),
        cabinetService.getAllModels(),
      ]);
      setConfigurations(configsData);
      setModels(modelsData);
      if (configsData.length > 0) {
        setSelectedConfig(configsData[0]);
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

  const handleConfigurationUpdate = (config: CabinetConfiguration) => {
    setSelectedConfig(config);
    setConfigurations((prev) =>
      prev.map((c) => (c.id === config.id ? config : c))
    );
  };

  if (loading) {
    return <div className="p-6 text-center">Loading configurator...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="configure" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none bg-background">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="views">Visual Views</TabsTrigger>
          <TabsTrigger value="quote">Quote</TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="flex-1 p-6">
          <CabinetParametersForm
            projectId={projectId}
            configuration={selectedConfig}
            onUpdate={handleConfigurationUpdate}
            onReload={loadData}
          />
        </TabsContent>

        <TabsContent value="library" className="flex-1 p-6">
          <CabinetLibraryPanel
            projectId={projectId}
            models={models}
            onModelSelect={(model) => {
              // Create new configuration from model
              toast({
                title: 'Model Selected',
                description: `${model.name} added to project`,
              });
              loadData();
            }}
          />
        </TabsContent>

        <TabsContent value="views" className="flex-1 p-6">
          <CabinetVisualViews configuration={selectedConfig} />
        </TabsContent>

        <TabsContent value="quote" className="flex-1 p-6">
          <CabinetQuotePanel
            projectId={projectId}
            configurations={configurations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
