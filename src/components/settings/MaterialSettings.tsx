import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Copy, Pencil, Trash2, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface CabinetMaterial {
  id: string;
  name: string;
  sku: string;
  category: string;
  subcategory: string | null;
  cost_per_unit: number;
  unit: string;
  thickness: number | null;
  color: string | null;
  finish_type: string | null;
  supplier: string | null;
  in_stock: boolean | null;
  waste_factor: number | null;
  standard_size_width: number | null;
  standard_size_height: number | null;
  lead_time_days: number | null;
  notes: string | null;
  image_url: string | null;
}

const defaultMaterial: Partial<CabinetMaterial> = {
  name: '',
  sku: '',
  category: 'Panel',
  subcategory: null,
  cost_per_unit: 0,
  unit: 'm²',
  thickness: null,
  color: null,
  finish_type: null,
  supplier: null,
  in_stock: true,
  waste_factor: 1.1,
  standard_size_width: null,
  standard_size_height: null,
  lead_time_days: null,
  notes: null,
  image_url: null,
};

const categories = ['Panel', 'Edge Banding', 'Hardware', 'Finish', 'Other'];
const units = ['m²', 'm', 'piece', 'kg', 'L'];

const MaterialSettings: React.FC = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<CabinetMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Partial<CabinetMaterial> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    let query = supabase
      .from('cabinet_materials')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    query = applyTenantFilter(query, tenant?.id);
    const { data, error } = await query;

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load materials',
        variant: 'destructive',
      });
    } else {
      setMaterials(data || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingMaterial({ ...defaultMaterial });
    setIsEditing(false);
    setDialogOpen(true);
  };

  const handleEdit = (material: CabinetMaterial) => {
    setEditingMaterial({ ...material });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleDuplicate = (material: CabinetMaterial) => {
    const { id, ...rest } = material;
    setEditingMaterial({
      ...rest,
      name: `${material.name} (Copy)`,
      sku: `${material.sku}-COPY`,
    });
    setIsEditing(false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    const { error } = await supabase
      .from('cabinet_materials')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete material',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Success', description: 'Material deleted' });
      fetchMaterials();
    }
  };

  const handleSave = async () => {
    if (!editingMaterial?.name || !editingMaterial?.sku) {
      toast({
        title: 'Error',
        description: 'Name and SKU are required',
        variant: 'destructive',
      });
      return;
    }

    if (isEditing && editingMaterial.id) {
      const { error } = await supabase
        .from('cabinet_materials')
        .update({
          name: editingMaterial.name,
          sku: editingMaterial.sku,
          category: editingMaterial.category,
          subcategory: editingMaterial.subcategory,
          cost_per_unit: editingMaterial.cost_per_unit,
          unit: editingMaterial.unit,
          thickness: editingMaterial.thickness,
          color: editingMaterial.color,
          finish_type: editingMaterial.finish_type,
          supplier: editingMaterial.supplier,
          in_stock: editingMaterial.in_stock,
          waste_factor: editingMaterial.waste_factor,
          standard_size_width: editingMaterial.standard_size_width,
          standard_size_height: editingMaterial.standard_size_height,
          lead_time_days: editingMaterial.lead_time_days,
          notes: editingMaterial.notes,
          image_url: editingMaterial.image_url,
        })
        .eq('id', editingMaterial.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update material',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Success', description: 'Material updated' });
    } else {
      const { error } = await supabase.from('cabinet_materials').insert({
        name: editingMaterial.name,
        sku: editingMaterial.sku,
        category: editingMaterial.category || 'Panel',
        subcategory: editingMaterial.subcategory,
        cost_per_unit: editingMaterial.cost_per_unit || 0,
        unit: editingMaterial.unit || 'm²',
        thickness: editingMaterial.thickness,
        color: editingMaterial.color,
        finish_type: editingMaterial.finish_type,
        supplier: editingMaterial.supplier,
        in_stock: editingMaterial.in_stock ?? true,
        waste_factor: editingMaterial.waste_factor,
        standard_size_width: editingMaterial.standard_size_width,
        standard_size_height: editingMaterial.standard_size_height,
        lead_time_days: editingMaterial.lead_time_days,
        notes: editingMaterial.notes,
        image_url: editingMaterial.image_url,
      });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create material',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Success', description: 'Material created' });
    }

    setDialogOpen(false);
    setEditingMaterial(null);
    fetchMaterials();
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cabinet Materials</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Material
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Thickness</TableHead>
                  <TableHead>In Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.sku}</TableCell>
                    <TableCell>{material.category}</TableCell>
                    <TableCell>€{material.cost_per_unit.toFixed(2)}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>{material.thickness ? `${material.thickness}mm` : '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          material.in_stock
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {material.in_stock ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(material)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(material)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(material.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMaterials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No materials found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Edit Material' : 'Add Material'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={editingMaterial?.name || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={editingMaterial?.sku || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({ ...prev, sku: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={editingMaterial?.category || 'Panel'}
                  onValueChange={(value) =>
                    setEditingMaterial((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Input
                  id="subcategory"
                  value={editingMaterial?.subcategory || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      subcategory: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost per Unit (€)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={editingMaterial?.cost_per_unit || 0}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      cost_per_unit: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={editingMaterial?.unit || 'm²'}
                  onValueChange={(value) =>
                    setEditingMaterial((prev) => ({ ...prev, unit: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="thickness">Thickness (mm)</Label>
                <Input
                  id="thickness"
                  type="number"
                  step="0.1"
                  value={editingMaterial?.thickness || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      thickness: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={editingMaterial?.color || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      color: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finish">Finish Type</Label>
                <Input
                  id="finish"
                  value={editingMaterial?.finish_type || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      finish_type: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={editingMaterial?.supplier || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      supplier: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waste">Waste Factor</Label>
                <Input
                  id="waste"
                  type="number"
                  step="0.01"
                  value={editingMaterial?.waste_factor || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      waste_factor: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time">Lead Time (days)</Label>
                <Input
                  id="lead_time"
                  type="number"
                  value={editingMaterial?.lead_time_days || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      lead_time_days: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Standard Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={editingMaterial?.standard_size_width || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      standard_size_width: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Standard Height (mm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={editingMaterial?.standard_size_height || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      standard_size_height: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="flex items-center space-x-2 col-span-2">
                <Switch
                  id="in_stock"
                  checked={editingMaterial?.in_stock ?? true}
                  onCheckedChange={(checked) =>
                    setEditingMaterial((prev) => ({ ...prev, in_stock: checked }))
                  }
                />
                <Label htmlFor="in_stock">In Stock</Label>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={editingMaterial?.notes || ''}
                  onChange={(e) =>
                    setEditingMaterial((prev) => ({
                      ...prev,
                      notes: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MaterialSettings;
