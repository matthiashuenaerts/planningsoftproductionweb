import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { calculationVariableDefinitionsService, CalculationVariableDefinition } from '@/services/calculationVariableDefinitionsService';
import { Trash2, Plus, Save, Loader2, Settings } from 'lucide-react';

const CalculationVariableDefinitionsSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<CalculationVariableDefinition[]>([]);
  const [editedDefs, setEditedDefs] = useState<Map<string, Partial<CalculationVariableDefinition>>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDef, setNewDef] = useState({ variable_key: '', display_name: '', description: '', default_value: 0 });

  useEffect(() => {
    loadDefinitions();
  }, []);

  const loadDefinitions = async () => {
    try {
      setLoading(true);
      const data = await calculationVariableDefinitionsService.getAllIncludingInactive();
      setDefinitions(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (id: string, field: string, value: any) => {
    const current = editedDefs.get(id) || {};
    setEditedDefs(new Map(editedDefs.set(id, { ...current, [field]: value })));
  };

  const handleSave = async (def: CalculationVariableDefinition) => {
    const edits = editedDefs.get(def.id);
    if (!edits) return;
    try {
      setSaving(def.id);
      await calculationVariableDefinitionsService.update(def.id, edits);
      editedDefs.delete(def.id);
      setEditedDefs(new Map(editedDefs));
      toast({ title: 'Saved', description: 'Variable updated successfully' });
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newDef.variable_key || !newDef.display_name) {
      toast({ title: 'Error', description: 'Variable key and display name are required', variant: 'destructive' });
      return;
    }
    // Sanitize key: lowercase, underscores only
    const sanitizedKey = newDef.variable_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    try {
      setSaving('new');
      await calculationVariableDefinitionsService.create({
        variable_key: sanitizedKey,
        display_name: newDef.display_name,
        description: newDef.description || undefined,
        default_value: newDef.default_value,
      });
      setNewDef({ variable_key: '', display_name: '', description: '', default_value: 0 });
      setShowAddDialog(false);
      toast({ title: 'Added', description: 'Variable definition created' });
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will also remove this variable from all calculation relationships.')) return;
    try {
      setSaving(id);
      await calculationVariableDefinitionsService.delete(id);
      toast({ title: 'Deleted', description: 'Variable definition removed' });
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const getDisplayValue = (def: CalculationVariableDefinition, field: keyof CalculationVariableDefinition) => {
    const edits = editedDefs.get(def.id);
    if (edits && field in edits) return (edits as any)[field];
    return def[field];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Properties Variables
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Define the variables used in project calculations, CSV imports, and calculation relationships.
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Variable
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Variable</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Variable Key (snake_case, e.g. aantal_kasten)</Label>
                <Input
                  value={newDef.variable_key}
                  onChange={(e) => setNewDef({ ...newDef, variable_key: e.target.value })}
                  placeholder="e.g., aantal_deuren"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={newDef.display_name}
                  onChange={(e) => setNewDef({ ...newDef, display_name: e.target.value })}
                  placeholder="e.g., Aantal Deuren"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={newDef.description}
                  onChange={(e) => setNewDef({ ...newDef, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input
                  type="number"
                  value={newDef.default_value}
                  onChange={(e) => setNewDef({ ...newDef, default_value: parseInt(e.target.value) || 0 })}
                />
              </div>
              <Button onClick={handleAdd} className="w-full" disabled={saving === 'new'}>
                {saving === 'new' ? 'Adding...' : 'Add Variable'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable Key</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Default</TableHead>
                <TableHead className="text-center w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {definitions.map((def) => (
                <TableRow key={def.id}>
                  <TableCell>
                    <Input
                      value={getDisplayValue(def, 'variable_key') as string}
                      onChange={(e) => handleFieldChange(def.id, 'variable_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={getDisplayValue(def, 'display_name') as string}
                      onChange={(e) => handleFieldChange(def.id, 'display_name', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={(getDisplayValue(def, 'description') as string) || ''}
                      onChange={(e) => handleFieldChange(def.id, 'description', e.target.value)}
                      className="h-8"
                      placeholder="Description"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={getDisplayValue(def, 'default_value') as number}
                      onChange={(e) => handleFieldChange(def.id, 'default_value', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={getDisplayValue(def, 'is_active') as boolean}
                      onCheckedChange={(checked) => handleFieldChange(def.id, 'is_active', checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editedDefs.has(def.id) && (
                        <Button size="sm" variant="ghost" onClick={() => handleSave(def)} disabled={saving === def.id}>
                          <Save className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(def.id)}
                        disabled={saving === def.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {definitions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No variables defined yet. Click "Add Variable" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalculationVariableDefinitionsSettings;
