
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, Project } from '@/services/dataService';
import { useLanguage } from '@/context/LanguageContext';

const EditProject = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    start_date: '',
    installation_date: '',
    status: 'planned' as "planned" | "in_progress" | "completed" | "on_hold",
    project_link_id: ''
  });

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const projectData = await projectService.getById(projectId);
        if (projectData) {
          setProject(projectData);
          setFormData({
            name: projectData.name,
            client: projectData.client,
            description: projectData.description || '',
            start_date: projectData.start_date,
            installation_date: projectData.installation_date,
            status: projectData.status,
            project_link_id: projectData.project_link_id || ''
          });
        }
      } catch (error: any) {
        toast({
          title: t('error'),
          description: t('failed_to_load_project', { message: error.message }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !project) return;

    try {
      setSaving(true);
      await projectService.update(projectId, formData);
      toast({
        title: t('success'),
        description: t('project_updated_successfully')
      });
      navigate(createLocalizedPath(`/projects/${projectId}`));
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_update_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{t('project_not_found')}</h2>
              <p className="text-muted-foreground mb-4">{t('project_not_found_description')}</p>
              <Button onClick={() => navigate(createLocalizedPath('/projects'))}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-3xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/projects'))}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle>{t('edit_project')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('project_name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="client">{t('client')}</Label>
                  <Input
                    id="client"
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">{t('description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="project_link_id">Project Link ID</Label>
                  <Input
                    id="project_link_id"
                    value={formData.project_link_id}
                    onChange={(e) => setFormData({ ...formData, project_link_id: e.target.value })}
                    placeholder="Enter project link ID (optional)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">{t('start_date')}</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="installation_date">{t('installation_date')}</Label>
                    <Input
                      id="installation_date"
                      type="date"
                      value={formData.installation_date}
                      onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(createLocalizedPath(`/projects/${projectId}`))}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? t('saving') : t('save_changes')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
