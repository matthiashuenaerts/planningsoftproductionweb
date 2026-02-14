import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { projectCalculationService, evaluateFormula } from '@/services/projectCalculationService';
import { calculationVariableDefinitionsService, CalculationVariableDefinition } from '@/services/calculationVariableDefinitionsService';
import { standardTasksService } from '@/services/standardTasksService';
import { supabase } from '@/integrations/supabase/client';
import { Upload } from 'lucide-react';

interface ProjectCalculationVariablesProps {
  projectId: string;
}

const ProjectCalculationVariablesComponent: React.FC<ProjectCalculationVariablesProps> = ({ projectId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [standardTasks, setStandardTasks] = useState<any[]>([]);
  const [taskExclusions, setTaskExclusions] = useState<Map<string, boolean>>(new Map());
  const [variableDefinitions, setVariableDefinitions] = useState<CalculationVariableDefinition[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [defs, projectValues, tasks] = await Promise.all([
        calculationVariableDefinitionsService.getAll(),
        calculationVariableDefinitionsService.getProjectValues(projectId),
        standardTasksService.getAll(),
      ]);

      setVariableDefinitions(defs);

      // Initialize variables with defaults, then override with saved values
      const vars: Record<string, number> = {};
      for (const def of defs) {
        vars[def.variable_key] = projectValues[def.variable_key]?.value ?? def.default_value;
      }
      setVariables(vars);

      setStandardTasks(tasks);

      // Get phases for this project
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('project_id', projectId);

      const phaseIds = phases?.map(p => p.id) || [];

      // Get existing tasks to determine exclusions
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('standard_task_id')
        .in('phase_id', phaseIds)
        .not('standard_task_id', 'is', null);

      const existingStandardTaskIds = new Set(existingTasks?.map(t => t.standard_task_id) || []);

      const exclusions = new Map<string, boolean>();
      tasks.forEach((task: any) => {
        exclusions.set(task.id, !existingStandardTaskIds.has(task.id));
      });
      setTaskExclusions(exclusions);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save the dynamic variable values
      await calculationVariableDefinitionsService.saveProjectValues(projectId, variables, variableDefinitions);

      // Also save to legacy table for backward compatibility
      await projectCalculationService.createOrUpdateVariables(projectId, variables as any);

      // Get all calculation relationships
      const relationships = await projectCalculationService.getAllTaskRelationships();

      // Get all phases for this project
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('project_id', projectId);

      if (phasesError) throw phasesError;

      const phaseIds = phases?.map(p => p.id) || [];

      // Get limit phases to check dependencies
      const limitPhasesMap = new Map<string, string[]>();
      for (const task of standardTasks) {
        const limitPhases = await standardTasksService.getLimitPhases(task.id);
        if (limitPhases.length > 0) {
          limitPhasesMap.set(task.id, limitPhases.map(lp => lp.standard_task_id));
        }
      }

      // Collect excluded task IDs
      const excludedTaskIds: string[] = [];
      for (const task of standardTasks) {
        if (taskExclusions.get(task.id) === true) {
          excludedTaskIds.push(task.id);
        }
      }

      // Delete excluded tasks
      if (excludedTaskIds.length > 0 && phaseIds.length > 0) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .in('standard_task_id', excludedTaskIds)
          .in('phase_id', phaseIds);

        if (error) console.error('Failed to delete excluded tasks:', error);
      }

      // Find tasks to unlock
      const tasksToUnlock: string[] = [];
      for (const task of standardTasks) {
        if (taskExclusions.get(task.id) === true) continue;
        const limitPhases = limitPhasesMap.get(task.id) || [];
        if (limitPhases.length === 0) continue;
        if (limitPhases.some(lpId => excludedTaskIds.includes(lpId))) {
          tasksToUnlock.push(task.id);
        }
      }

      if (tasksToUnlock.length > 0 && phaseIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'TODO' })
          .in('standard_task_id', tasksToUnlock)
          .in('phase_id', phaseIds)
          .eq('status', 'HOLD');
      }

      // Update task durations based on formulas
      for (const rel of relationships) {
        const isIncluded = taskExclusions.get(rel.standard_task_id) !== true;
        if (rel.formula && phaseIds.length > 0 && isIncluded) {
          const calculatedMinutes = evaluateFormula(rel.formula, variables);
          await supabase
            .from('tasks')
            .update({ duration: calculatedMinutes, estimated_duration: calculatedMinutes })
            .eq('standard_task_id', rel.standard_task_id)
            .in('phase_id', phaseIds);
        }
      }

      toast({ title: 'Success', description: 'Variables saved, task durations updated, and dependencies unlocked' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) parseCSVFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      parseCSVFile(file);
    } else {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file', variant: 'destructive' });
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      const newVariables: Record<string, number> = {};
      const newExclusions = new Map<string, boolean>(taskExclusions);
      const validKeys = new Set(variableDefinitions.map(d => d.variable_key));

      lines.forEach(line => {
        const [key, value] = line.split(',').map(s => s.trim());
        if (key && value) {
          if (validKeys.has(key) && !isNaN(parseInt(value))) {
            newVariables[key] = parseInt(value);
          } else {
            const task = standardTasks.find((t: any) => t.task_number === key || t.task_name === key);
            if (task && (value === '0' || value === '1')) {
              newExclusions.set(task.id, value === '0');
            }
          }
        }
      });

      let importCount = Object.keys(newVariables).length;
      if (Object.keys(newVariables).length > 0) {
        setVariables(prev => ({ ...prev, ...newVariables }));
      }
      if (newExclusions.size > 0) {
        setTaskExclusions(newExclusions);
        importCount += newExclusions.size;
      }

      if (importCount > 0) {
        toast({ title: 'Success', description: `Imported ${importCount} items from CSV` });
      } else {
        toast({ title: 'No data imported', description: 'No matching variables or tasks found in CSV file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Berekening Variabelen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop a CSV file here, or click to select
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            CSV format: variable_name,value OR task_number,1/0 (one per line)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Taken Configuratie</h3>
          <p className="text-sm text-muted-foreground">
            Schakel taken in of uit voor dit project
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {standardTasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`task-${task.id}`} className="text-sm font-medium cursor-pointer">
                    {task.task_number} - {task.task_name}
                  </Label>
                </div>
                <Switch
                  id={`task-${task.id}`}
                  checked={!taskExclusions.get(task.id)}
                  onCheckedChange={(checked) => {
                    const newExclusions = new Map(taskExclusions);
                    newExclusions.set(task.id, !checked);
                    setTaskExclusions(newExclusions);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {variableDefinitions.map(def => (
            <div key={def.id}>
              <Label htmlFor={def.variable_key}>{def.display_name}</Label>
              <Input
                id={def.variable_key}
                type="number"
                min="0"
                value={variables[def.variable_key] ?? def.default_value}
                onChange={(e) => handleInputChange(def.variable_key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Variables'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCalculationVariablesComponent;
