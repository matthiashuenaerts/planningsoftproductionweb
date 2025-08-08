import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, Clock, Activity, AlertCircle, FolderOpen, CheckCircle, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { WorkstationStatus } from '@/services/floorplanService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WorkstationRushOrdersDisplay from '@/components/WorkstationRushOrdersDisplay';

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  assignee_id?: string;
  workstation: string;
}

interface AnimatedWorkstationDetailsDialogProps {
  workstation: {
    id: string;
    name: string;
    description?: string;
    image_path?: string | null;
  } | null;
  status?: WorkstationStatus;
  isOpen: boolean;
  onClose: () => void;
}

export const AnimatedWorkstationDetailsDialog: React.FC<AnimatedWorkstationDetailsDialogProps> = ({
  workstation,
  status,
  isOpen,
  onClose
}) => {
  const { currentEmployee } = useAuth();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTask[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

  if (!workstation) return null;

  const getStatusInfo = () => {
    if (!status) {
      return {
        color: 'orange',
        text: 'Not in use',
        icon: <Activity className="h-4 w-4 text-orange-500" />
      };
    }
    
    if (status.has_error) {
      return {
        color: 'red',
        text: 'Error',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />
      };
    }
    
    if (status.is_active) {
      return {
        color: 'green',
        text: `In Use (${status.active_users_count} user${status.active_users_count > 1 ? 's' : ''})`,
        icon: <Users className="h-4 w-4 text-green-500" />
      };
    }
    
    return {
      color: 'orange',
      text: 'Available',
      icon: <Activity className="h-4 w-4 text-orange-500" />
    };
  };

  const statusInfo = getStatusInfo();

  const fetchProjectTasks = async (projectId: string) => {
    if (loadingTasks.has(projectId) || projectTasks[projectId]) return;
    
    setLoadingTasks(prev => new Set(prev).add(projectId));
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          assignee_id,
          workstation,
          phases!inner(project_id)
        `)
        .eq('phases.project_id', projectId)
        .eq('workstation', workstation.name)
        .in('status', ['TODO', 'IN_PROGRESS']);
      
      if (error) throw error;
      
      setProjectTasks(prev => ({
        ...prev,
        [projectId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      toast.error('Failed to load project tasks');
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      fetchProjectTasks(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const startTask = async (task: ProjectTask) => {
    if (!currentEmployee) {
      toast.error('You must be logged in to start a task');
      return;
    }

    try {
      await timeRegistrationService.startTask(currentEmployee.id, task.id);
      toast.success(`Started task: ${task.title}`);
      
      // Update local state to reflect the change
      setProjectTasks(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(prev).map(([projId, tasks]) => [
            projId,
            tasks.map(t => 
              t.id === task.id 
                ? { ...t, status: 'IN_PROGRESS', assignee_id: currentEmployee.id }
                : t
            )
          ])
        )
      }));
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Full-screen Background Image */}
      {workstation.image_path && (
        <div 
          className="fixed inset-0 z-40 bg-cover bg-center animate-fade-in"
          style={{ 
            backgroundImage: `url(${workstation.image_path})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}
      
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden relative animate-scale-in z-50 fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-transparent border-none shadow-none">
        {/* Content Overlay */}
        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-lg p-6 animate-fade-in delay-200 border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>{workstation.name}</span>
              <Badge variant={statusInfo.color === 'green' ? 'default' : 'destructive'} className="ml-2">
                {statusInfo.text}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Basic Information */}
            <Card className="bg-white/20 backdrop-blur border border-white/30 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Activity className="h-5 w-5 text-white" />
                  <span>Workstation Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workstation.description && (
                  <div>
                    <span className="text-sm font-medium text-white">Description:</span>
                    <p className="text-sm text-white/80 mt-1">{workstation.description}</p>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  {statusInfo.icon}
                  <span className="text-sm font-medium text-white">Status:</span>
                  <span className="text-sm text-white/80">{statusInfo.text}</span>
                </div>
              </CardContent>
            </Card>

            {/* Active Tasks */}
            {status && status.active_tasks.length > 0 && (
              <Card className="bg-white/20 backdrop-blur border border-white/30 shadow-lg animate-slide-in-right delay-300">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <CheckCircle className="h-5 w-5 text-white" />
                    <span>Active Tasks ({status.active_tasks.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {status.active_tasks.map((task, index) => (
                      <div key={index} className="p-3 bg-white/15 backdrop-blur rounded-md border border-white/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-white">{task.task_title}</span>
                          <Badge variant="outline">Active</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-xs text-white/70">
                            <Users className="h-3 w-3 text-white/70" />
                            <span>Employee: {task.employee_name}</span>
                          </div>
                          {task.project_name && (
                            <div className="flex items-center space-x-2 text-xs text-white/70">
                              <FolderOpen className="h-3 w-3 text-white/70" />
                              <span>Project: {task.project_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Projects */}
            {status && status.current_projects.length > 0 && (
              <Card className="bg-white/20 backdrop-blur border border-white/30 shadow-lg animate-slide-in-right delay-400">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <FolderOpen className="h-5 w-5 text-white" />
                    <span>Current Projects ({status.current_projects.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {status.current_projects.map((project, index) => (
                      <Collapsible 
                        key={index}
                        open={expandedProjects.has(project.project_id)}
                        onOpenChange={() => toggleProject(project.project_id)}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-2 bg-white/15 backdrop-blur rounded-md border border-white/20 cursor-pointer hover:bg-white/25 transition-colors">
                            <div>
                              <span className="text-sm font-medium text-white">{project.project_name}</span>
                              <div className="text-xs text-white/70">
                                {project.task_count} task{project.task_count > 1 ? 's' : ''} pending
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">{project.task_count}</Badge>
                              {expandedProjects.has(project.project_id) ? 
                                <ChevronUp className="h-4 w-4 text-white/70" /> : 
                                <ChevronDown className="h-4 w-4 text-white/70" />
                              }
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="space-y-2 ml-4">
                            {loadingTasks.has(project.project_id) ? (
                              <div className="text-sm text-white/70">Loading tasks...</div>
                            ) : projectTasks[project.project_id]?.length > 0 ? (
                              projectTasks[project.project_id].map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-3 bg-white/15 backdrop-blur rounded-md border border-white/20">
                                  <div>
                                    <div className="text-sm font-medium text-white">{task.title}</div>
                                    <div className="text-xs text-white/70 flex items-center space-x-2">
                                      <Badge variant={task.status === 'IN_PROGRESS' ? 'default' : 'outline'} className="text-xs">
                                        {task.status}
                                      </Badge>
                                      {task.assignee_id && currentEmployee?.id === task.assignee_id && (
                                        <span className="text-xs text-green-300">Assigned to you</span>
                                      )}
                                    </div>
                                  </div>
                                  {task.status === 'TODO' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startTask(task);
                                      }}
                                      className="h-8 px-3"
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Start
                                    </Button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-white/70">No pending tasks for this workstation</div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rush Orders */}
            <Card className="bg-white/20 backdrop-blur border border-white/30 shadow-lg animate-slide-in-right delay-500">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <AlertCircle className="h-5 w-5 text-red-300" />
                  <span>Rush Orders</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorkstationRushOrdersDisplay workstationId={workstation.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};