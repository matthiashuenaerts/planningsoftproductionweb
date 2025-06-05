import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { projectService, phaseService, taskService, Project, Phase, Task } from '@/services/dataService';
import { CalendarDays, Clock, User, Plus, Package, FileText, Settings } from 'lucide-react';
import TaskList from '@/components/TaskList';
import Timeline from '@/components/Timeline';
import NewTaskModal from '@/components/NewTaskModal';
import ProjectFileManager from '@/components/ProjectFileManager';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [projectData, phasesData, tasksData] = await Promise.all([
        projectService.getById(id),
        phaseService.getByProjectId(id),
        taskService.getByProjectId(id)
      ]);
      
      setProject(projectData);
      setPhases(phasesData);
      setTasks(tasksData);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'HOLD': return 'bg-red-100 text-red-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskCounts = () => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'COMPLETED').length;
    const inProgress = tasks.filter(task => task.status === 'IN_PROGRESS').length;
    const todo = tasks.filter(task => task.status === 'TODO' || task.status === 'HOLD').length;
    
    return { total, completed, inProgress, todo };
  };

  const handleTaskAdded = () => {
    loadData(); // Reload all data when a new task is added
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 flex-1 p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
        <div className="ml-64 flex-1 p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold">Project not found</h2>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/projects')}
            >
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const taskCounts = getTaskCounts();

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      
      <div className="ml-64 flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Project Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground mt-1">{project.client}</p>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/projects/${id}/orders`)}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Orders
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/projects/${id}/edit`)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Project
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Project Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.progress}%</div>
                <Progress value={project.progress} className="mt-2" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskCounts.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskCounts.completed} completed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Start Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {new Date(project.start_date).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Installation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {new Date(project.installation_date).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Task Status Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">To Do</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{taskCounts.todo}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{taskCounts.inProgress}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{taskCounts.completed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="tasks">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
              
              {isAdmin && (
                <Button 
                  size="sm" 
                  onClick={() => setIsNewTaskModalOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              )}
            </div>
            
            <TabsContent value="tasks">
              <TaskList 
                tasks={tasks} 
                phases={phases} 
                onTaskUpdate={loadData}
                showPhaseFilter={true}
              />
            </TabsContent>
            
            <TabsContent value="timeline">
              <Timeline phases={phases} tasks={tasks} />
            </TabsContent>
            
            <TabsContent value="files">
              <ProjectFileManager projectId={project.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <NewTaskModal
        open={isNewTaskModalOpen}
        onOpenChange={setIsNewTaskModalOpen}
        projectId={project.id}
        phases={phases}
        onSuccess={handleTaskAdded}
      />
    </div>
  );
};

export default ProjectDetails;
