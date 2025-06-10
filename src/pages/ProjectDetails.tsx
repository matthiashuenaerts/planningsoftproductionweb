import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, CalendarDays, Clock, Package, FileText, Folder, Plus, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, Project, Task, taskService } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import TaskList from '@/components/TaskList';
import ProjectFileManager from '@/components/ProjectFileManager';
import OneDriveIntegration from '@/components/OneDriveIntegration';
import NewOrderModal from '@/components/NewOrderModal';
import { PartsListDialog } from '@/components/PartsListDialog';
import { useAuth } from '@/context/AuthContext';

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const { currentEmployee } = useAuth();

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const projectData = await projectService.getById(projectId);
        setProject(projectData);
        
        // Fetch phases for this project
        const phaseData = await projectService.getProjectPhases(projectId);
        
        // Fetch tasks for all phases
        let allTasks: Task[] = [];
        for (const phase of phaseData) {
          const phaseTasks = await taskService.getByPhase(phase.id);
          allTasks = [...allTasks, ...phaseTasks];
        }
        
        setTasks(allTasks);
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load project data: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, toast]);

  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (!currentEmployee) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update tasks.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Use explicit status checks without type narrowing
      const statusValue = newStatus as string;
      
      // If starting a task, use time registration service
      if (statusValue === 'IN_PROGRESS') {
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        
        // Update local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { 
              ...task, 
              status: 'IN_PROGRESS',
              status_changed_at: new Date().toISOString(),
              assignee_id: currentEmployee.id
            } : task
          )
        );
        
        toast({
          title: "Task Started",
          description: "Task has been started and time registration created.",
        });
        return;
      }
      
      // If completing a task, use time registration service
      if (statusValue === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        
        // Update local state
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { 
              ...task, 
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              completed_by: currentEmployee.id
            } : task
          )
        );
        
        toast({
          title: "Task Completed",
          description: "Task has been completed and time registration ended.",
        });
        return;
      }
      
      // For other status changes, use regular task service
      const updateData: Partial<Task> = { 
        status: newStatus, 
        status_changed_at: new Date().toISOString() 
      };
      
      // Set assignee when changing to IN_PROGRESS
      if (statusValue === 'IN_PROGRESS') {
        updateData.assignee_id = currentEmployee.id;
      }
      
      // Add completion info if task is being marked as completed
      if (statusValue === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = currentEmployee.id;
      }
      
      await taskService.update(taskId, updateData);
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            status: newStatus,
            status_changed_at: updateData.status_changed_at,
            ...(statusValue === 'IN_PROGRESS' ? {
              assignee_id: currentEmployee.id
            } : {}),
            ...(statusValue === 'COMPLETED' ? {
              completed_at: updateData.completed_at,
              completed_by: currentEmployee.id
            } : {})
          } : task
        )
      );
      
      toast({
        title: "Task updated",
        description: `Task status has been updated to ${newStatus}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update task status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleNewOrderSuccess = () => {
    toast({
      title: "Success",
      description: "Order created successfully",
    });
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
              <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
              <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist or has been removed.</p>
              <Button onClick={() => navigate('/projects')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Planned</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      case 'on_hold':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">On Hold</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'HOLD'];
    if (!validStatuses.includes(status)) {
      return 'bg-gray-100 text-gray-800';
    }
    
    switch (status) {
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'HOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskCountByStatus = (status: string) => {
    return tasks.filter(task => task.status === status).length;
  };

  // Group tasks by status - Fix the filtering logic
  const todoTasks = tasks.filter(task => task.status === 'TODO');
  const holdTasks = tasks.filter(task => task.status === 'HOLD');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  // Combine TODO and HOLD tasks for the "Open tasks" tab
  const openTasks = [...todoTasks, ...holdTasks];

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/projects`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
            </Button>
            
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{project?.name}</h1>
                <p className="text-muted-foreground">Client: {project?.client}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/projects/${projectId}/orders`)}
                >
                  <Package className="mr-2 h-4 w-4" /> Orders
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowNewOrderModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Order
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPartsListDialog(true)}
                >
                  <List className="mr-2 h-4 w-4" /> Parts List
                </Button>
                <Button 
                  variant={activeTab === 'files' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('files')}
                >
                  <FileText className="mr-2 h-4 w-4" /> Files
                </Button>
                <Button 
                  variant={activeTab === 'onedrive' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('onedrive')}
                >
                  <Folder className="mr-2 h-4 w-4" /> OneDrive
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{openTasks.length}</div>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{getTaskCountByStatus('IN_PROGRESS')}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{getTaskCountByStatus('COMPLETED')}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{tasks.length}</div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </CardContent>
            </Card>
          </div>

          {activeTab === 'files' ? (
            <ProjectFileManager projectId={projectId!} />
          ) : activeTab === 'onedrive' ? (
            <OneDriveIntegration projectId={projectId!} projectName={project?.name || ''} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Summary Card */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Project Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Status</h4>
                    <div>{project && getStatusBadge(project.status)}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Project Progress</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{project?.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div 
                          className="bg-primary h-2.5 rounded-full" 
                          style={{ width: `${project?.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Important Dates</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Start Date:</span>
                      <span>{project?.start_date && formatDate(project.start_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Installation Date:</span>
                      <span>{project?.installation_date && formatDate(project.installation_date)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Project Tasks Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Project Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="todo">
                    <TabsList className="mb-4">
                      <TabsTrigger value="todo">Open tasks ({openTasks.length})</TabsTrigger>
                      <TabsTrigger value="in_progress">In Progress ({inProgressTasks.length})</TabsTrigger>
                      <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="todo">
                      <TaskList 
                        tasks={openTasks} 
                        title="Open Tasks" 
                        onTaskStatusChange={handleTaskStatusChange}
                        showCompleteButton={true}
                      />
                    </TabsContent>
                    <TabsContent value="in_progress">
                      <TaskList 
                        tasks={inProgressTasks} 
                        title="In Progress Tasks" 
                        onTaskStatusChange={handleTaskStatusChange}
                      />
                    </TabsContent>
                    <TabsContent value="completed">
                      <TaskList 
                        tasks={completedTasks} 
                        title="Completed Tasks" 
                        onTaskStatusChange={handleTaskStatusChange}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId!}
        onSuccess={handleNewOrderSuccess}
      />

      {/* Parts List Dialog */}
      <PartsListDialog
        isOpen={showPartsListDialog}
        onClose={() => setShowPartsListDialog(false)}
        projectId={projectId!}
        onImportComplete={() => {
          toast({
            title: "Success",
            description: "Parts list imported successfully",
          });
        }}
      />
    </div>
  );
};

export default ProjectDetails;
