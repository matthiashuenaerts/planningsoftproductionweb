import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService, taskService } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import TaskList from '@/components/TaskList';
import Timeline from '@/components/Timeline';
import ProjectFileManager from '@/components/ProjectFileManager';
import OneDriveIntegration from '@/components/OneDriveIntegration';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, User, Clock, FileText, Cloud, Truck, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getById(projectId || ''),
    enabled: !!projectId,
  });

  // Get all phases for the project first, then get tasks for all phases
  const { data: phases } = useQuery({
    queryKey: ['projectPhases', projectId],
    queryFn: () => projectService.getProjectPhases(projectId || ''),
    enabled: !!projectId,
  });

  const { data: tasks, isLoading: isTasksLoading, error: tasksError } = useQuery({
    queryKey: ['projectTasks', projectId],
    queryFn: async () => {
      if (!phases || phases.length === 0) return [];
      const allTasks = [];
      for (const phase of phases) {
        const phaseTasks = await taskService.getByPhase(phase.id);
        allTasks.push(...phaseTasks);
      }
      return allTasks;
    },
    enabled: !!projectId && !!phases,
    refetchInterval: 30000,
  });

  const handleTaskStatusChange = async (taskId: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (!currentEmployee) return;

    try {
      if (status === 'IN_PROGRESS') {
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        toast({
          title: "Task Started",
          description: "Time tracking has begun for this task.",
        });
      } else if (status === 'COMPLETED') {
        await timeRegistrationService.completeTask(taskId);
        toast({
          title: "Task Completed",
          description: "Task has been marked as completed.",
        });
      } else if (status === 'TODO') {
        const activeRegistration = await timeRegistrationService.getActiveRegistration(currentEmployee.id);
        if (activeRegistration && activeRegistration.task_id === taskId) {
          await timeRegistrationService.stopTask(activeRegistration.id);
          toast({
            title: "Task Stopped",
            description: "Time tracking has been stopped for this task.",
          });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activeRegistration'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update task status",
        variant: "destructive"
      });
    }
  };

  if (isProjectLoading || isTasksLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">Loading project details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (projectError || tasksError) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center text-red-600">
              Error loading project: {projectError?.message || tasksError?.message}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openTasks = tasks?.filter(task => task.status === 'TODO') || [];
  const inProgressTasks = tasks?.filter(task => task.status === 'IN_PROGRESS') || [];
  const completedTasks = tasks?.filter(task => task.status === 'COMPLETED') || [];

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">{project?.name}</h1>
                <p className="text-gray-600">{project?.description}</p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/orders`)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Orders
                </Button>
                <Button onClick={() => navigate('/projects')}>
                  Back to Projects
                </Button>
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-6">
              <div className="flex items-center text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Due Date: {new Date(project?.installation_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-gray-500">
                <User className="h-4 w-4 mr-2" />
                <span>Client: {project?.client}</span>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Project Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">Description:</span>
                        <span>{project?.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">Start Date:</span>
                        <span>{new Date(project?.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">Installation Date:</span>
                        <span>{new Date(project?.installation_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">Status:</span>
                        <span>{project?.status}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Client Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">Client Name:</span>
                        <span>{project?.client}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              {inProgressTasks.length > 0 && (
                <TaskList
                  tasks={inProgressTasks}
                  title="In Progress"
                  onTaskStatusChange={handleTaskStatusChange}
                  showCountdownTimer={true}
                />
              )}
              
              {openTasks.length > 0 && (
                <TaskList
                  tasks={openTasks}
                  title="Open Tasks"
                  onTaskStatusChange={handleTaskStatusChange}
                  showCompleteButton={true}
                />
              )}
              
              {completedTasks.length > 0 && (
                <TaskList
                  tasks={completedTasks}
                  title="Completed Tasks"
                  onTaskStatusChange={handleTaskStatusChange}
                />
              )}
              
              {(!tasks || tasks.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  No tasks found for this project.
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              {project && <Timeline project={project} />}
            </TabsContent>

            <TabsContent value="files">
              {project && <ProjectFileManager project={project} />}
              {project && <OneDriveIntegration projectId={project.id} projectName={project.name} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
