
import React, { useState, useEffect } from 'react';
import SignedStorageImage from '@/components/SignedStorageImage';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Settings, MoreVertical, Trash2, Package, CalendarDays, Clock, Download, Cog, Wrench, Hammer, Scissors, PaintBucket, Truck, Drill, ChevronDown, ChevronUp, Archive, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, taskService, Project, Task } from '@/services/dataService';
import { workstationService, Workstation } from '@/services/workstationService';
import { useAuth } from '@/context/AuthContext';
import NewProjectModal from '@/components/NewProjectModal';
import { exportProjectData, exportProjectDataAsZip } from '@/services/projectExportService';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';
import { oneDriveService } from '@/services/oneDriveService';


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
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('projects_search') || '');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [exportingProject, setExportingProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectProgress, setProjectProgress] = useState<Record<string, { earliestIncomplete: string | null, farthestTodo: string | null }>>({});
  const [archiveDialogProject, setArchiveDialogProject] = useState<Project | null>(null);
  const [archiveStep, setArchiveStep] = useState<'confirm' | 'delete_data'>('confirm');
  const [archiving, setArchiving] = useState(false);
  const isAdmin = ['admin', 'teamleader', 'preparater', 'manager'].includes(currentEmployee?.role);
  const { tenant } = useTenant();
  const [serviceDates, setServiceDates] = useState<Record<string, string[]>>({});


  useEffect(() => {
    loadProjects();
    loadWorkstations();
  }, []);

  const loadWorkstations = async () => {
    try {
      const data = await workstationService.getAll(tenant?.id);
      setWorkstations(data);
    } catch (error) {
      console.error('Error loading workstations:', error);
    }
  };

  // Filter projects when search query changes
  useEffect(() => {
    localStorage.setItem('projects_search', searchQuery);
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
      const data = await projectService.getAll(tenant?.id);
      // Sort projects by installation date (latest first)
      const sortedData = data.sort((a, b) => 
        new Date(b.installation_date).getTime() - new Date(a.installation_date).getTime()
      );
      setProjects(sortedData);
      setFilteredProjects(sortedData);

      // Load service dates for all projects
      const projectIds = sortedData.map(p => p.id);
      if (projectIds.length > 0) {
        const { data: serviceAssignments } = await supabase
          .from('project_team_assignments')
          .select('project_id, start_date, team_id')
          .in('project_id', projectIds)
          .eq('is_service_ticket', true);
        
        if (serviceAssignments && serviceAssignments.length > 0) {
          const dateMap: Record<string, string[]> = {};
          serviceAssignments.forEach(a => {
            if (a.start_date) {
              if (!dateMap[a.project_id]) dateMap[a.project_id] = [];
              if (!dateMap[a.project_id].includes(a.start_date)) {
                dateMap[a.project_id].push(a.start_date);
              }
            }
          });
          setServiceDates(dateMap);
        }
      }
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
  const handleExportProject = async (project: Project, e: React.MouseEvent, format: 'pdf' | 'zip' = 'pdf') => {
    e.stopPropagation();
    setExportingProject(project.id);
    
    try {
      if (format === 'pdf') {
        await exportProjectData(project);
        toast({
          title: t('success'),
          description: t('project_exported_pdf_successfully', { name: project.name })
        });
      } else {
        await exportProjectDataAsZip(project);
        toast({
          title: t('success'),
          description: t('project_exported_zip_successfully', { name: project.name })
        });
      }
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

  const handleArchiveProject = async (project: Project, deleteData: boolean) => {
    setArchiving(true);
    try {
      // 1. Check for OneDrive connection
      const oneDriveConfig = await oneDriveService.getProjectOneDriveConfig(project.id);
      
      // 2. Export as ZIP
      if (oneDriveConfig) {
        // TODO: Upload zip to OneDrive via edge function
        // For now, still download
        toast({ title: t('info') || 'Info', description: 'OneDrive upload not yet available, downloading ZIP instead.' });
      }
      await exportProjectDataAsZip(project);

      // 3. Delete production data if requested
      if (deleteData) {
        // Delete tasks, orders, accessories, project_files
        const { data: phases } = await supabase.from('phases').select('id').eq('project_id', project.id);
        if (phases && phases.length > 0) {
          const phaseIds = phases.map(p => p.id);
          await supabase.from('tasks').delete().in('phase_id', phaseIds);
        }
        await supabase.from('orders').delete().eq('project_id', project.id);
        await supabase.from('accessories').delete().eq('project_id', project.id);
        // Remove storage files
        const { data: storageFiles } = await supabase.storage.from('project_files').list(project.id);
        if (storageFiles && storageFiles.length > 0) {
          await supabase.storage.from('project_files').remove(storageFiles.map(f => `${project.id}/${f.name}`));
        }
        toast({ title: t('success'), description: t('production_data_deleted') || 'Production data deleted' });
      }

      // 4. Mark project as archived
      await supabase.from('projects').update({ status: 'archived' }).eq('id', project.id);
      
      toast({ title: t('success'), description: t('project_archived') || 'Project archived' });
      loadProjects();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setArchiving(false);
      setArchiveDialogProject(null);
      setArchiveStep('confirm');
    }
  };

  const handleCompleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('projects').update({ installation_status: 'completed' }).eq('id', project.id);
      toast({ title: t('success'), description: t('project_completed') || 'Project marked as complete' });
      loadProjects();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

// Function to get icon based on workstation name or uploaded icon
  const getWorkstationIcon = (workstationName: string) => {
    // Find the workstation to check if it has an uploaded icon
    const workstation = workstations.find(ws => ws.name.toLowerCase() === workstationName.toLowerCase());
    
    if (workstation?.icon_path) {
      return (
        <SignedStorageImage 
          bucket="product-images"
          path={workstation.icon_path} 
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

  const isMobile = useIsMobile();
  const useDrawerLayout = isMobile || currentEmployee?.role === 'installation_team';

  return (
    <div className="flex min-h-screen bg-background">
      {!useDrawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {useDrawerLayout && <Navbar />}
      
      <div className={`flex-1 ${!useDrawerLayout ? 'ml-64 p-8' : 'px-4 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>{t('projects_title')}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {t('projects_description')}
              </p>
            </div>
            
            {isAdmin && (
              <Button onClick={() => setIsNewProjectModalOpen(true)} className={`rounded-xl ${isMobile ? 'w-full' : ''}`}>
                <Plus className="mr-2 h-4 w-4" />
                {t('new_project')}
              </Button>
            )}
          </div>
          
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('search_projects_placeholder')}
                className="pl-9 h-10 rounded-xl bg-muted/50 border-border/60 focus:bg-card" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">{t('projects_title')}...</p>
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => (
                <Card 
                  key={project.id} 
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer active:scale-[0.98] relative"
                  onClick={() => handleProjectClick(project.id)}
                >
                  {/* Installation status watermark */}
                  {(project as any).installation_status && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className={`text-2xl font-black uppercase tracking-widest rotate-[-20deg] ${
                        (project as any).installation_status === 'completed' ? 'text-green-500/15' : 'text-amber-500/15'
                      }`}>
                        {(project as any).installation_status === 'completed' ? '✓ Installed' : '🔧 Service'}
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-2 px-4 sm:px-5 pt-4 sm:pt-5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base font-semibold mb-0.5 break-words leading-tight">{project.name}</CardTitle>
                        <CardDescription className="truncate text-xs">{project.client}</CardDescription>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button variant="secondary" size="icon" className={`h-8 w-8 rounded-xl shadow-sm ${isMobile ? 'opacity-100' : ''}`}>
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); handleExportProject(project, e, 'pdf'); }} disabled={exportingProject === project.id}>
                                <Download className="mr-2 h-4 w-4" />
                                {exportingProject === project.id ? t('exporting_project') : t('export_comprehensive_pdf')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); handleExportProject(project, e, 'zip'); }} disabled={exportingProject === project.id}>
                                <Package className="mr-2 h-4 w-4" />
                                {exportingProject === project.id ? t('exporting_project') : t('export_zip_archive')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(createLocalizedPath(`/projects/${project.id}/edit`)); }}>
                                <Settings className="mr-2 h-4 w-4" />
                                {t('edit_project')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(createLocalizedPath(`/projects/${project.id}/orders`)); }}>
                                <Package className="mr-2 h-4 w-4" />
                                {t('orders')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={e => { handleCompleteProject(project, e); }}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                {t('complete_project') || 'Complete project'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); setArchiveDialogProject(project); setArchiveStep('confirm'); }}>
                                <Archive className="mr-2 h-4 w-4" />
                                {t('archive_project') || 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={e => { e.stopPropagation(); setProjectToDelete(project.id); }}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('delete_project')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5">
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                    )}
                    
                    {/* Dates as compact pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(project.start_date).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary/8 px-2 py-1 text-[11px] text-primary font-medium">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(project.installation_date).toLocaleDateString()}
                      </span>
                      {serviceDates[project.id] && serviceDates[project.id].length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/8 px-2 py-1 text-[11px] text-destructive font-medium">
                          <Wrench className="h-3 w-3" />
                          {serviceDates[project.id].map(d => new Date(d).toLocaleDateString()).join(', ')}
                        </span>
                      )}
                    </div>
                    
                    {/* Status toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => toggleProjectExpansion(project.id, e)}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-lg mb-2"
                    >
                      {expandedProjects.has(project.id) ? (
                        <><ChevronUp className="h-3 w-3 mr-1" />Hide Status</>
                      ) : (
                        <><ChevronDown className="h-3 w-3 mr-1" />Show Status</>
                      )}
                    </Button>
                    
                    {expandedProjects.has(project.id) && (
                      <WorkstationProgress progress={projectProgress[project.id]} />
                    )}
                    
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{t('progress')}</span>
                        <span className="font-semibold text-foreground">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-16 border border-dashed border-border/60 rounded-2xl bg-muted/30">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold mb-1">{t('no_projects_found')}</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? t('no_projects_found_search') : t('no_projects_found_create')}
              </p>
              {isAdmin && !searchQuery && (
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setIsNewProjectModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('create_project')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <NewProjectModal open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen} onSuccess={loadProjects} />

      <AlertDialog open={!!projectToDelete} onOpenChange={open => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_project_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-destructive">
              {t('delete_project_confirm_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/90 rounded-xl">
              {t('delete_project')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Dialog */}
      <AlertDialog open={!!archiveDialogProject} onOpenChange={open => { if (!open) { setArchiveDialogProject(null); setArchiveStep('confirm'); } }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveStep === 'confirm'
                ? (t('archive_project') || 'Archive Project')
                : (t('delete_production_data') || 'Delete Production Data?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveStep === 'confirm'
                ? (t('archive_project_description') || `Archive "${archiveDialogProject?.name}"? A ZIP backup will be downloaded first.`)
                : (t('delete_production_data_description') || 'Do you want to delete all tasks, documents, orders and accessories? This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={archiving}>{t('cancel')}</AlertDialogCancel>
            {archiveStep === 'confirm' ? (
              <AlertDialogAction
                className="rounded-xl"
                disabled={archiving}
                onClick={(e) => {
                  e.preventDefault();
                  setArchiveStep('delete_data');
                }}
              >
                {archiving ? '...' : (t('continue') || 'Continue')}
              </AlertDialogAction>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={archiving}
                  onClick={() => archiveDialogProject && handleArchiveProject(archiveDialogProject, false)}
                >
                  {t('keep_data') || 'Keep Data'}
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  disabled={archiving}
                  onClick={() => archiveDialogProject && handleArchiveProject(archiveDialogProject, true)}
                >
                  {t('delete_data') || 'Delete Data'}
                </Button>
              </div>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Projects;
