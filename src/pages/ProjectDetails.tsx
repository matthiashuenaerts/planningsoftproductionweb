
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, ListChecks } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils"
import { Project, Phase, Task } from '@/services/dataService';
import { taskService } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { PartsListImporter } from '@/components/PartsListImporter';
import { supabase } from '@/integrations/supabase/client';

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjectData = async () => {
    if (!projectId) {
      setError('Project ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData as Project);

      // Load phases for the project
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date');

      if (phasesError) throw phasesError;
      setPhases(phasesData || []);

      // Load tasks for the project phases
      if (phasesData && phasesData.length > 0) {
        const phaseIds = phasesData.map(p => p.id);
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('phase_id', phaseIds)
          .order('due_date');

        if (tasksError) throw tasksError;
        // Cast the tasks data to match our Task interface
        const typedTasks = (tasksData || []).map(task => ({
          ...task,
          status: task.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD',
          priority: task.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
        })) as Task[];
        setTasks(typedTasks);
      }

    } catch (err: any) {
      console.error('Error loading project details:', err);
      setError(err.message || 'Failed to load project details.');
      toast({
        title: "Error",
        description: `Failed to load data: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  if (loading) {
    return <div className="text-center">Loading project details...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <h1 className="text-2xl font-bold">Project Details</h1>
      </div>

      {project && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p>{project.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Client</p>
                    <p>{project.client}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Start Date</p>
                    <p>{format(new Date(project.start_date), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Installation Date</p>
                    <p>{format(new Date(project.installation_date), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p>{project.description || 'No description provided.'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Phases */}
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>Phases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {phases.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phases.map((phase) => (
                      <Card key={phase.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{phase.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Start Date: {format(new Date(phase.start_date), 'PPP')}</p>
                          <p className="text-xs">End Date: {format(new Date(phase.end_date), 'PPP')}</p>
                          <Badge variant="outline">Progress: {phase.progress}%</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No phases defined for this project.</p>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                      <Card key={task.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Due Date: {format(new Date(task.due_date), 'PPP')}</p>
                          <p className="text-xs">Workstation: {task.workstation}</p>
                          <Badge variant="outline">Priority: {task.priority}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No tasks defined for this project.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Parts List Import */}
            <PartsListImporter
              projectId={projectId!}
              tasks={tasks}
              onImportComplete={loadProjectData}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
