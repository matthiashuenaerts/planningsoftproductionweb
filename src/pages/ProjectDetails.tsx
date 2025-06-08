import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus,
  Users,
  Truck,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import NewTaskModal from '@/components/NewTaskModal';
import { useAuth } from '@/context/AuthContext';

interface Project {
  id: string;
  name: string;
  client: string;
  description?: string;
  installation_date?: string;
  progress?: number;
  status: string;
}

interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress?: number;
  tasks?: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: string;
  status: string;
  workstation: string;
  phase_id: string;
  assignee_name?: string;
}

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentEmployee } = useAuth();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  // Fetch project details
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data as Project;
    }
  });

  // Fetch phases for the project
  const { data: phases, isLoading: isPhasesLoading } = useQuery({
    queryKey: ['projectPhases', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select(`
          *,
          tasks (*)
        `)
        .eq('project_id', id)
        .order('start_date');

      if (error) {
        throw error;
      }

      return data as Phase[];
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'TODO':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'HOLD':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'TODO':
        return 'bg-yellow-100 text-yellow-800';
      case 'HOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStats = (tasks: Task[]) => {
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      pending: tasks.filter(t => t.status === 'TODO' || t.status === 'HOLD').length
    };
  };

  if (isProjectLoading || isPhasesLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-16 w-16 text-gray-400" />
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Project Not Found</h1>
              <p className="mt-2 text-gray-600">Could not find project with id {id}</p>
              <Link to="/projects">
                <Button className="mt-6">Go Back to Projects</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Link to="/projects">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{project?.name}</h1>
                <p className="text-gray-600">{project?.client}</p>
              </div>
            </div>
          </div>

          {/* Project Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Progress</p>
                    <p className="text-2xl font-bold">{project?.progress || 0}%</p>
                  </div>
                  <div className="w-full max-w-[60px]">
                    <Progress value={project?.progress || 0} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Installation Date</p>
                    <p className="text-sm font-bold">
                      {project?.installation_date ? 
                        new Date(project.installation_date).toLocaleDateString() : 
                        'Not set'
                      }
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <Badge className={getStatusColor(project?.status || '')}>
                      {project?.status}
                    </Badge>
                  </div>
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold">
                      {phases?.reduce((acc, phase) => acc + (phase.tasks?.length || 0), 0) || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Description */}
          {project?.description && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{project.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Phases and Tasks */}
          <div className="space-y-6">
            {phases?.map((phase) => {
              const stats = getTaskStats(phase.tasks || []);
              
              return (
                <Card key={phase.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{phase.name}</span>
                          <Badge variant="outline">{stats.total} tasks</Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(phase.start_date).toLocaleDateString()} - {new Date(phase.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                          <span className="text-green-600 font-medium">{stats.completed}</span> completed,{' '}
                          <span className="text-blue-600 font-medium">{stats.inProgress}</span> in progress,{' '}
                          <span className="text-yellow-600 font-medium">{stats.pending}</span> pending
                        </div>
                        <Progress value={phase.progress || 0} className="w-24" />
                        <span className="text-sm font-medium">{phase.progress || 0}%</span>
                        {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager') && (
                          <Button
                            onClick={() => {
                              setSelectedPhaseId(phase.id);
                              setShowNewTaskModal(true);
                            }}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Task
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {phase.tasks && phase.tasks.length > 0 && (
                    <CardContent>
                      <div className="space-y-3">
                        {phase.tasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              {getStatusIcon(task.status)}
                              <div>
                                <p className="font-medium">{task.title}</p>
                                {task.description && (
                                  <p className="text-sm text-gray-600">{task.description}</p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                  <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                  <span>Priority: {task.priority}</span>
                                  <span>Workstation: {task.workstation}</span>
                                  {task.assignee_name && (
                                    <span>Assigned to: {task.assignee_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Badge className={getStatusColor(task.status)}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                  
                  {(!phase.tasks || phase.tasks.length === 0) && (
                    <CardContent>
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No tasks in this phase yet.</p>
                        {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'manager') && (
                          <Button
                            onClick={() => {
                              setSelectedPhaseId(phase.id);
                              setShowNewTaskModal(true);
                            }}
                            className="mt-4"
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add First Task
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* No phases message */}
          {(!phases || phases.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No phases found</h3>
                <p className="text-gray-600">This project doesn't have any phases yet.</p>
              </CardContent>
            </Card>
          )}

          {/* New Task Modal */}
          {showNewTaskModal && selectedPhaseId && (
            <NewTaskModal
              phase_id={selectedPhaseId}
              onClose={() => {
                setShowNewTaskModal(false);
                setSelectedPhaseId(null);
              }}
              onSuccess={() => {
                setShowNewTaskModal(false);
                setSelectedPhaseId(null);
                queryClient.invalidateQueries({ queryKey: ['project', id] });
                queryClient.invalidateQueries({ queryKey: ['projectPhases', id] });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
