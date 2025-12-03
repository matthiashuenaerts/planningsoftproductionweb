import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CabinetProject = Database['public']['Tables']['cabinet_projects']['Row'];

export default function Calculation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [projects, setProjects] = useState<CabinetProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await cabinetService.getAllProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_failed_load_projects'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = () => {
    navigate(createLocalizedPath('/calculation/new'));
  };

  const handleOpenProject = (projectId: string) => {
    navigate(createLocalizedPath(`/calculation/project/${projectId}`));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('calc_cabinet_calculator')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('calc_create_manage_projects')}
          </p>
        </div>
        <Button onClick={handleNewProject} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          {t('calc_new_project')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('calc_loading_projects')}</p>
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('calc_no_projects_yet')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('calc_get_started')}
            </p>
            <Button onClick={handleNewProject}>
              <Plus className="mr-2 h-4 w-4" />
              {t('calc_create_project')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleOpenProject(project.id)}
            >
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>
                  {project.client_name || t('calc_no_client')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('calc_status')}:</span>
                    <span className="font-medium capitalize">{project.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('calc_created')}:</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  {project.project_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('calc_project_number')}:</span>
                      <span>{project.project_number}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
