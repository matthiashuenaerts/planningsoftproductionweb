import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Play, CheckCircle2, Loader2 } from 'lucide-react';

interface ProjectTask {
  id: string;
  status: string;
  phase_id: string;
  standard_task_id: string | null;
  standard_task_name: string;
  phase_name: string;
  is_installation_task: boolean;
}

interface InstallationTaskListProps {
  projectId: string;
  onInstallationTaskComplete?: (taskId: string) => void;
  installationStandardTaskId?: string | null;
  installationStandardTaskIds?: string[];
}

const InstallationTaskList: React.FC<InstallationTaskListProps> = ({
  projectId,
  onInstallationTaskComplete,
  installationStandardTaskId,
  installationStandardTaskIds = [],
}) => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Combine both props for backwards compat
  const allInstallationIds = new Set([
    ...(installationStandardTaskId ? [installationStandardTaskId] : []),
    ...installationStandardTaskIds,
  ]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: phases } = await supabase
        .from('phases')
        .select('id, name')
        .eq('project_id', projectId);

      if (!phases || phases.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const phaseIds = phases.map(p => p.id);
      const phaseMap = Object.fromEntries(phases.map(p => [p.id, p.name]));

      // Include HOLD status tasks too - installation tasks should be visible even on HOLD
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, status, phase_id, standard_task_id')
        .in('phase_id', phaseIds)
        .in('status', ['TODO', 'IN_PROGRESS', 'HOLD'])
        .order('created_at', { ascending: true });

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const standardTaskIds = [...new Set(tasksData.filter(t => t.standard_task_id).map(t => t.standard_task_id!))];
      let stMap: Record<string, { name: string; isInstallation: boolean }> = {};
      if (standardTaskIds.length > 0) {
        const { data: stData } = await supabase
          .from('standard_tasks')
          .select('id, task_name, is_installation_task')
          .in('id', standardTaskIds);
        stMap = Object.fromEntries((stData || []).map(s => [s.id, { 
          name: s.task_name, 
          isInstallation: s.is_installation_task || false 
        }]));
      }

      // Filter: only show tasks that are installation tasks OR are TODO/IN_PROGRESS
      const mapped: ProjectTask[] = tasksData.map(t => {
        const stInfo = t.standard_task_id ? stMap[t.standard_task_id] : null;
        return {
          id: t.id,
          status: t.status,
          phase_id: t.phase_id,
          standard_task_id: t.standard_task_id,
          standard_task_name: stInfo?.name || 'Taak',
          phase_name: phaseMap[t.phase_id] || '',
          is_installation_task: stInfo?.isInstallation || allInstallationIds.has(t.standard_task_id || ''),
        };
      });

      // Show: installation tasks (any status), or TODO/IN_PROGRESS tasks
      const filtered = mapped.filter(t => 
        t.is_installation_task || t.status === 'TODO' || t.status === 'IN_PROGRESS'
      );

      setTasks(filtered);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, allInstallationIds.size]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const startTask = async (taskId: string) => {
    if (!currentEmployee?.id) return;
    setActionLoading(taskId);
    try {
      // Update task status (change HOLD to IN_PROGRESS too)
      await supabase.from('tasks').update({ 
        status: 'IN_PROGRESS', 
        updated_at: new Date().toISOString() 
      }).eq('id', taskId);
      
      // Create time registration (activates the task timer)
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const { data: phase } = await supabase.from('phases').select('project_id').eq('id', task.phase_id).single();
        if (phase) {
          // Stop any existing active time registrations for this employee
          await supabase
            .from('time_registrations')
            .update({ end_time: new Date().toISOString(), is_active: false })
            .eq('employee_id', currentEmployee.id)
            .eq('is_active', true);

          // Start new time registration
          await supabase.from('time_registrations').insert({
            employee_id: currentEmployee.id,
            task_id: taskId,
            project_id: phase.project_id,
            start_time: new Date().toISOString(),
            is_active: true,
          });
        }
      }

      toast({ title: t('inst_task_started'), description: t('inst_task_started_desc') });
      loadTasks();
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const completeTask = async (taskId: string) => {
    if (!currentEmployee?.id) return;
    
    const task = tasks.find(t => t.id === taskId);
    // If this is an installation task, trigger the special completion flow
    if (task?.is_installation_task) {
      onInstallationTaskComplete?.(taskId);
      return;
    }

    setActionLoading(taskId);
    try {
      await supabase.from('tasks').update({ 
        status: 'COMPLETED', 
        completed_by: currentEmployee.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      }).eq('id', taskId);

      // Close active time registration
      await supabase
        .from('time_registrations')
        .update({ end_time: new Date().toISOString(), is_active: false })
        .eq('task_id', taskId)
        .eq('employee_id', currentEmployee.id)
        .eq('is_active', true);

      toast({ title: t('inst_task_completed'), description: t('inst_task_completed_desc') });
      loadTasks();
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> {t('inst_tasks')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('inst_no_tasks')}</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                  task.is_installation_task
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {task.is_installation_task && '⭐ '}
                    {task.standard_task_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{task.phase_name}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge 
                    variant={task.status === 'IN_PROGRESS' ? 'default' : task.status === 'HOLD' ? 'outline' : 'secondary'} 
                    className="text-[10px]"
                  >
                    {task.status === 'IN_PROGRESS' ? t('in_progress') : task.status === 'HOLD' ? 'HOLD' : 'TODO'}
                  </Badge>
                  {(task.status === 'TODO' || task.status === 'HOLD') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startTask(task.id)}
                      disabled={actionLoading === task.id}
                      className="h-8"
                    >
                      {actionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                      {t('inst_start_task')}
                    </Button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <Button
                      size="sm"
                      onClick={() => completeTask(task.id)}
                      disabled={actionLoading === task.id}
                      className={`h-8 ${task.is_installation_task ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      {actionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {t('inst_complete_task')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstallationTaskList;
