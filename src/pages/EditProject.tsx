
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calculator, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, Project, phaseService, Phase, taskService, Task } from '@/services/dataService';
import { useLanguage } from '@/context/LanguageContext';
import { standardTasksService } from '@/services/standardTasksService';

const EditProject = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<{ [phaseId: string]: Task[] }>({});
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    start_date: '',
    installation_date: '',
    status: 'planned' as "planned" | "in_progress" | "completed" | "on_hold",
    project_link_id: ''
  });

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const [projectData, phasesData] = await Promise.all([
          projectService.getById(projectId),
          phaseService.getByProject(projectId)
        ]);
        
        if (projectData) {
          setProject(projectData);
          setFormData({
            name: projectData.name,
            client: projectData.client,
            description: projectData.description || '',
            start_date: projectData.start_date,
            installation_date: projectData.installation_date,
            status: projectData.status,
            project_link_id: projectData.project_link_id || ''
          });
        }
        
        setPhases(phasesData);
        
        // Load tasks for each phase
        const tasksData: { [phaseId: string]: Task[] } = {};
        for (const phase of phasesData) {
          try {
            const phaseTasks = await taskService.getByPhase(phase.id);
            tasksData[phase.id] = phaseTasks;
          } catch (error) {
            console.error(`Failed to load tasks for phase ${phase.id}:`, error);
            tasksData[phase.id] = [];
          }
        }
        setTasks(tasksData);
        
      } catch (error: any) {
        toast({
          title: t('error'),
          description: t('failed_to_load_project', { message: error.message }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, toast, t]);

  const updateTaskDueDates = async (newInstallationDate: string) => {
    if (!projectId) return;

    try {
      // Get all tasks with standard_task_id from all phases
      const allTasks = Object.values(tasks).flat().filter(task => task.standard_task_id);
      
      for (const task of allTasks) {
        if (task.standard_task_id) {
          // Get the standard task to access day_counter
          const standardTask = await standardTasksService.getById(task.standard_task_id);
          if (standardTask) {
            // Calculate new due date
            const installationDate = new Date(newInstallationDate);
            const newDueDate = standardTasksService.calculateTaskDueDate(installationDate, standardTask.day_counter);
            const dueDateString = newDueDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            
            // Update task in database
            await taskService.update(task.id, { due_date: dueDateString });
            
            // Update local state
            setTasks(prevTasks => {
              const updatedTasks = { ...prevTasks };
              Object.keys(updatedTasks).forEach(phaseId => {
                updatedTasks[phaseId] = updatedTasks[phaseId].map(t =>
                  t.id === task.id ? { ...t, due_date: dueDateString } : t
                );
              });
              return updatedTasks;
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating task due dates:', error);
      toast({
        title: t('error'),
        description: `Failed to update task due dates: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !project) return;

    try {
      setSaving(true);
      
      // Check if installation date changed
      const installationDateChanged = formData.installation_date !== project.installation_date;
      
      await projectService.update(projectId, formData);
      
      // Update task due dates if installation date changed
      if (installationDateChanged) {
        await updateTaskDueDates(formData.installation_date);
      }
      
      toast({
        title: t('success'),
        description: t('project_updated_successfully')
      });
      navigate(createLocalizedPath(`/projects/${projectId}`));
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_update_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTaskDurationUpdate = async (taskId: string, newDuration: number) => {
    try {
      setSavingTask(taskId);
      await taskService.update(taskId, { duration: newDuration, estimated_duration: newDuration });
      
      // Update local state
      setTasks(prevTasks => {
        const updatedTasks = { ...prevTasks };
        Object.keys(updatedTasks).forEach(phaseId => {
          updatedTasks[phaseId] = updatedTasks[phaseId].map(task =>
            task.id === taskId ? { ...task, duration: newDuration, estimated_duration: newDuration } : task
          );
        });
        return updatedTasks;
      });
      
      toast({
        title: t('success'),
        description: 'Task duration updated successfully'
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: `Failed to update task duration: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSavingTask(null);
    }
  };

  const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes) return '0 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
              <h2 className="text-2xl font-bold mb-2">{t('project_not_found')}</h2>
              <p className="text-muted-foreground mb-4">{t('project_not_found_description')}</p>
              <Button onClick={() => navigate(createLocalizedPath('/projects'))}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(createLocalizedPath('/projects'))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate(createLocalizedPath(`/projects/${projectId}/calculation`))}
            >
              <Calculator className="mr-2 h-4 w-4" /> Project Calculation
            </Button>
          </div>
          
          <Tabs defaultValue="project-info" className="space-y-4">
            <TabsList>
              <TabsTrigger value="project-info">Project Info</TabsTrigger>
              <TabsTrigger value="phases-tasks">Phases & Tasks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="project-info">
              <Card>
                <CardHeader>
                  <CardTitle>{t('edit_project')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">{t('project_name')}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="client">{t('client')}</Label>
                      <Input
                        id="client"
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">{t('description')}</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="project_link_id">Project Link ID</Label>
                      <Input
                        id="project_link_id"
                        value={formData.project_link_id}
                        onChange={(e) => setFormData({ ...formData, project_link_id: e.target.value })}
                        placeholder="Enter project link ID (optional)"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date">{t('start_date')}</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="installation_date">{t('installation_date')}</Label>
                        <Input
                          id="installation_date"
                          type="date"
                          value={formData.installation_date}
                          onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => navigate(createLocalizedPath(`/projects/${projectId}`))}
                      >
                        {t('cancel')}
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? t('saving') : t('save_changes')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="phases-tasks">
              <div className="space-y-6">
                {phases.map((phase) => (
                  <Card key={phase.id}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{phase.name}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {phase.start_date} to {phase.end_date} • Progress: {phase.progress}%
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Workstation</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasks[phase.id]?.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{task.title}</div>
                                  {task.description && (
                                    <div className="text-sm text-muted-foreground">{task.description}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{task.workstation}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                  task.status === 'HOLD' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  task.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                  task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.priority}
                                </span>
                              </TableCell>
                              <TableCell>{task.due_date}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={task.duration || 0}
                                    onChange={(e) => {
                                      const newDuration = parseInt(e.target.value) || 0;
                                      handleTaskDurationUpdate(task.id, newDuration);
                                    }}
                                    disabled={savingTask === task.id}
                                    className="w-20"
                                  />
                                  <span className="text-sm text-muted-foreground">min</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {formatDuration(task.duration)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(createLocalizedPath(`/projects/${projectId}`))}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {(!tasks[phase.id] || tasks[phase.id].length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          No tasks found for this phase
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {phases.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No phases found for this project
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
