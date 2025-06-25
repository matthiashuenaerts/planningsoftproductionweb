
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { taskService } from '@/services/dataService';
import { workstationService } from '@/services/workstationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Pause, CheckCircle2, Clock, AlertCircle, ArrowLeft, User, Calendar, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD";
  priority: "Low" | "Medium" | "High" | "Urgent";
  due_date: string;
  assignee_id?: string;
  project_name?: string;
  workstation: string;
  phase_id: string;
}

interface Workstation {
  id: string;
  name: string;
  description: string | null;
}

interface WorkstationViewProps {
  workstationId: string;
  onBack: () => void;
}

const WorkstationView: React.FC<WorkstationViewProps> = ({ workstationId, onBack }) => {
  const [workstation, setWorkstation] = useState<Workstation | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const loadWorkstationData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load workstation details
      const workstationData = await workstationService.getById(workstationId);
      setWorkstation(workstationData);
      
      // Load tasks for this workstation
      const tasksData = await taskService.getByWorkstationId(workstationId);
      setTasks(tasksData);
      
    } catch (error: any) {
      console.error('Error loading workstation data:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_workstation_data', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [workstationId, toast, t]);

  useEffect(() => {
    loadWorkstationData();
  }, [loadWorkstationData]);

  const handleStartTask = async (task: Task) => {
    if (!currentEmployee) return;
    
    try {
      await timeRegistrationService.startTask(currentEmployee.id, task.id);
      
      // Invalidate queries to refresh the TaskTimer
      queryClient.invalidateQueries({
        queryKey: ['activeTimeRegistration']
      });
      
      toast({
        title: t('task_started'),
        description: t('task_started_desc', { taskName: task.title })
      });
      
      // Refresh tasks
      await loadWorkstationData();
      
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_start_task', { message: error.message }),
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'TODO':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">{t('status_todo')}</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('status_in_progress')}</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('status_completed')}</Badge>;
      case 'HOLD':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">{t('status_hold')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('priority_urgent_label')}</Badge>;
      case 'High':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('priority_high_label')}</Badge>;
      case 'Medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('priority_medium_label')}</Badge>;
      case 'Low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('priority_low_label')}</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TODO':
        return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS':
        return <Play className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'HOLD':
        return <Pause className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!workstation) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">{t('workstation_not_found')}</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_workstations')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{workstation.name}</h1>
          {workstation.description && (
            <p className="text-muted-foreground mt-1">{workstation.description}</p>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">{t('tasks')}</h2>
        
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t('no_tasks_available')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(task.status)}
                        <h3 className="font-medium">{task.title}</h3>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                        
                        {task.project_name && (
                          <Badge variant="outline">{task.project_name}</Badge>
                        )}
                        
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTask(task)}
                      >
                        {t('view_details')}
                      </Button>
                      
                      {task.status === 'TODO' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartTask(task)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {t('start_task')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              {t('task_details')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(selectedTask.status)}
                {getPriorityBadge(selectedTask.priority)}
                
                {selectedTask.project_name && (
                  <Badge variant="outline">{selectedTask.project_name}</Badge>
                )}
              </div>
              
              {selectedTask.description && (
                <div>
                  <h4 className="font-medium mb-2">{t('description')}</h4>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">{t('due_date')}:</span>
                  <p className="text-muted-foreground">{new Date(selectedTask.due_date).toLocaleDateString()}</p>
                </div>
                
                <div>
                  <span className="font-medium">{t('workstation')}:</span>
                  <p className="text-muted-foreground">{selectedTask.workstation}</p>
                </div>
              </div>
              
              {selectedTask.status === 'TODO' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      handleStartTask(selectedTask);
                      setSelectedTask(null);
                    }}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {t('start_task')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkstationView;
