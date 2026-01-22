
import React, { useState, useEffect } from 'react';
import { CheckboxCard } from '@/components/settings/CheckboxCard';
import { useToast } from '@/hooks/use-toast';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { workstationService } from '@/services/workstationService';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TaskWorkstationsManagerProps {
  workstationId: string;
  workstationName: string;
}

export const TaskWorkstationsManager: React.FC<TaskWorkstationsManagerProps> = ({ 
  workstationId,
  workstationName
}) => {
  const [loading, setLoading] = useState(true);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [taskLinks, setTaskLinks] = useState<Record<string, boolean>>({});
  const [processingTask, setProcessingTask] = useState<string | null>(null);
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
  
  const handleToggleTask = async (standardTaskId: string, checked: boolean) => {
    try {
      setProcessingTask(standardTaskId);
      
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
          // For each task, add link to this workstation (if not already linked)
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
              return (
                <CheckboxCard
                  key={task.id}
                  id={task.id}
                  title={task.task_name}
                  description={taskDescription}
                  checked={!!taskLinks[task.id]}
                  onCheckedChange={(checked) => handleToggleTask(task.id, checked)}
                  disabled={processingTask === task.id}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
