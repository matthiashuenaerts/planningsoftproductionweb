import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];

interface CabinetLibraryPanelProps {
  projectId: string;
  models: CabinetModel[];
  onModelSelect: (model: CabinetModel) => void;
}

export function CabinetLibraryPanel({ projectId, models, onModelSelect }: CabinetLibraryPanelProps) {
  const { toast } = useToast();

  const handleAddToProject = async (model: CabinetModel) => {
    try {
      const { data, error } = await supabase
        .from('cabinet_configurations')
        .insert({
          project_id: projectId,
          name: model.name,
          width: Number(model.default_width) || 600,
          height: Number(model.default_height) || 720,
          depth: Number(model.default_depth) || 350,
          model_id: model.id,
          parameters: model.parameters,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${model.name} added to project`,
      });
      onModelSelect(model);
    } catch (error) {
      console.error('Error adding model:', error);
      toast({
        title: 'Error',
        description: 'Failed to add model to project',
        variant: 'destructive',
      });
    }
  };

  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = [];
    }
    acc[model.category].push(model);
    return acc;
  }, {} as Record<string, CabinetModel[]>);

  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="space-y-6">
        {Object.entries(groupedModels).map(([category, categoryModels]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryModels.map((model) => (
                <Card key={model.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{model.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {model.description}
                        </CardDescription>
                      </div>
                      {model.is_template && (
                        <Badge variant="secondary" className="text-xs">
                          Template
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground space-y-1">
                      {model.default_width && (
                        <div>W: {model.default_width}mm</div>
                      )}
                      {model.default_height && (
                        <div>H: {model.default_height}mm</div>
                      )}
                      {model.default_depth && (
                        <div>D: {model.default_depth}mm</div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleAddToProject(model)}
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Project
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {models.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No models available in library
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
