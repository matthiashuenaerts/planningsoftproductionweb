
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  ArrowLeft,
  FileText,
  Truck,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import NewTaskModal from '@/components/NewTaskModal';
import ProjectFileManager from '@/components/ProjectFileManager';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentEmployee } = useAuth();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('Project ID is required');
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          phases (
            *,
            tasks (
              *,
              assignee:employees(name)
            )
          ),
          project_team_assignments (
            *
          ),
          project_truck_assignments (
            *,
            truck:trucks(truck_number, description)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, phaseId }: { taskId: string; phaseId: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_by: currentEmployee?.id
        })
        .eq('id', taskId);
      
      if (error) throw error;
      return { taskId, phaseId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'HOLD':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'planning':
        return 'bg-blue-100 text-blue-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculatePhaseProgress = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const getTaskCounts = (tasks: any[]) => {
    const counts = {
      total: tasks?.length || 0,
      completed: 0,
      inProgress: 0,
      todo: 0,
      hold: 0
    };

    tasks?.forEach(task => {
      switch (task.status) {
        case 'COMPLETED':
          counts.completed++;
          break;
        case 'IN_PROGRESS':
          counts.inProgress++;
          break;
        case 'TODO':
          counts.todo++;
          break;
        case 'HOLD':
          counts.hold++;
          break;
      }
    });

    return counts;
  };

  const canCompleteTask = (taskStatus: string) => {
    return taskStatus === 'TODO' || taskStatus === 'IN_PROGRESS' || taskStatus === 'HOLD';
  };

  const canStartTask = (taskStatus: string) => {
    return taskStatus === 'TODO' || taskStatus === 'HOLD';
  };

  const allTasks = project?.phases?.flatMap((phase: any) => phase.tasks || []) || [];
  const projectTaskCounts = getTaskCounts(allTasks);

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
            <Button onClick={() => navigate('/projects')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/projects')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600">{project.client}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className={getProjectStatusColor(project.status)}>
              {project.status?.replace('_', ' ').toUpperCase()}
            </Badge>
            <ProjectFileManager projectId={project.id} />
          </div>
        </div>

        {/* Project Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.progress}%</div>
              <Progress value={project.progress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projectTaskCounts.total}</div>
              <p className="text-xs text-muted-foreground">
                {projectTaskCounts.completed} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Start Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(project.start_date).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Installation</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(project.installation_date).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Description */}
        {project.description && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Project Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{project.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Team Assignments */}
        {project.project_team_assignments && project.project_team_assignments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Team Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.project_team_assignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{assignment.team}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(assignment.start_date).toLocaleDateString()} 
                        {assignment.duration && ` - ${assignment.duration} day(s)`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Truck Assignments */}
        {project.project_truck_assignments && project.project_truck_assignments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                Truck Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.project_truck_assignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Truck {assignment.truck?.truck_number}</h4>
                      <p className="text-sm text-gray-600">{assignment.truck?.description}</p>
                      <div className="flex space-x-4 mt-2 text-sm">
                        <span>Loading: {new Date(assignment.loading_date).toLocaleDateString()}</span>
                        <span>Installation: {new Date(assignment.installation_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {assignment.notes && (
                      <div className="text-sm text-gray-600 max-w-xs">
                        {assignment.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phases and Tasks */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Project Phases</h2>
            {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager') && (
              <Button
                onClick={() => {
                  if (project.phases && project.phases.length > 0) {
                    setSelectedPhaseId(project.phases[0].id);
                    setShowNewTaskModal(true);
                  } else {
                    toast({
                      title: 'No Phases Available',
                      description: 'Please create a phase before adding tasks',
                      variant: 'destructive'
                    });
                  }
                }}
                className="flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>

          {project.phases?.map((phase: any) => {
            const phaseProgress = calculatePhaseProgress(phase.tasks);
            const phaseCounts = getTaskCounts(phase.tasks);
            
            return (
              <Card key={phase.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{phase.name}</CardTitle>
                      <CardDescription>
                        {new Date(phase.start_date).toLocaleDateString()} - {new Date(phase.end_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{phaseProgress}%</div>
                      <Progress value={phaseProgress} className="w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Phase Statistics */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{phaseCounts.todo}</div>
                      <div className="text-sm text-gray-600">To Do</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{phaseCounts.inProgress}</div>
                      <div className="text-sm text-gray-600">In Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{phaseCounts.hold}</div>
                      <div className="text-sm text-gray-600">On Hold</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{phaseCounts.completed}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-3">
                    {phase.tasks?.map((task: any) => (
                      <div key={task.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge className={getStatusColor(task.status)}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                            
                            {task.description && (
                              <p className="text-gray-600 mb-2">{task.description}</p>
                            )}
                            
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="h-4 w-4 mr-1" />
                              Due: {new Date(task.due_date).toLocaleDateString()}
                              {task.duration && (
                                <span className="ml-4">
                                  Duration: {task.duration} minutes
                                </span>
                              )}
                              {task.assignee && (
                                <span className="ml-4">
                                  Assigned to: {task.assignee.name}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {canCompleteTask(task.status) && (
                              <Button
                                size="sm"
                                onClick={() => completeTaskMutation.mutate({ 
                                  taskId: task.id, 
                                  phaseId: phase.id 
                                })}
                                disabled={completeTaskMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-center py-4">No tasks in this phase</p>
                    )}
                  </div>

                  {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedPhaseId(phase.id);
                        setShowNewTaskModal(true);
                      }}
                      className="mt-4 w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task to {phase.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <NewTaskModal
          isOpen={showNewTaskModal}
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={() => {
            setShowNewTaskModal(false);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
          }}
          phaseId={selectedPhaseId}
        />
      </div>
    </div>
  );
};

export default ProjectDetails;
