import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProjectModel {
  id: string;
  project_id: string;
  name: string;
  body_material_id?: string;
  door_material_id?: string;
  shelf_material_id?: string;
  edge_banding: string;
  finish: string;
  plinth_height: number;
  body_thickness: number;
  door_thickness: number;
  shelf_thickness: number;
  is_default: boolean;
  notes?: string;
}

interface Material {
  id: string;
  name: string;
  sku: string;
  category: string;
  thickness?: number;
}

interface ProjectModelManagerProps {
  projectId: string;
  onModelSelect?: (model: ProjectModel | null) => void;
  selectedModelId?: string;
}

export function ProjectModelManager({ projectId, onModelSelect, selectedModelId }: ProjectModelManagerProps) {
  const { toast } = useToast();
  const [models, setModels] = useState<ProjectModel[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ProjectModel | null>(null);

  const emptyModel: Partial<ProjectModel> = {
    name: '',
    edge_banding: 'PVC',
    finish: 'matte',
    plinth_height: 100,
    body_thickness: 18,
    door_thickness: 18,
    shelf_thickness: 18,
    is_default: false,
  };

  const [formData, setFormData] = useState<Partial<ProjectModel>>(emptyModel);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    const [modelsRes, materialsRes] = await Promise.all([
      supabase
        .from('project_models')
        .select('*')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false })
        .order('name'),
      supabase
        .from('cabinet_materials')
        .select('id, name, sku, category, thickness')
        .eq('in_stock', true)
        .order('category')
        .order('name'),
    ]);

    if (modelsRes.data) setModels(modelsRes.data);
    if (materialsRes.data) setMaterials(materialsRes.data);
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editingModel) {
        const { error } = await supabase
          .from('project_models')
          .update({
            name: formData.name,
            body_material_id: formData.body_material_id,
            door_material_id: formData.door_material_id,
            shelf_material_id: formData.shelf_material_id,
            edge_banding: formData.edge_banding,
            finish: formData.finish,
            plinth_height: formData.plinth_height,
            body_thickness: formData.body_thickness,
            door_thickness: formData.door_thickness,
            shelf_thickness: formData.shelf_thickness,
            is_default: formData.is_default,
            notes: formData.notes,
          })
          .eq('id', editingModel.id);
        if (error) throw error;
        toast({ title: 'Model updated' });
      } else {
        // If setting as default, unset other defaults first
        if (formData.is_default) {
          await supabase
            .from('project_models')
            .update({ is_default: false })
            .eq('project_id', projectId);
        }
        
        const { error } = await supabase
          .from('project_models')
          .insert({
            project_id: projectId,
            name: formData.name,
            body_material_id: formData.body_material_id,
            door_material_id: formData.door_material_id,
            shelf_material_id: formData.shelf_material_id,
            edge_banding: formData.edge_banding,
            finish: formData.finish,
            plinth_height: formData.plinth_height,
            body_thickness: formData.body_thickness,
            door_thickness: formData.door_thickness,
            shelf_thickness: formData.shelf_thickness,
            is_default: formData.is_default,
            notes: formData.notes,
          });
        if (error) throw error;
        toast({ title: 'Model created' });
      }
      
      setIsDialogOpen(false);
      setEditingModel(null);
      setFormData(emptyModel);
      loadData();
    } catch (error) {
      toast({ title: 'Error saving model', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_models')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Model deleted' });
      loadData();
    } catch (error) {
      toast({ title: 'Error deleting model', variant: 'destructive' });
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      await supabase
        .from('project_models')
        .update({ is_default: false })
        .eq('project_id', projectId);
      
      await supabase
        .from('project_models')
        .update({ is_default: true })
        .eq('id', id);
      
      toast({ title: 'Default model updated' });
      loadData();
    } catch (error) {
      toast({ title: 'Error setting default', variant: 'destructive' });
    }
  };

  const openEditDialog = (model: ProjectModel) => {
    setEditingModel(model);
    setFormData(model);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingModel(null);
    setFormData(emptyModel);
    setIsDialogOpen(true);
  };

  const getMaterialName = (id?: string) => {
    if (!id) return '-';
    const material = materials.find(m => m.id === id);
    return material ? material.name : '-';
  };

  const panelMaterials = materials.filter(m => m.category === 'panel');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Project Models</span>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingModel ? 'Edit Project Model' : 'New Project Model'}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 p-1">
                  <div>
                    <Label>Model Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Standard Oak, White Glossy"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Body Material</Label>
                      <Select
                        value={formData.body_material_id || 'none'}
                        onValueChange={(v) => setFormData({ ...formData, body_material_id: v === 'none' ? undefined : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {panelMaterials.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Door Material</Label>
                      <Select
                        value={formData.door_material_id || 'none'}
                        onValueChange={(v) => setFormData({ ...formData, door_material_id: v === 'none' ? undefined : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {panelMaterials.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Shelf Material</Label>
                      <Select
                        value={formData.shelf_material_id || 'none'}
                        onValueChange={(v) => setFormData({ ...formData, shelf_material_id: v === 'none' ? undefined : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {panelMaterials.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Body Thickness (mm)</Label>
                      <Input
                        type="number"
                        value={formData.body_thickness}
                        onChange={(e) => setFormData({ ...formData, body_thickness: parseInt(e.target.value) || 18 })}
                      />
                    </div>
                    <div>
                      <Label>Door Thickness (mm)</Label>
                      <Input
                        type="number"
                        value={formData.door_thickness}
                        onChange={(e) => setFormData({ ...formData, door_thickness: parseInt(e.target.value) || 18 })}
                      />
                    </div>
                    <div>
                      <Label>Shelf Thickness (mm)</Label>
                      <Input
                        type="number"
                        value={formData.shelf_thickness}
                        onChange={(e) => setFormData({ ...formData, shelf_thickness: parseInt(e.target.value) || 18 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Edge Banding</Label>
                      <Select
                        value={formData.edge_banding}
                        onValueChange={(v) => setFormData({ ...formData, edge_banding: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PVC">PVC</SelectItem>
                          <SelectItem value="ABS">ABS</SelectItem>
                          <SelectItem value="veneer">Veneer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Finish</Label>
                      <Select
                        value={formData.finish}
                        onValueChange={(v) => setFormData({ ...formData, finish: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="matte">Matte</SelectItem>
                          <SelectItem value="glossy">Glossy</SelectItem>
                          <SelectItem value="textured">Textured</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plinth Height (mm)</Label>
                      <Input
                        type="number"
                        value={formData.plinth_height}
                        onChange={(e) => setFormData({ ...formData, plinth_height: parseInt(e.target.value) || 100 })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!formData.name}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-4">Loading...</p>
        ) : models.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No project models yet. Create one to define default materials and settings.
          </p>
        ) : (
          <div className="space-y-2">
            {models.map((model) => (
              <div
                key={model.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedModelId === model.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onModelSelect?.(model)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {model.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!model.is_default && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setAsDefault(model.id); }}
                        title="Set as default"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(model); }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2">
                  <span>Body: {getMaterialName(model.body_material_id)}</span>
                  <span>Door: {getMaterialName(model.door_material_id)}</span>
                  <span>Shelf: {getMaterialName(model.shelf_material_id)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
