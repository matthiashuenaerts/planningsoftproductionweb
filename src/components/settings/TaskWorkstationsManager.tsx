
import React, { useState, useEffect } from 'react';
import { CheckboxCard } from '@/components/settings/CheckboxCard';
import { useToast } from '@/hooks/use-toast';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { workstationService } from '@/services/workstationService';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskWorkstationsManagerProps {
  workstationId: string;
  workstationName: string;
}

interface WorkstationInfo {
  id: string;
  name: string;
}

export const TaskWorkstationsManager: React.FC<TaskWorkstationsManagerProps> = ({ 
  workstationId,
  workstationName
}) => {
  const [loading, setLoading] = useState(true);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [taskLinks, setTaskLinks] = useState<Record<string, boolean>>({});
  const [taskWorkstationAssignments, setTaskWorkstationAssignments] = useState<Record<string, WorkstationInfo[]>>({});
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    standardTaskId: string;
    taskName: string;
    existingWorkstations: WorkstationInfo[];
    action: 'assign' | 'unassign';
  } | null>(null);
  const { toast } = useToast();

  // Load all standard tasks and the linked tasks for this workstation
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get all standard tasks
        const allStandardTasks = await standardTasksService.getAll();
        setStandardTasks(allStandardTasks);
        
        // Get all standard-task-workstation links for this workstation
        const links = await supabase
          .from('standard_task_workstation_links')
          .select('standard_task_id')
          .eq('workstation_id', workstationId);
        
        if (links.error) throw links.error;
        
        // Create a map of task IDs to boolean (true if linked)
        const linkMap: Record<string, boolean> = {};
        links.data.forEach(link => {
          linkMap[link.standard_task_id] = true;
        });
        
        setTaskLinks(linkMap);

        // Get all workstation assignments for all standard tasks
        const { data: allLinks, error: allLinksError } = await supabase
          .from('standard_task_workstation_links')
          .select(`
            standard_task_id,
            workstations (
              id,
              name
            )
          `);

        if (allLinksError) throw allLinksError;

        // Build a map of standard_task_id -> array of workstation names
        const assignmentsMap: Record<string, WorkstationInfo[]> = {};
        allLinks?.forEach((link: any) => {
          if (!assignmentsMap[link.standard_task_id]) {
            assignmentsMap[link.standard_task_id] = [];
          }
          if (link.workstations) {
            assignmentsMap[link.standard_task_id].push({
              id: link.workstations.id,
              name: link.workstations.name
            });
          }
        });
        
        setTaskWorkstationAssignments(assignmentsMap);
      } catch (error: any) {
        console.error('Error loading task workstation data:', error);
        toast({
          title: "Error",
          description: `Failed to load data: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [workstationId, toast]);

  const handleCheckboxChange = (standardTaskId: string, checked: boolean) => {
    const task = standardTasks.find(t => t.id === standardTaskId);
    const existingWorkstations = taskWorkstationAssignments[standardTaskId] || [];
    
    // Filter out the current workstation from the list
    const otherWorkstations = existingWorkstations.filter(ws => ws.id !== workstationId);

    if (checked && otherWorkstations.length > 0) {
      // Task is already assigned elsewhere, ask for confirmation
      setConfirmDialog({
        open: true,
        standardTaskId,
        taskName: task?.task_name || 'Unknown Task',
        existingWorkstations: otherWorkstations,
        action: 'assign'
      });
    } else {
      // No conflict, proceed directly
      handleToggleTask(standardTaskId, checked, false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!confirmDialog) return;
    
    const { standardTaskId, existingWorkstations, action } = confirmDialog;
    setConfirmDialog(null);
    
    // Delete existing assignments from other workstations first
    await handleToggleTask(standardTaskId, action === 'assign', true, existingWorkstations);
  };

  const handleToggleTask = async (
    standardTaskId: string, 
    checked: boolean, 
    removeFromOthers: boolean = false,
    otherWorkstations: WorkstationInfo[] = []
  ) => {
    try {
      setProcessingTask(standardTaskId);
      
      // If reassigning, first remove from other workstations
      if (removeFromOthers && otherWorkstations.length > 0) {
        for (const ws of otherWorkstations) {
          // Remove from standard_task_workstation_links
          await supabase
            .from('standard_task_workstation_links')
            .delete()
            .eq('standard_task_id', standardTaskId)
            .eq('workstation_id', ws.id);

          // Remove from task_workstation_links for actual tasks
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('standard_task_id', standardTaskId);

          if (existingTasks && existingTasks.length > 0) {
            const taskIds = existingTasks.map(t => t.id);
            await supabase
              .from('task_workstation_links')
              .delete()
              .in('task_id', taskIds)
              .eq('workstation_id', ws.id);
          }
        }
      }

      if (checked) {
        // Link standard task to workstation (template)
        const { error } = await supabase
          .from('standard_task_workstation_links')
          .insert([{
            standard_task_id: standardTaskId,
            workstation_id: workstationId
          }])
          .select();
          
        if (error) throw error;

        // Also link all existing project tasks with this standard_task_id to this workstation
        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('standard_task_id', standardTaskId);

        if (existingTasks && existingTasks.length > 0) {
          for (const task of existingTasks) {
            const { data: existingLink } = await supabase
              .from('task_workstation_links')
              .select('id')
              .eq('task_id', task.id)
              .eq('workstation_id', workstationId)
              .maybeSingle();

            if (!existingLink) {
              await supabase
                .from('task_workstation_links')
                .insert({ task_id: task.id, workstation_id: workstationId });
            }
          }
        }
        
        setTaskLinks(prev => ({ ...prev, [standardTaskId]: true }));
        
        // Update the assignments map
        setTaskWorkstationAssignments(prev => {
          const updated = { ...prev };
          // Remove from other workstations if reassigning
          if (removeFromOthers) {
            const filtered = (updated[standardTaskId] || []).filter(
              ws => !otherWorkstations.some(ows => ows.id === ws.id)
            );
            updated[standardTaskId] = [...filtered, { id: workstationId, name: workstationName }];
          } else {
            updated[standardTaskId] = [...(updated[standardTaskId] || []), { id: workstationId, name: workstationName }];
          }
          return updated;
        });
      } else {
        // Unlink standard task from workstation (template)
        const { error } = await supabase
          .from('standard_task_workstation_links')
          .delete()
          .eq('standard_task_id', standardTaskId)
          .eq('workstation_id', workstationId);
          
        if (error) throw error;

        // Also unlink all existing project tasks with this standard_task_id from this workstation
        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('standard_task_id', standardTaskId);

        if (existingTasks && existingTasks.length > 0) {
          const taskIds = existingTasks.map(t => t.id);
          await supabase
            .from('task_workstation_links')
            .delete()
            .in('task_id', taskIds)
            .eq('workstation_id', workstationId);
        }
        
        setTaskLinks(prev => ({ ...prev, [standardTaskId]: false }));
        
        // Update the assignments map
        setTaskWorkstationAssignments(prev => {
          const updated = { ...prev };
          updated[standardTaskId] = (updated[standardTaskId] || []).filter(ws => ws.id !== workstationId);
          return updated;
        });
      }
      
      toast({
        title: "Success",
        description: checked 
          ? `Task assigned to ${workstationName} workstation` 
          : `Task removed from ${workstationName} workstation`
      });
    } catch (error: any) {
      console.error('Error updating task workstation:', error);
      toast({
        title: "Error",
        description: `Failed to update: ${error.message}`,
        variant: "destructive"
      });
      // Revert UI change
      setTaskLinks(prev => ({ ...prev, [standardTaskId]: !checked }));
    } finally {
      setProcessingTask(null);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <div className="py-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardTasks.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No tasks found in the system
              </p>
            ) : (
              standardTasks.map(task => {
                const taskDescription = `Task #${task.task_number}`;
                const currentWorkstations = (taskWorkstationAssignments[task.id] || [])
                  .map(ws => ws.name);
                return (
                  <CheckboxCard
                    key={task.id}
                    id={task.id}
                    title={task.task_name}
                    description={taskDescription}
                    checked={!!taskLinks[task.id]}
                    onCheckedChange={(checked) => handleCheckboxChange(task.id, checked)}
                    disabled={processingTask === task.id}
                    currentWorkstations={currentWorkstations}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign Task?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDialog?.taskName}</strong> is currently assigned to:{' '}
              <span className="font-medium">
                {confirmDialog?.existingWorkstations.map(ws => ws.name).join(', ')}
              </span>
              <br /><br />
              Do you want to remove it from {confirmDialog?.existingWorkstations.length === 1 ? 'this workstation' : 'these workstations'} and assign it to <strong>{workstationName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>
              Yes, reassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
