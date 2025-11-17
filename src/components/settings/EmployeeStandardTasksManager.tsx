import React, { useState, useEffect } from 'react';
import { CheckboxCard } from '@/components/settings/CheckboxCard';
import { useToast } from '@/hooks/use-toast';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeStandardTasksManagerProps {
  employeeId: string;
  employeeName: string;
}

export const EmployeeStandardTasksManager: React.FC<EmployeeStandardTasksManagerProps> = ({ 
  employeeId,
  employeeName
}) => {
  const [loading, setLoading] = useState(true);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [taskLinks, setTaskLinks] = useState<Record<string, boolean>>({});
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const { toast } = useToast();

  // Load all standard tasks and the linked standard tasks for this employee
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get all standard tasks
        const allTasks = await standardTasksService.getAll();
        setStandardTasks(allTasks);
        
        // Get all employee-standard task links for this employee
        const links = await supabase
          .from('employee_standard_task_links')
          .select('standard_task_id')
          .eq('employee_id', employeeId);
        
        if (links.error) throw links.error;
        
        // Create a map of standard task IDs to boolean (true if linked)
        const linkMap: Record<string, boolean> = {};
        links.data.forEach(link => {
          linkMap[link.standard_task_id] = true;
        });
        
        setTaskLinks(linkMap);
      } catch (error: any) {
        console.error('Error loading employee standard task data:', error);
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
  }, [employeeId]);
  
  const handleToggleTask = async (taskId: string, checked: boolean) => {
    try {
      setProcessingTask(taskId);
      
      if (checked) {
        // Link employee to standard task
        await standardTasksService.linkEmployeeToStandardTask(employeeId, taskId);
        setTaskLinks(prev => ({ ...prev, [taskId]: true }));
      } else {
        // Unlink employee from standard task
        await standardTasksService.unlinkEmployeeFromStandardTask(employeeId, taskId);
        setTaskLinks(prev => ({ ...prev, [taskId]: false }));
      }
      
      toast({
        title: "Success",
        description: checked 
          ? `Standard task assigned to employee` 
          : `Standard task removed from employee`
      });
    } catch (error: any) {
      console.error('Error updating employee standard task:', error);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {standardTasks.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">
            No standard tasks found in the system
          </p>
        ) : (
          standardTasks.map(task => (
            <CheckboxCard
              key={task.id}
              id={task.id}
              title={`${task.task_number} - ${task.task_name}`}
              description={`Coefficient: ${task.time_coefficient}, Days: ${task.day_counter}`}
              checked={!!taskLinks[task.id]}
              onCheckedChange={(checked) => handleToggleTask(task.id, checked)}
              disabled={processingTask === task.id}
            />
          ))
        )}
      </div>
    </div>
  );
};
