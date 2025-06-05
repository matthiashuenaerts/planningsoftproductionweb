
import React, { useState, useEffect } from 'react';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface LimitPhase {
  id: string;
  standard_task_id: string;
  standard_task_number: string;
  standard_task_name: string;
}

const StandardTasksSettings: React.FC = () => {
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [limitPhases, setLimitPhases] = useState<Record<string, LimitPhase[]>>({});
  const [allStandardTasks, setAllStandardTasks] = useState<StandardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching standard tasks...');
        const tasks = await standardTasksService.getAll();
        console.log('Standard tasks loaded:', tasks);
        setStandardTasks(tasks);
        
        // Fetch all standard tasks for limit phase selection
        const allTasks = await standardTasksService.getAllStandardTasksForLimitPhases();
        console.log('All standard tasks for limit phases:', allTasks);
        setAllStandardTasks(allTasks);
        
        // Fetch limit phases for each standard task
        const limitPhasesData: Record<string, LimitPhase[]> = {};
        for (const task of tasks) {
          try {
            const taskLimitPhases = await standardTasksService.getLimitPhases(task.id);
            console.log(`Limit phases for task ${task.task_number}:`, taskLimitPhases);
            limitPhasesData[task.id] = taskLimitPhases;
          } catch (error) {
            console.error(`Error fetching limit phases for task ${task.id}:`, error);
            limitPhasesData[task.id] = [];
          }
        }
        setLimitPhases(limitPhasesData);
      } catch (error) {
        console.error('Error loading standard tasks:', error);
        toast({
          title: 'Error loading standard tasks',
          description: `Failed to load standard tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const getTaskNameParts = (taskName: string): string[] => {
    return standardTasksService.getTaskNameParts(taskName);
  };

  const handleCoefficientChange = (taskId: string, value: string) => {
    const updatedTasks = standardTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, time_coefficient: parseFloat(value) || 0 };
      }
      return task;
    });
    setStandardTasks(updatedTasks);
  };

  const saveTimeCoefficient = async (task: StandardTask) => {
    setSaving(prev => ({ ...prev, [task.id]: true }));
    try {
      await standardTasksService.updateTimeCoefficient(task.id, task.time_coefficient);
      toast({
        title: 'Success',
        description: `Time coefficient for ${task.task_number} updated successfully`,
      });
    } catch (error) {
      console.error('Error updating time coefficient:', error);
      toast({
        title: 'Error',
        description: 'Failed to update time coefficient. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleLimitPhaseToggle = async (taskId: string, limitStandardTaskId: string, isChecked: boolean) => {
    try {
      if (isChecked) {
        // Add the limit phase
        console.log(`Adding limit phase: task ${taskId} -> limit task ${limitStandardTaskId}`);
        const newLimitPhase = await standardTasksService.addLimitPhase(taskId, limitStandardTaskId);
        setLimitPhases(prev => ({
          ...prev,
          [taskId]: [...(prev[taskId] || []), newLimitPhase]
        }));
        toast({
          title: 'Success',
          description: 'Limit phase added successfully',
        });
      } else {
        // Remove the limit phase
        const currentLimitPhases = limitPhases[taskId] || [];
        const phaseToRemove = currentLimitPhases.find(phase => phase.standard_task_id === limitStandardTaskId);
        if (phaseToRemove) {
          console.log(`Removing limit phase: ${phaseToRemove.id}`);
          await standardTasksService.removeLimitPhase(phaseToRemove.id);
          setLimitPhases(prev => ({
            ...prev,
            [taskId]: prev[taskId]?.filter(phase => phase.id !== phaseToRemove.id) || []
          }));
          toast({
            title: 'Success',
            description: 'Limit phase removed successfully',
          });
        }
      }
    } catch (error) {
      console.error('Error updating limit phase:', error);
      toast({
        title: 'Error',
        description: `Failed to update limit phase: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    }
  };

  const removeLimitPhase = async (taskId: string, limitPhaseId: string) => {
    try {
      await standardTasksService.removeLimitPhase(limitPhaseId);
      setLimitPhases(prev => ({
        ...prev,
        [taskId]: prev[taskId]?.filter(phase => phase.id !== limitPhaseId) || []
      }));
      toast({
        title: 'Success',
        description: 'Limit phase removed successfully',
      });
    } catch (error) {
      console.error('Error removing limit phase:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove limit phase. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Standard Tasks</h2>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Task #</TableHead>
                <TableHead>Task Name</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-32">Time Coefficient</TableHead>
                <TableHead className="w-20">Actions</TableHead>
                <TableHead className="w-96">Limit Phases (Standard Tasks)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standardTasks.map((task) => {
                const taskParts = getTaskNameParts(task.task_name);
                const taskLimitPhases = limitPhases[task.id] || [];
                
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.task_number}</TableCell>
                    <TableCell>{task.task_name}</TableCell>
                    <TableCell>
                      {taskParts.length > 1 ? (
                        <div className="text-xs text-muted-foreground">
                          {taskParts.map((part, index) => (
                            <span key={index} className="mr-1">
                              {index > 0 && <span className="mx-1">→</span>}
                              {part}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.1"
                        min="0"
                        value={task.time_coefficient} 
                        onChange={(e) => handleCoefficientChange(task.id, e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => saveTimeCoefficient(task)} 
                        disabled={saving[task.id]}
                        className="w-full"
                      >
                        {saving[task.id] ? (
                          <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        {/* Current limit phases */}
                        <div className="flex flex-wrap gap-1">
                          {taskLimitPhases.map((limitPhase) => (
                            <Badge key={limitPhase.id} variant="secondary" className="flex items-center gap-1">
                              {limitPhase.standard_task_number} - {limitPhase.standard_task_name}
                              <button
                                onClick={() => removeLimitPhase(task.id, limitPhase.id)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        
                        {/* Available standard tasks to select as limit phases */}
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                          <div className="text-xs font-medium text-gray-600">Available Standard Tasks:</div>
                          {allStandardTasks
                            .filter(standardTask => standardTask.id !== task.id) // Don't allow self-reference
                            .map((standardTask) => {
                              const isSelected = taskLimitPhases.some(lp => lp.standard_task_id === standardTask.id);
                              return (
                                <div key={standardTask.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${task.id}-${standardTask.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => 
                                      handleLimitPhaseToggle(task.id, standardTask.id, checked as boolean)
                                    }
                                  />
                                  <label 
                                    htmlFor={`${task.id}-${standardTask.id}`}
                                    className="text-xs cursor-pointer flex-1"
                                  >
                                    {standardTask.task_number} - {standardTask.task_name}
                                  </label>
                                </div>
                              );
                            })}
                          {allStandardTasks.length === 0 && (
                            <div className="text-xs text-gray-500">No standard tasks available</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StandardTasksSettings;
