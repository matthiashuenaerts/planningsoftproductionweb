import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { projectCalculationService, CalculationTaskRelationship } from '@/services/projectCalculationService';
import { standardTasksService } from '@/services/standardTasksService';
import { calculationVariableDefinitionsService, CalculationVariableDefinition } from '@/services/calculationVariableDefinitionsService';
import { Trash2, Plus } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

interface StandardTask {
  id: string;
  task_name: string;
  task_number: string;
}

const CalculationRelationshipsSettings: React.FC = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [relationships, setRelationships] = useState<CalculationTaskRelationship[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [variableDefinitions, setVariableDefinitions] = useState<CalculationVariableDefinition[]>([]);
  const [newRelationship, setNewRelationship] = useState({
    variable_name: '',
    standard_task_id: '',
    multiplier: 1.0,
    base_duration_minutes: 0,
    formula: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [relationshipsData, tasksData, variableDefs] = await Promise.all([
        projectCalculationService.getAllTaskRelationships(),
        standardTasksService.getAll(tenant?.id),
        calculationVariableDefinitionsService.getAll()
      ]);
      
      setRelationships(relationshipsData);
      setStandardTasks(tasksData);
      setVariableDefinitions(variableDefs);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to load data: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRelationship = async () => {
    if (!newRelationship.variable_name || !newRelationship.standard_task_id) {
      toast({
        title: 'Error',
        description: 'Please select both a variable and a standard task',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving('new');
      const created = await projectCalculationService.createTaskRelationship(newRelationship);
      setRelationships(prev => [...prev, created]);
      setNewRelationship({
        variable_name: '',
        standard_task_id: '',
        multiplier: 1.0,
        base_duration_minutes: 0,
        formula: ''
      });
      toast({
        title: 'Success',
        description: 'Calculation relationship created successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to create relationship: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateRelationship = async (id: string, field: string, value: string | number) => {
    try {
      setSaving(id);
      let updateValue = value;
      if (field !== 'formula' && typeof value === 'string') {
        updateValue = field === 'multiplier' ? parseFloat(value) : parseInt(value);
      }
      const updated = await projectCalculationService.updateTaskRelationship(id, { [field]: updateValue });
      
      setRelationships(prev => prev.map(rel => rel.id === id ? updated : rel));
      toast({
        title: 'Success',
        description: 'Relationship updated successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to update relationship: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteRelationship = async (id: string) => {
    try {
      setSaving(id);
      await projectCalculationService.deleteTaskRelationship(id);
      setRelationships(prev => prev.filter(rel => rel.id !== id));
      toast({
        title: 'Success',
        description: 'Relationship deleted successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to delete relationship: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(null);
    }
  };

  const getTaskName = (taskId: string) => {
    const task = standardTasks.find(t => t.id === taskId);
    return task ? `${task.task_number} - ${task.task_name}` : 'Unknown Task';
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Calculation Relationship</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="variable_name">Variable</Label>
                <Select value={newRelationship.variable_name} onValueChange={(value) => setNewRelationship(prev => ({ ...prev, variable_name: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {variableDefinitions.map(varDef => (
                      <SelectItem key={varDef.variable_key} value={varDef.variable_key}>
                        {varDef.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="standard_task_id">Standard Task</Label>
                <Select value={newRelationship.standard_task_id} onValueChange={(value) => setNewRelationship(prev => ({ ...prev, standard_task_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select standard task" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardTasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.task_number} - {task.task_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="formula">Formula (use variable names like aantal_kasten, aantal_objecten)</Label>
              <Textarea
                id="formula"
                placeholder="Example: aantal_kasten * 2 + aantal_objecten / 3"
                value={newRelationship.formula}
                onChange={(e) => setNewRelationship(prev => ({ ...prev, formula: e.target.value }))}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Available variables: {variableDefinitions.map(v => v.variable_key).join(', ')}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button onClick={handleCreateRelationship} disabled={saving === 'new'}>
              <Plus className="mr-2 h-4 w-4" />
              {saving === 'new' ? 'Adding...' : 'Add Relationship'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Calculation Relationships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {relationships.map((relationship) => (
              <Card key={relationship.id} className="p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Variable</Label>
                      <p className="text-sm">
                        {variableDefinitions.find(v => v.variable_key === relationship.variable_name)?.display_name || relationship.variable_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Standard Task</Label>
                      <p className="text-sm">{getTaskName(relationship.standard_task_id)}</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`formula-${relationship.id}`}>Formula</Label>
                    <Textarea
                      id={`formula-${relationship.id}`}
                      value={relationship.formula || ''}
                      onChange={(e) => handleUpdateRelationship(relationship.id, 'formula', e.target.value)}
                      disabled={saving === relationship.id}
                      className="font-mono"
                      placeholder="Example: aantal_kasten * 2 + aantal_objecten / 3"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRelationship(relationship.id)}
                      disabled={saving === relationship.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalculationRelationshipsSettings;