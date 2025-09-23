
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Settings, MoreVertical, Trash2, Package, CalendarDays, Clock, Download, Cog, Wrench, Hammer, Scissors, PaintBucket, Truck, Drill, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, taskService, Project, Task } from '@/services/dataService';
import { workstationService, Workstation } from '@/services/workstationService';
import { useAuth } from '@/context/AuthContext';
import NewProjectModal from '@/components/NewProjectModal';
import { exportProjectData } from '@/services/projectExportService';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const { t, createLocalizedPath } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({});
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [exportingProject, setExportingProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectProgress, setProjectProgress] = useState<Record<string, { earliestIncomplete: string | null, farthestTodo: string | null }>>({});
  const isAdmin = ['admin', 'teamleader', 'preparater', 'manager'].includes(currentEmployee?.role);


  useEffect(() => {
    loadProjects();
    loadWorkstations();
  }, []);

  const loadWorkstations = async () => {
    try {
      const data = await workstationService.getAll();
      setWorkstations(data);
    } catch (error) {
      console.error('Error loading workstations:', error);
    }
  };

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

// Function to get icon based on workstation name or uploaded icon
  const getWorkstationIcon = (workstationName: string) => {
    // Find the workstation to check if it has an uploaded icon
    const workstation = workstations.find(ws => ws.name.toLowerCase() === workstationName.toLowerCase());
    
    if (workstation?.icon_path) {
      return (
        <img 
          src={workstation.icon_path} 
          alt={workstation.name} 
          className="h-4 w-4 object-contain"
        />
      );
    }

    // Fallback to default icons based on name
    const lowercaseName = workstationName.toLowerCase();
    
    // CNC related workstations
    if (lowercaseName.includes('cnc') || lowercaseName.includes('draaibank') || lowercaseName.includes('freesmachine')) {
      return <Cog className="h-4 w-4" />;
    }
    
    // Assembly/Montage workstations
    if (lowercaseName.includes('montage') || lowercaseName.includes('assemblage') || lowercaseName.includes('assembly')) {
      return <Wrench className="h-4 w-4" />;
    }
    
    // Woodworking/Houtbewerking workstations
    if (lowercaseName.includes('hout') || lowercaseName.includes('wood') || lowercaseName.includes('timber')) {
      return <Hammer className="h-4 w-4" />;
    }
    
    // Cutting/Snijden workstations
    if (lowercaseName.includes('snij') || lowercaseName.includes('zaag') || lowercaseName.includes('cut') || lowercaseName.includes('saw')) {
      return <Scissors className="h-4 w-4" />;
    }
    
    // Drilling/Boren workstations
    if (lowercaseName.includes('boor') || lowercaseName.includes('drill') || lowercaseName.includes('ponsen')) {
      return <Drill className="h-4 w-4" />;
    }
    
    // Painting/Schilderen workstations
    if (lowercaseName.includes('verf') || lowercaseName.includes('lak') || lowercaseName.includes('paint') || lowercaseName.includes('coating')) {
      return <PaintBucket className="h-4 w-4" />;
    }
    
    // Transport/Verzending workstations
    if (lowercaseName.includes('transport') || lowercaseName.includes('verzending') || lowercaseName.includes('levering')) {
      return <Truck className="h-4 w-4" />;
    }
    
    // Settings/Instellingen workstations
    if (lowercaseName.includes('instellingen') || lowercaseName.includes('settings') || lowercaseName.includes('configuratie')) {
      return <Settings className="h-4 w-4" />;
    }

    // Default icon for unmatched workstations
    return <Package className="h-4 w-4" />;
  };

  // Get workstation progress indicators for a project
  const getWorkstationProgress = async (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return null;

    // Get workstation mappings for tasks
    const taskWorkstationMap: Record<string, string> = {};
    
    // For each task, find its linked workstation
    await Promise.all(
      tasks.map(async (task) => {
        try {
          const { data: linkData, error } = await supabase
            .from('task_workstation_links')
            .select(`
              workstation_id,
              workstations!inner(name)
            `)
            .eq('task_id', task.id)
            .maybeSingle();
          
          if (error || !linkData) {
            // Fallback to task.workstation field if no link found
            taskWorkstationMap[task.id] = task.workstation || 'Unknown';
          } else {
            taskWorkstationMap[task.id] = (linkData.workstations as any).name;
          }
        } catch (error) {
          console.error(`Error fetching workstation for task ${task.id}:`, error);
          taskWorkstationMap[task.id] = task.workstation || 'Unknown';
        }
      })
    );

    // Group tasks by workstation using the mapped workstation names
    const tasksByWorkstation = tasks.reduce((acc, task) => {
      const workstationName = taskWorkstationMap[task.id];
      if (!acc[workstationName]) {
        acc[workstationName] = [];
      }
      acc[workstationName].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    // Sort workstations by their earliest due date (workflow order)
    const workstationOrder = Object.keys(tasksByWorkstation).sort((a, b) => {
      const aEarliestDate = Math.min(...tasksByWorkstation[a].map(t => new Date(t.due_date).getTime()));
      const bEarliestDate = Math.min(...tasksByWorkstation[b].map(t => new Date(t.due_date).getTime()));
      return aEarliestDate - bEarliestDate;
    });

    // Find the earliest workstation with incomplete tasks (red circle)
    let earliestIncomplete = null;
    
    // Find the farthest workstation with TODO tasks (green circle)
    let farthestTodo = null;
    
    for (const workstation of workstationOrder) {
      const workstationTasks = tasksByWorkstation[workstation];
      const hasTodoTasks = workstationTasks.some(task => task.status === 'TODO');
      const hasInProgressTasks = workstationTasks.some(task => task.status === 'IN_PROGRESS');
      const hasIncompleteTasks = hasTodoTasks || hasInProgressTasks;
      
      // Set earliest incomplete if not already set
      if (hasIncompleteTasks && !earliestIncomplete) {
        earliestIncomplete = workstation;
      }
      
      // Update farthest TODO as we progress through workstations
      if (hasTodoTasks) {
        farthestTodo = workstation;
      }
    }

    return {
      earliestIncomplete,
      farthestTodo
    };
  };

  const loadProjectTasks = async (projectId: string) => {
    try {
      const tasks = await taskService.getTasksByProject(projectId);
      setProjectTasks(prev => ({ ...prev, [projectId]: tasks }));
      
      // Calculate progress for this project
      const progress = await getWorkstationProgress(tasks);
      setProjectProgress(prev => ({ ...prev, [projectId]: progress }));
    } catch (error) {
      console.error(`Failed to load tasks for project ${projectId}:`, error);
      setProjectTasks(prev => ({ ...prev, [projectId]: [] }));
    }
  };

  const toggleProjectExpansion = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const newExpanded = new Set(expandedProjects);
    if (expandedProjects.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      // Only load tasks if not already loaded
      if (!projectTasks[projectId]) {
        await loadProjectTasks(projectId);
      }
    }
    setExpandedProjects(newExpanded);
  };

  // Workstation Progress Component
  const WorkstationProgress = ({ progress }: { progress: { earliestIncomplete: string | null, farthestTodo: string | null } | null }) => {
    if (!progress || (!progress.earliestIncomplete && !progress.farthestTodo)) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-muted-foreground">Status:</span>
        <div className="flex items-center gap-2">
          {/* Red circle for earliest incomplete workstation */}
          {progress.earliestIncomplete && (
            <div
              className="flex items-center justify-center w-6 h-6 bg-red-100 border-2 border-red-500 rounded-full"
              title={`${progress.earliestIncomplete} - requires attention`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {getWorkstationIcon(progress.earliestIncomplete)}
              </div>
            </div>
          )}
          
          {/* Green circle for farthest TODO workstation */}
          {progress.farthestTodo && progress.farthestTodo !== progress.earliestIncomplete && (
            <div
              className="flex items-center justify-center w-6 h-6 bg-green-100 border-2 border-green-500 rounded-full"
              title={`${progress.farthestTodo} - ready for next phase`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {getWorkstationIcon(progress.farthestTodo)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-xl mb-1 break-words">{project.name}</CardTitle>
                            <CardDescription className="truncate">{project.client}</CardDescription>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
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
                      
                      {/* Status Expand Button */}
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => toggleProjectExpansion(project.id, e)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {expandedProjects.has(project.id) ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Hide Status
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Show Status
                            </>
                          )}
                        </Button>
                        
                        {/* Workstation Progress Indicators - Only shown when expanded */}
                        {expandedProjects.has(project.id) && (
                          <WorkstationProgress progress={projectProgress[project.id]} />
                        )}
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
