import React, { useState, useEffect } from 'react';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, Plus, Trash2, CheckSquare, Edit, AlertTriangle, Flag, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { checklistService, ChecklistItem } from '@/services/checklistService';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LimitPhase {
  id: string;
  standard_task_id: string;
  standard_task_number: string;
  standard_task_name: string;
}

interface TaskFormData {
  task_number: string;
  task_name: string;
  time_coefficient: number;
  day_counter: number;
  hourly_cost: number;
  color: string;
  multi_user_task: boolean;
}

const StandardTasksSettings: React.FC = () => {
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [limitPhases, setLimitPhases] = useState<Record<string, LimitPhase[]>>({});
  const [allStandardTasks, setAllStandardTasks] = useState<StandardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [checklistDialogOpen, setChecklistDialogOpen] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const { toast } = useToast();

  // Add/Edit task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StandardTask | null>(null);
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    task_number: '',
    task_name: '',
    time_coefficient: 0,
    day_counter: 0,
    hourly_cost: 0,
    color: '',
    multi_user_task: false
  });
  const [savingTask, setSavingTask] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<StandardTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Predefined color options
  const colorOptions = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#F43F5E', // Rose
  ];

  useEffect(() => {
    fetchData();
  }, []);

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
      
      // Fetch limit phases and checklists for each standard task
      const limitPhasesData: Record<string, LimitPhase[]> = {};
      const checklistsData: Record<string, ChecklistItem[]> = {};
      
      for (const task of tasks) {
        try {
          // Fetch limit phases
          const taskLimitPhases = await standardTasksService.getLimitPhases(task.id);
          console.log(`Limit phases for task ${task.task_number}:`, taskLimitPhases);
          limitPhasesData[task.id] = taskLimitPhases;
          
          // Fetch checklist items
          const taskChecklistItems = await checklistService.getChecklistItems(task.id);
          console.log(`Checklist items for task ${task.task_number}:`, taskChecklistItems);
          checklistsData[task.id] = taskChecklistItems;
        } catch (error) {
          console.error(`Error fetching data for task ${task.id}:`, error);
          limitPhasesData[task.id] = [];
          checklistsData[task.id] = [];
        }
      }
      setLimitPhases(limitPhasesData);
      setChecklists(checklistsData);
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

  const handleDayCounterChange = (taskId: string, value: string) => {
    const updatedTasks = standardTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, day_counter: parseInt(value) || 0 };
      }
      return task;
    });
    setStandardTasks(updatedTasks);
  };

  const handleHourlyCostChange = (taskId: string, value: string) => {
    const updatedTasks = standardTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, hourly_cost: parseFloat(value) || 0 };
      }
      return task;
    });
    setStandardTasks(updatedTasks);
  };

  const handleColorChange = (taskId: string, color: string) => {
    const updatedTasks = standardTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, color: color };
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

  const saveDayCounter = async (task: StandardTask) => {
    setSaving(prev => ({ ...prev, [`${task.id}_day`]: true }));
    try {
      await standardTasksService.updateDayCounter(task.id, task.day_counter);
      toast({
        title: 'Success',
        description: `Day counter for ${task.task_number} updated successfully`,
      });
    } catch (error) {
      console.error('Error updating day counter:', error);
      toast({
        title: 'Error',
        description: 'Failed to update day counter. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [`${task.id}_day`]: false }));
    }
  };

  const saveHourlyCost = async (task: StandardTask) => {
    setSaving(prev => ({ ...prev, [`${task.id}_hourly_cost`]: true }));
    try {
      await standardTasksService.updateHourlyCost(task.id, task.hourly_cost || 0);
      toast({
        title: 'Success',
        description: `Hourly cost for ${task.task_number} updated successfully`,
      });
    } catch (error) {
      console.error('Error updating hourly cost:', error);
      toast({
        title: 'Error',
        description: 'Failed to update hourly cost. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [`${task.id}_hourly_cost`]: false }));
    }
  };

  const saveColor = async (task: StandardTask) => {
    setSaving(prev => ({ ...prev, [`${task.id}_color`]: true }));
    try {
      console.log('Saving color for task:', task.id, 'Color:', task.color);
      await standardTasksService.updateColor(task.id, task.color || '#3B82F6');
      
      // Update the local state to reflect the saved color
      setStandardTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, color: task.color || '#3B82F6' } : t
      ));
      
      toast({
        title: 'Success',
        description: `Color for ${task.task_number} updated successfully`,
      });
    } catch (error) {
      console.error('Error updating color:', error);
      toast({
        title: 'Error',
        description: `Failed to update color: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
      
      // Revert the local state change on error
      const originalTask = standardTasks.find(t => t.id === task.id);
      if (originalTask) {
        setStandardTasks(prev => prev.map(t => 
          t.id === task.id ? originalTask : t
        ));
      }
    } finally {
      setSaving(prev => ({ ...prev, [`${task.id}_color`]: false }));
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

  // Checklist management functions
  const loadChecklistItems = async (standardTaskId: string) => {
    try {
      const items = await checklistService.getChecklistItems(standardTaskId);
      setChecklists(prev => ({
        ...prev,
        [standardTaskId]: items
      }));
    } catch (error) {
      console.error('Error loading checklist items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load checklist items',
        variant: 'destructive'
      });
    }
  };

  const addChecklistItem = async (standardTaskId: string) => {
    if (!newChecklistItem.trim()) return;
    
    try {
      const newItem = await checklistService.addChecklistItem(
        standardTaskId, 
        newChecklistItem.trim(), 
        newItemRequired
      );
      
      setChecklists(prev => ({
        ...prev,
        [standardTaskId]: [...(prev[standardTaskId] || []), newItem]
      }));
      
      setNewChecklistItem('');
      setNewItemRequired(true);
      
      toast({
        title: 'Success',
        description: 'Checklist item added successfully'
      });
    } catch (error) {
      console.error('Error adding checklist item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add checklist item',
        variant: 'destructive'
      });
    }
  };

  const deleteChecklistItem = async (standardTaskId: string, itemId: string) => {
    try {
      await checklistService.deleteChecklistItem(itemId);
      
      setChecklists(prev => ({
        ...prev,
        [standardTaskId]: prev[standardTaskId]?.filter(item => item.id !== itemId) || []
      }));
      
      toast({
        title: 'Success',
        description: 'Checklist item deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete checklist item',
        variant: 'destructive'
      });
    }
  };

  const toggleItemRequired = async (standardTaskId: string, item: ChecklistItem) => {
    try {
      const updatedItem = await checklistService.updateChecklistItem(
        item.id, 
        item.item_text, 
        !item.is_required
      );
      
      setChecklists(prev => ({
        ...prev,
        [standardTaskId]: prev[standardTaskId]?.map(i => 
          i.id === item.id ? updatedItem : i
        ) || []
      }));
      
      toast({
        title: 'Success',
        description: 'Checklist item updated successfully'
      });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update checklist item',
        variant: 'destructive'
      });
    }
  };

  // Add/Edit task functions
  const openAddTaskDialog = () => {
    setEditingTask(null);
    setTaskFormData({
      task_number: '',
      task_name: '',
      time_coefficient: 0,
      day_counter: 0,
      hourly_cost: 0,
      color: '',
      multi_user_task: false
    });
    setTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: StandardTask) => {
    setEditingTask(task);
    setTaskFormData({
      task_number: task.task_number,
      task_name: task.task_name,
      time_coefficient: task.time_coefficient,
      day_counter: task.day_counter,
      hourly_cost: task.hourly_cost || 0,
      color: task.color || '',
      multi_user_task: task.multi_user_task || false
    });
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskFormData.task_number.trim() || !taskFormData.task_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Task number and name are required',
        variant: 'destructive'
      });
      return;
    }

    setSavingTask(true);
    try {
      if (editingTask) {
        // Update existing task
        await standardTasksService.update(editingTask.id, {
          task_number: taskFormData.task_number.trim(),
          task_name: taskFormData.task_name.trim(),
          time_coefficient: taskFormData.time_coefficient,
          day_counter: taskFormData.day_counter,
          hourly_cost: taskFormData.hourly_cost,
          color: taskFormData.color || undefined,
          multi_user_task: taskFormData.multi_user_task
        });
        toast({
          title: 'Success',
          description: 'Standard task updated successfully'
        });
      } else {
        // Create new task
        await standardTasksService.create({
          task_number: taskFormData.task_number.trim(),
          task_name: taskFormData.task_name.trim(),
          time_coefficient: taskFormData.time_coefficient,
          day_counter: taskFormData.day_counter,
          hourly_cost: taskFormData.hourly_cost,
          color: taskFormData.color || undefined,
          multi_user_task: taskFormData.multi_user_task
        });
        toast({
          title: 'Success',
          description: 'Standard task created successfully'
        });
      }
      setTaskDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: 'Error',
        description: `Failed to save task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setSavingTask(false);
    }
  };

  const openDeleteDialog = (task: StandardTask) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    setDeleting(true);
    try {
      await standardTasksService.delete(taskToDelete.id);
      toast({
        title: 'Success',
        description: 'Standard task deleted successfully'
      });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Standard Tasks</h2>
        <Button onClick={openAddTaskDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 sticky top-0 bg-background">Task #</TableHead>
                  <TableHead className="sticky top-0 bg-background">Task Name</TableHead>
                  <TableHead className="w-24 sticky top-0 bg-background">Last Step</TableHead>
                  <TableHead className="w-24 sticky top-0 bg-background">Multi-User</TableHead>
                  <TableHead className="w-32 sticky top-0 bg-background">Time Coefficient</TableHead>
                  <TableHead className="w-20 sticky top-0 bg-background">Actions</TableHead>
                  <TableHead className="w-32 sticky top-0 bg-background">Day Counter</TableHead>
                  <TableHead className="w-20 sticky top-0 bg-background">Actions</TableHead>
                  <TableHead className="w-32 sticky top-0 bg-background">Hourly Cost (€)</TableHead>
                  <TableHead className="w-20 sticky top-0 bg-background">Actions</TableHead>
                  <TableHead className="w-32 sticky top-0 bg-background">Color</TableHead>
                  <TableHead className="w-20 sticky top-0 bg-background">Actions</TableHead>
                  <TableHead className="w-64 sticky top-0 bg-background">Limit Phases</TableHead>
                  <TableHead className="w-40 sticky top-0 bg-background">Checklist</TableHead>
                  <TableHead className="w-24 sticky top-0 bg-background">Edit/Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standardTasks.map((task) => {
                  const taskLimitPhases = limitPhases[task.id] || [];
                  
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium text-foreground">{task.task_number}</TableCell>
                      <TableCell className="text-foreground">{task.task_name}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  id={`last-step-${task.id}`}
                                  checked={task.is_last_production_step || false}
                                  onCheckedChange={async (checked) => {
                                    try {
                                      if (checked) {
                                        await standardTasksService.setLastProductionStep(task.id);
                                      } else {
                                        await standardTasksService.clearLastProductionStep(task.id);
                                      }
                                      await fetchData();
                                      toast({
                                        title: 'Success',
                                        description: checked 
                                          ? `"${task.task_number}" set as last production step`
                                          : 'Last production step cleared',
                                      });
                                    } catch (error) {
                                      console.error('Error updating last production step:', error);
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to update last production step',
                                        variant: 'destructive'
                                      });
                                    }
                                  }}
                                  className={task.is_last_production_step ? 'border-primary' : ''}
                                />
                                {task.is_last_production_step && (
                                  <Flag className="h-4 w-4 ml-1 text-primary" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                Mark this as the last production step. This defines the production completion date 
                                and is used for capacity calculations. Only one task can be marked.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  id={`multi-user-${task.id}`}
                                  checked={task.multi_user_task || false}
                                  onCheckedChange={async (checked) => {
                                    try {
                                      await standardTasksService.update(task.id, { multi_user_task: checked as boolean });
                                      await fetchData();
                                      toast({
                                        title: 'Success',
                                        description: checked 
                                          ? `"${task.task_number}" enabled for multi-user assignment`
                                          : 'Multi-user assignment disabled',
                                      });
                                    } catch (error) {
                                      console.error('Error updating multi_user_task:', error);
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to update multi-user setting',
                                        variant: 'destructive'
                                      });
                                    }
                                  }}
                                  className={task.multi_user_task ? 'border-primary' : ''}
                                />
                                {task.multi_user_task && (
                                  <Users className="h-4 w-4 ml-1 text-primary" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                Enable multi-user task: this task can be assigned to multiple employees 
                                simultaneously to complete faster (e.g., 2 employees = half the time).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Input 
                          type="number" 
                          step="0.1"
                          min="0"
                          value={task.time_coefficient} 
                          onChange={(e) => handleCoefficientChange(task.id, e.target.value)}
                          className="w-full bg-background text-foreground"
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
                        <Input 
                          type="number" 
                          min="0"
                          value={task.day_counter} 
                          onChange={(e) => handleDayCounterChange(task.id, e.target.value)}
                          className="w-full bg-background text-foreground"
                          placeholder="Days"
                        />
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => saveDayCounter(task)} 
                          disabled={saving[`${task.id}_day`]}
                          className="w-full"
                        >
                          {saving[`${task.id}_day`] ? (
                            <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={task.hourly_cost || 0}
                          onChange={(e) => handleHourlyCostChange(task.id, e.target.value)}
                          className="w-full bg-background text-foreground"
                          placeholder="e.g. 50.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveHourlyCost(task)}
                          disabled={saving[`${task.id}_hourly_cost`]}
                          className="w-full"
                        >
                          {saving[`${task.id}_hourly_cost`] ? (
                            <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${
                                task.color === color ? 'border-foreground shadow-md' : 'border-muted'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorChange(task.id, color)}
                              title={`Set color to ${color}`}
                            />
                          ))}
                          {/* No color option */}
                          <button
                            className={`w-6 h-6 rounded border-2 bg-background hover:scale-110 transition-transform ${
                              !task.color || task.color === '' ? 'border-foreground shadow-md' : 'border-muted'
                            }`}
                            onClick={() => handleColorChange(task.id, '')}
                            title="No color"
                          >
                            <X className="h-3 w-3 text-muted-foreground mx-auto" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => saveColor(task)} 
                          disabled={saving[`${task.id}_color`]}
                          className="w-full"
                        >
                          {saving[`${task.id}_color`] ? (
                            <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {/* Current limit phases */}
                          <div className="flex flex-wrap gap-1">
                            {taskLimitPhases.map((limitPhase) => (
                              <Badge key={limitPhase.id} variant="secondary" className="flex items-center gap-1 text-xs">
                                {limitPhase.standard_task_number}
                                <button
                                  onClick={() => removeLimitPhase(task.id, limitPhase.id)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          
                          {/* Available standard tasks to select as limit phases */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full">
                                <Plus className="h-3 w-3 mr-1" />
                                Manage
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle className="text-foreground">Limit Phases for {task.task_number}</DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                  Select which tasks must be completed before this task can start.
                                </DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-2">
                                  {allStandardTasks
                                    .filter(standardTask => standardTask.id !== task.id)
                                    .map((standardTask) => {
                                      const isSelected = taskLimitPhases.some(lp => lp.standard_task_id === standardTask.id);
                                      return (
                                        <div key={standardTask.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                                          <Checkbox
                                            id={`${task.id}-${standardTask.id}`}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => 
                                              handleLimitPhaseToggle(task.id, standardTask.id, checked as boolean)
                                            }
                                          />
                                          <label 
                                            htmlFor={`${task.id}-${standardTask.id}`}
                                            className="text-sm cursor-pointer flex-1 text-foreground"
                                          >
                                            {standardTask.task_number} - {standardTask.task_name}
                                          </label>
                                        </div>
                                      );
                                    })}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              {(checklists[task.id] || []).length} items
                            </span>
                            <Dialog
                              open={checklistDialogOpen === task.id}
                              onOpenChange={(open) => setChecklistDialogOpen(open ? task.id : null)}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadChecklistItems(task.id)}
                                >
                                  <CheckSquare className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="text-foreground">
                                    Checklist for {task.task_number} - {task.task_name}
                                  </DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  {/* Add new item */}
                                  <div className="border rounded-lg p-4 space-y-3">
                                    <h4 className="font-medium text-foreground">Add New Checklist Item</h4>
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Enter checklist item..."
                                        value={newChecklistItem}
                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                        className="bg-background text-foreground"
                                      />
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          id="required"
                                          checked={newItemRequired}
                                          onCheckedChange={setNewItemRequired}
                                        />
                                        <Label htmlFor="required" className="text-foreground">Required item</Label>
                                      </div>
                                      <Button
                                        onClick={() => addChecklistItem(task.id)}
                                        disabled={!newChecklistItem.trim()}
                                        size="sm"
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Item
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Existing items */}
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-foreground">Existing Items</h4>
                                    {(checklists[task.id] || []).length === 0 ? (
                                      <p className="text-muted-foreground text-sm">
                                        No checklist items configured for this task.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {(checklists[task.id] || []).map((item) => (
                                          <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                          >
                                            <div className="flex-1">
                                              <p className="text-sm text-foreground">{item.item_text}</p>
                                              <div className="flex items-center space-x-2 mt-1">
                                                <Switch
                                                  checked={item.is_required}
                                                  onCheckedChange={() => toggleItemRequired(task.id, item)}
                                                />
                                                <Label className="text-xs text-muted-foreground">
                                                  {item.is_required ? 'Required' : 'Optional'}
                                                </Label>
                                              </div>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => deleteChecklistItem(task.id, item.id)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditTaskDialog(task)}
                            title="Edit task"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(task)}
                            className="text-destructive hover:text-destructive"
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingTask ? 'Edit Standard Task' : 'Add Standard Task'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTask ? 'Update the task details below.' : 'Fill in the details for the new standard task.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task_number" className="text-foreground">Task Number *</Label>
              <Input
                id="task_number"
                value={taskFormData.task_number}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, task_number: e.target.value }))}
                placeholder="e.g. 01, 02, 03..."
                className="bg-background text-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="task_name" className="text-foreground">Task Name *</Label>
              <Input
                id="task_name"
                value={taskFormData.task_name}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, task_name: e.target.value }))}
                placeholder="Enter task name"
                className="bg-background text-foreground"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time_coefficient" className="text-foreground">Time Coefficient</Label>
                <Input
                  id="time_coefficient"
                  type="number"
                  step="0.1"
                  min="0"
                  value={taskFormData.time_coefficient}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, time_coefficient: parseFloat(e.target.value) || 0 }))}
                  className="bg-background text-foreground"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="day_counter" className="text-foreground">Day Counter</Label>
                <Input
                  id="day_counter"
                  type="number"
                  min="0"
                  value={taskFormData.day_counter}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, day_counter: parseInt(e.target.value) || 0 }))}
                  className="bg-background text-foreground"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hourly_cost" className="text-foreground">Hourly Cost (€)</Label>
              <Input
                id="hourly_cost"
                type="number"
                step="0.01"
                min="0"
                value={taskFormData.hourly_cost}
                onChange={(e) => setTaskFormData(prev => ({ ...prev, hourly_cost: parseFloat(e.target.value) || 0 }))}
                className="bg-background text-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                      taskFormData.color === color ? 'border-foreground shadow-md' : 'border-muted'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setTaskFormData(prev => ({ ...prev, color }))}
                  />
                ))}
                <button
                  type="button"
                  className={`w-8 h-8 rounded border-2 bg-background hover:scale-110 transition-transform ${
                    !taskFormData.color ? 'border-foreground shadow-md' : 'border-muted'
                  }`}
                  onClick={() => setTaskFormData(prev => ({ ...prev, color: '' }))}
                >
                  <X className="h-4 w-4 text-muted-foreground mx-auto" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Switch
                id="multi_user_task"
                checked={taskFormData.multi_user_task}
                onCheckedChange={(checked) => setTaskFormData(prev => ({ ...prev, multi_user_task: checked }))}
              />
              <div className="space-y-0.5">
                <Label htmlFor="multi_user_task" className="text-foreground font-medium">Multi-User Task</Label>
                <p className="text-xs text-muted-foreground">
                  Allow multiple employees to work on this task simultaneously (2 employees = half the time)
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={savingTask}>
              Cancel
            </Button>
            <Button onClick={handleSaveTask} disabled={savingTask}>
              {savingTask ? (
                <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingTask ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Standard Task
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete task "{taskToDelete?.task_number} - {taskToDelete?.task_name}"? 
              This action cannot be undone and may affect existing projects that use this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <div className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full mr-2"></div>
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StandardTasksSettings;
