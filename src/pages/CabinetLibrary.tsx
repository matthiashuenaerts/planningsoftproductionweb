import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type CabinetModel = Database['public']['Tables']['cabinet_models']['Row'];

export default function CabinetLibrary() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const [models, setModels] = useState<CabinetModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = currentEmployee?.role === 'admin';

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

  const handleEditModel = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/calculation/model-builder/${modelId}`);
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
            className="cursor-pointer hover:shadow-lg transition-shadow relative"
            onClick={() => handleSelectModel(model.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {model.category}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleEditModel(model.id, e)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
