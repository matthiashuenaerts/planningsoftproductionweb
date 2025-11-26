import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];

export default function CabinetLibrary() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [models, setModels] = useState<CabinetModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const data = await cabinetService.getAllModels();
      setModels(data);
    } catch (error) {
      console.error('Error loading cabinet models:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cabinet models',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    navigate(`/calculation/project/${projectId}/editor/${modelId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading cabinet library...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(`/calculation/project/${projectId}`)}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Project
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Cabinet Library</h1>
        <p className="text-muted-foreground mt-2">
          Select a cabinet model to configure
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <Card
            key={model.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleSelectModel(model.id)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{model.name}</CardTitle>
              <CardDescription className="text-sm">
                {model.category}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {model.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {model.description}
                </p>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Size:</span>
                  <span>
                    {model.default_width} × {model.default_height} × {model.default_depth}
                  </span>
                </div>
                {model.min_width && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Width:</span>
                    <span>{model.min_width}</span>
                  </div>
                )}
                {model.max_width && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Width:</span>
                    <span>{model.max_width}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
