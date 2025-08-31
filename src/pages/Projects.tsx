
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Settings, MoreVertical, Trash2, Package, CalendarDays, Clock, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, Project } from '@/services/dataService';
import { useAuth } from '@/context/AuthContext';
import NewProjectModal from '@/components/NewProjectModal';
import { exportProjectData } from '@/services/projectExportService';
import { useLanguage } from '@/context/LanguageContext';

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const { t, createLocalizedPath } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [exportingProject, setExportingProject] = useState<string | null>(null);
  const isAdmin = ['admin', 'teamleader', 'preparater'].includes(currentEmployee?.role);


  useEffect(() => {
    loadProjects();
  }, []);

  // Filter projects when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(query) || 
        project.client.toLowerCase().includes(query)
      );
      // Sort filtered results by installation date (latest first)
      const sortedFiltered = filtered.sort((a, b) => 
        new Date(b.installation_date).getTime() - new Date(a.installation_date).getTime()
      );
      setFilteredProjects(sortedFiltered);
    }
  }, [searchQuery, projects]);
  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await projectService.getAll();
      // Sort projects by installation date (latest first)
      const sortedData = data.sort((a, b) => 
        new Date(b.installation_date).getTime() - new Date(a.installation_date).getTime()
      );
      setProjects(sortedData);
      setFilteredProjects(sortedData);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_load_projects', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleExportProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingProject(project.id);
    
    try {
      await exportProjectData(project);
      toast({
        title: t('success'),
        description: t('project_exported_successfully', { name: project.name })
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_export_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setExportingProject(null);
    }
  };
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await projectService.delete(projectToDelete);
      toast({
        title: t('success'),
        description: t('project_deleted_successfully')
      });

      // Remove the deleted project from state
      setProjects(prev => prev.filter(p => p.id !== projectToDelete));
      setFilteredProjects(prev => prev.filter(p => p.id !== projectToDelete));
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_delete_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setProjectToDelete(null);
    }
  };
  const handleProjectClick = (projectId: string) => {
    navigate(createLocalizedPath(`/projects/${projectId}`));
  };
  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      
      <div className="ml-64 flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('projects_title')}</h1>
              <p className="text-muted-foreground mt-1">{t('projects_description')}</p>
            </div>
            
            {isAdmin && (
              <Button size="sm" onClick={() => setIsNewProjectModalOpen(true)} className="mx-0">
                <Plus className="mr-2 h-4 w-4" />
                {t('new_project')}
              </Button>
            )}
          </div>
          
          <div className="mb-8 flex gap-4 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('search_projects_placeholder')}
                className="pl-8" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
          
          {isLoading ? <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div> : filteredProjects.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(project => <Card key={project.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleProjectClick(project.id)}>
                  <div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl mb-1">{project.name}</CardTitle>
                          <CardDescription>{project.client}</CardDescription>
                        </div>
                        <div className="flex gap-1">
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleExportProject(project, e);
                                  }}
                                  disabled={exportingProject === project.id}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {exportingProject === project.id ? t('exporting_project') : t('export_project')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => {
                                  e.stopPropagation();
                                  navigate(createLocalizedPath(`/projects/${project.id}/edit`));
                                }}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  {t('edit_project')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => {
                                  e.stopPropagation();
                                  navigate(createLocalizedPath(`/projects/${project.id}/orders`));
                                }}>
                                  <Package className="mr-2 h-4 w-4" />
                                  {t('orders')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600 focus:text-red-600" 
                                  onClick={e => {
                                    e.stopPropagation();
                                    setProjectToDelete(project.id);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('delete_project')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {project.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {project.description}
                        </p>}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          <span>
                            {t('start_date')}: {new Date(project.start_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <CalendarDays className="mr-1 h-4 w-4" />
                          <span>
                            {t('installation_date')}: {new Date(project.installation_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t('progress')}</span>
                          <span>{project.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div className="bg-primary h-2.5 rounded-full" style={{
                      width: `${project.progress}%`
                    }}></div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>)}
            </div> : <div className="text-center p-12 border border-dashed rounded-lg">
              <h3 className="text-lg font-medium mb-2">{t('no_projects_found')}</h3>
              <p className="text-muted-foreground">
                {searchQuery ? t('no_projects_found_search') : t('no_projects_found_create')}
              </p>
              {isAdmin && !searchQuery && <Button variant="outline" className="mt-4" onClick={() => setIsNewProjectModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('create_project')}
                </Button>}
            </div>}
        </div>
      </div>
      
      <NewProjectModal open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen} onSuccess={loadProjects} />

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={open => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_project_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-red-600">
              {t('delete_project_confirm_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700">
              {t('delete_project')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
