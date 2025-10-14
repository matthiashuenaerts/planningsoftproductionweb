import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { projectCalculationService, ProjectCalculationVariables, evaluateFormula } from '@/services/projectCalculationService';
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
  const [variables, setVariables] = useState<Partial<ProjectCalculationVariables>>({
    aantal_objecten: 0,
    aantal_kasten: 0,
    aantal_stuks: 0,
    aantal_platen: 0,
    aantal_zaagsnedes: 0,
    aantal_lopende_meters_zaagsnede: 0,
    aantal_verschillende_kantenbanden: 0,
    aantal_lopende_meter_kantenbanden: 0,
    aantal_drevel_programmas: 0,
    aantal_cnc_programmas: 0,
    aantal_boringen: 0,
    aantal_kasten_te_monteren: 0,
    aantal_manueel_te_monteren_kasten: 0,
    aantal_manueel_te_monteren_objecten: 0,
  });

  useEffect(() => {
    loadVariables();
    loadStandardTasks();
  }, [projectId]);

  const loadStandardTasks = async () => {
    try {
      const tasks = await standardTasksService.getAll();
      setStandardTasks(tasks);
      
      // Initialize all tasks as enabled (not excluded)
      const exclusions = new Map<string, boolean>();
      tasks.forEach(task => exclusions.set(task.id, false));
      setTaskExclusions(exclusions);
    } catch (error: any) {
      console.error('Failed to load standard tasks:', error);
    }
  };

  const loadVariables = async () => {
    try {
      setLoading(true);
      const data = await projectCalculationService.getVariablesByProject(projectId);
      if (data) {
        setVariables(data);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to load calculation variables: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Save the variables
      await projectCalculationService.createOrUpdateVariables(projectId, variables);
      
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
      
      // Determine which tasks should exist based on exclusions and limit phases
      const tasksToDelete: string[] = [];
      const tasksToCreate: string[] = [];
      
      for (const task of standardTasks) {
        const isExcluded = taskExclusions.get(task.id) || false;
        
        if (isExcluded) {
          tasksToDelete.push(task.id);
        } else {
          // Check if this task has limit phases that are all excluded
          const limitPhases = limitPhasesMap.get(task.id) || [];
          const allLimitPhasesExcluded = limitPhases.length > 0 && 
            limitPhases.every(lpId => taskExclusions.get(lpId) === true);
          
          if (!allLimitPhasesExcluded) {
            tasksToCreate.push(task.id);
          }
        }
      }
      
      // Delete excluded tasks
      if (tasksToDelete.length > 0 && phaseIds.length > 0) {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .in('standard_task_id', tasksToDelete)
          .in('phase_id', phaseIds);
        
        if (error) {
          console.error('Failed to delete excluded tasks:', error);
        }
      }
      
      // Update task durations based on formulas for included tasks
      for (const rel of relationships) {
        if (rel.formula && phaseIds.length > 0 && tasksToCreate.includes(rel.standard_task_id)) {
          // Evaluate the formula with current variables
          const calculatedMinutes = evaluateFormula(rel.formula, variables as Record<string, number>);
          
          // Update all tasks in this project with this standard_task_id
          const { error } = await supabase
            .from('tasks')
            .update({ duration: calculatedMinutes })
            .eq('standard_task_id', rel.standard_task_id)
            .in('phase_id', phaseIds);
          
          if (error) {
            console.error(`Failed to update tasks for standard_task_id ${rel.standard_task_id}:`, error);
          }
        }
      }
      
      toast({
        title: 'Success',
        description: 'Variables saved and task durations updated'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to save: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProjectCalculationVariables, value: string) => {
    const numValue = parseInt(value) || 0;
    setVariables(prev => ({ ...prev, [field]: numValue }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseCSVFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      parseCSVFile(file);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
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
      
      lines.forEach(line => {
        const [key, value] = line.split(',').map(s => s.trim());
        if (key && value) {
          // Check if it's a variable
          if (key in variables && !isNaN(parseInt(value))) {
            newVariables[key] = parseInt(value);
          } else {
            // Check if it's a task exclusion (by task_number or task_name)
            const task = standardTasks.find(t => 
              t.task_number === key || t.task_name === key
            );
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
        toast({
          title: 'Success',
          description: `Imported ${importCount} items from CSV`
        });
      } else {
        toast({
          title: 'No data imported',
          description: 'No matching variables or tasks found in CSV file',
          variant: 'destructive'
        });
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
            {standardTasks.map((task) => (
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
          <div>
            <Label htmlFor="aantal_objecten">Aantal Objecten</Label>
            <Input
              id="aantal_objecten"
              type="number"
              min="0"
              value={variables.aantal_objecten || 0}
              onChange={(e) => handleInputChange('aantal_objecten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_kasten">Aantal Kasten</Label>
            <Input
              id="aantal_kasten"
              type="number"
              min="0"
              value={variables.aantal_kasten || 0}
              onChange={(e) => handleInputChange('aantal_kasten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_stuks">Aantal Stuks</Label>
            <Input
              id="aantal_stuks"
              type="number"
              min="0"
              value={variables.aantal_stuks || 0}
              onChange={(e) => handleInputChange('aantal_stuks', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_platen">Aantal Platen</Label>
            <Input
              id="aantal_platen"
              type="number"
              min="0"
              value={variables.aantal_platen || 0}
              onChange={(e) => handleInputChange('aantal_platen', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_zaagsnedes">Aantal Zaagsnedes</Label>
            <Input
              id="aantal_zaagsnedes"
              type="number"
              min="0"
              value={variables.aantal_zaagsnedes || 0}
              onChange={(e) => handleInputChange('aantal_zaagsnedes', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_lopende_meters_zaagsnede">Aantal Lopende Meters Zaagsnede</Label>
            <Input
              id="aantal_lopende_meters_zaagsnede"
              type="number"
              min="0"
              value={variables.aantal_lopende_meters_zaagsnede || 0}
              onChange={(e) => handleInputChange('aantal_lopende_meters_zaagsnede', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_verschillende_kantenbanden">Aantal Verschillende Kantenbanden</Label>
            <Input
              id="aantal_verschillende_kantenbanden"
              type="number"
              min="0"
              value={variables.aantal_verschillende_kantenbanden || 0}
              onChange={(e) => handleInputChange('aantal_verschillende_kantenbanden', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_lopende_meter_kantenbanden">Aantal Lopende Meter Kantenbanden</Label>
            <Input
              id="aantal_lopende_meter_kantenbanden"
              type="number"
              min="0"
              value={variables.aantal_lopende_meter_kantenbanden || 0}
              onChange={(e) => handleInputChange('aantal_lopende_meter_kantenbanden', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_drevel_programmas">Aantal Drevel Programma's</Label>
            <Input
              id="aantal_drevel_programmas"
              type="number"
              min="0"
              value={variables.aantal_drevel_programmas || 0}
              onChange={(e) => handleInputChange('aantal_drevel_programmas', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_cnc_programmas">Aantal CNC Programma's</Label>
            <Input
              id="aantal_cnc_programmas"
              type="number"
              min="0"
              value={variables.aantal_cnc_programmas || 0}
              onChange={(e) => handleInputChange('aantal_cnc_programmas', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_boringen">Aantal Boringen</Label>
            <Input
              id="aantal_boringen"
              type="number"
              min="0"
              value={variables.aantal_boringen || 0}
              onChange={(e) => handleInputChange('aantal_boringen', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_kasten_te_monteren">Aantal Kasten te Monteren</Label>
            <Input
              id="aantal_kasten_te_monteren"
              type="number"
              min="0"
              value={variables.aantal_kasten_te_monteren || 0}
              onChange={(e) => handleInputChange('aantal_kasten_te_monteren', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_manueel_te_monteren_kasten">Aantal Manueel te Monteren Kasten</Label>
            <Input
              id="aantal_manueel_te_monteren_kasten"
              type="number"
              min="0"
              value={variables.aantal_manueel_te_monteren_kasten || 0}
              onChange={(e) => handleInputChange('aantal_manueel_te_monteren_kasten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_manueel_te_monteren_objecten">Aantal Manueel te Monteren Objecten</Label>
            <Input
              id="aantal_manueel_te_monteren_objecten"
              type="number"
              min="0"
              value={variables.aantal_manueel_te_monteren_objecten || 0}
              onChange={(e) => handleInputChange('aantal_manueel_te_monteren_objecten', e.target.value)}
            />
          </div>
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