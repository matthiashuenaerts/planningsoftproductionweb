
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
  
  const handleToggleTask = async (taskId: string, checked: boolean) => {
    try {
      setProcessingTask(taskId);
      
      if (checked) {
        // Link standard task to workstation
        const { data, error } = await supabase
          .from('standard_task_workstation_links')
          .insert([{
            standard_task_id: taskId,
            workstation_id: workstationId
          }])
          .select();
          
        if (error) throw error;
        
        setTaskLinks(prev => ({ ...prev, [taskId]: true }));
      } else {
        // Unlink standard task from workstation
        const { error } = await supabase
          .from('standard_task_workstation_links')
          .delete()
          .eq('standard_task_id', taskId)
          .eq('workstation_id', workstationId);
          
        if (error) throw error;
        
        setTaskLinks(prev => ({ ...prev, [taskId]: false }));
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
      setTaskLinks(prev => ({ ...prev, [taskId]: !checked }));
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
