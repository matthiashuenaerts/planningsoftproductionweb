import React, { useState, useEffect } from 'react';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, Plus, Trash2, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { checklistService, ChecklistItem } from '@/services/checklistService';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [checklistDialogOpen, setChecklistDialogOpen] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const { toast } = useToast();

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
                <TableHead className="w-32">Day Counter</TableHead>
                <TableHead className="w-20">Actions</TableHead>
                <TableHead className="w-32">Hourly Cost (€)</TableHead>
                <TableHead className="w-20">Actions</TableHead>
                <TableHead className="w-32">Color</TableHead>
                <TableHead className="w-20">Actions</TableHead>
                <TableHead className="w-96">Limit Phases (Standard Tasks)</TableHead>
                <TableHead className="w-40">Checklist Items</TableHead>
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
                      <Input 
                        type="number" 
                        min="0"
                        value={task.day_counter} 
                        onChange={(e) => handleDayCounterChange(task.id, e.target.value)}
                        className="w-full"
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
                        className="w-full"
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
                              task.color === color ? 'border-gray-900 shadow-md' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleColorChange(task.id, color)}
                            title={`Set color to ${color}`}
                          />
                        ))}
                        {/* No color option */}
                        <button
                          className={`w-6 h-6 rounded border-2 bg-white hover:scale-110 transition-transform ${
                            !task.color || task.color === '' ? 'border-gray-900 shadow-md' : 'border-gray-300'
                          }`}
                          onClick={() => handleColorChange(task.id, '')}
                          title="No color"
                        >
                          <X className="h-3 w-3 text-gray-400 mx-auto" />
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
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
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
                                <CheckSquare className="h-4 w-4 mr-1" />
                                Manage
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  Checklist for {task.task_number} - {task.task_name}
                                </DialogTitle>
                              </DialogHeader>
                              
                              <div className="space-y-4">
                                {/* Add new item */}
                                <div className="border rounded-lg p-4 space-y-3">
                                  <h4 className="font-medium">Add New Checklist Item</h4>
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="Enter checklist item..."
                                      value={newChecklistItem}
                                      onChange={(e) => setNewChecklistItem(e.target.value)}
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        id="required"
                                        checked={newItemRequired}
                                        onCheckedChange={setNewItemRequired}
                                      />
                                      <Label htmlFor="required">Required item</Label>
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
                                  <h4 className="font-medium">Existing Items</h4>
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
                                            <p className="text-sm">{item.item_text}</p>
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
                        
                        {/* Preview of checklist items */}
                        <div className="space-y-1">
                          {(checklists[task.id] || []).slice(0, 3).map((item) => (
                            <div key={item.id} className="text-xs text-muted-foreground">
                              • {item.item_text.substring(0, 30)}
                              {item.item_text.length > 30 ? '...' : ''}
                              {item.is_required && <span className="text-red-500 ml-1">*</span>}
                            </div>
                          ))}
                          {(checklists[task.id] || []).length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              ... and {(checklists[task.id] || []).length - 3} more
                            </div>
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
