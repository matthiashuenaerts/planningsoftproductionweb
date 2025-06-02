import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import Navbar from '@/components/Navbar';
import NewTaskModal from '@/components/NewTaskModal';
import TaskList from '@/components/TaskList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Clock, User, Plus, Package, FileText } from 'lucide-react';

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => dataService.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: phases = [], isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', projectId],
    queryFn: () => dataService.getPhases(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => dataService.getTasks(projectId!),
    enabled: !!projectId,
  });

  const handleTaskStatusChange = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (!currentEmployee?.id) return;

    try {
      // If starting a task (TODO -> IN_PROGRESS), start time registration
      if (newStatus === 'IN_PROGRESS') {
        // Stop any existing active time registration for this employee
        await timeRegistrationService.stopActiveTimeRegistration(currentEmployee.id);
        
        // Start new time registration for this task
        await timeRegistrationService.startTimeRegistration(taskId, currentEmployee.id);
        
        toast({
          title: "Task Started",
          description: "Time registration has been started for this task.",
        });
      }

      // If completing a task, stop time registration
      if (newStatus === 'COMPLETED') {
        await timeRegistrationService.stopActiveTimeRegistration(currentEmployee.id);
        
        toast({
          title: "Task Completed",
          description: "Time registration has been stopped and task marked as complete.",
        });
      }

      // Update task status
      await dataService.updateTaskStatus(taskId, newStatus, currentEmployee.id);
      
      // Refresh tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive"
      });
    }
  };

  if (projectLoading || phasesLoading || tasksLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Project not found</div>
        </div>
      </div>
    );
  }

  // Filter tasks by status
  const todoTasks = tasks.filter(task => task.status === 'TODO');
  const holdTasks = tasks.filter(task => task.status === 'HOLD');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  const openTasks = [...todoTasks, ...holdTasks];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-2">{project.description}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/projects/${projectId}/orders`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  View Orders
                </Button>
              </Link>
              <Button onClick={() => setIsNewTaskModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.progress}%</div>
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Client</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{project.client}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Start Date</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg">{new Date(project.start_date).toLocaleDateString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Installation Date</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg">{new Date(project.installation_date).toLocaleDateString()}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="open" className="space-y-4">
          <TabsList>
            <TabsTrigger value="open">Open Tasks ({openTasks.length})</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress ({inProgressTasks.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            <TaskList 
              tasks={openTasks}
              onTaskStatusChange={handleTaskStatusChange}
              showRushOrderBadge={true}
              showCompleteButton={true}
            />
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4">
            <TaskList 
              tasks={inProgressTasks}
              onTaskStatusChange={handleTaskStatusChange}
              showRushOrderBadge={true}
              showCountdownTimer={true}
            />
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <TaskList 
              tasks={completedTasks}
              onTaskStatusChange={handleTaskStatusChange}
              showRushOrderBadge={true}
            />
          </TabsContent>
        </Tabs>

        <NewTaskModal 
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          projectId={projectId!}
          phases={phases}
        />
      </div>
    </div>
  );
};

export default ProjectDetails;
