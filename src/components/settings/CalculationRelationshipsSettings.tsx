import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { projectCalculationService, CalculationTaskRelationship } from '@/services/projectCalculationService';
import { standardTasksService } from '@/services/standardTasksService';
import { Trash2, Plus } from 'lucide-react';

interface StandardTask {
  id: string;
  task_name: string;
  task_number: string;
}

const VARIABLE_OPTIONS = [
  'aantal_objecten',
  'aantal_kasten',
  'aantal_stuks',
  'aantal_platen',
  'aantal_zaagsnedes',
  'aantal_lopende_meters_zaagsnede',
  'aantal_verschillende_kantenbanden',
  'aantal_lopende_meter_kantenbanden',
  'aantal_drevel_programmas',
  'aantal_cnc_programmas',
  'aantal_boringen',
  'aantal_kasten_te_monteren',
  'aantal_manueel_te_monteren_kasten',
  'aantal_manueel_te_monteren_objecten'
];

const CalculationRelationshipsSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [relationships, setRelationships] = useState<CalculationTaskRelationship[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [newRelationship, setNewRelationship] = useState({
    variable_name: '',
    standard_task_id: '',
    multiplier: 1.0,
    base_duration_minutes: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [relationshipsData, tasksData] = await Promise.all([
        projectCalculationService.getAllTaskRelationships(),
        standardTasksService.getAll()
      ]);
      
      setRelationships(relationshipsData);
      setStandardTasks(tasksData);
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
        base_duration_minutes: 0
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
      const numValue = typeof value === 'string' ? (field === 'multiplier' ? parseFloat(value) : parseInt(value)) : value;
      const updated = await projectCalculationService.updateTaskRelationship(id, { [field]: numValue });
      
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variable_name">Variable</Label>
              <Select value={newRelationship.variable_name} onValueChange={(value) => setNewRelationship(prev => ({ ...prev, variable_name: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select variable" />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_OPTIONS.map(variable => (
                    <SelectItem key={variable} value={variable}>
                      {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
            
            <div>
              <Label htmlFor="multiplier">Multiplier</Label>
              <Input
                id="multiplier"
                type="number"
                step="0.1"
                min="0"
                value={newRelationship.multiplier}
                onChange={(e) => setNewRelationship(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            
            <div>
              <Label htmlFor="base_duration_minutes">Base Duration (minutes)</Label>
              <Input
                id="base_duration_minutes"
                type="number"
                min="0"
                value={newRelationship.base_duration_minutes}
                onChange={(e) => setNewRelationship(prev => ({ ...prev, base_duration_minutes: parseInt(e.target.value) || 0 }))}
              />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Standard Task</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Base Duration (min)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relationships.map((relationship) => (
                <TableRow key={relationship.id}>
                  <TableCell>
                    {relationship.variable_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </TableCell>
                  <TableCell>{getTaskName(relationship.standard_task_id)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={relationship.multiplier}
                      onChange={(e) => handleUpdateRelationship(relationship.id, 'multiplier', e.target.value)}
                      disabled={saving === relationship.id}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={relationship.base_duration_minutes}
                      onChange={(e) => handleUpdateRelationship(relationship.id, 'base_duration_minutes', e.target.value)}
                      disabled={saving === relationship.id}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRelationship(relationship.id)}
                      disabled={saving === relationship.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalculationRelationshipsSettings;