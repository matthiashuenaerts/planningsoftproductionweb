import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LegraboxConfig {
  id: string;
  name: string;
  height_type: string;
  height_mm: number;
  side_colour: string;
  bottom_colour: string | null;
  has_drawer_mat: boolean | null;
  nominal_length: number;
  load_capacity_kg: number | null;
  price: number;
  sku: string | null;
  supplier: string | null;
  notes: string | null;
  is_active: boolean;
  antislip_mat_cost: number;
  tip_on_cost: number;
}

const heightTypes = {
  M: { label: 'M - Low (66mm)', height: 66 },
  K: { label: 'K - Medium (101mm)', height: 101 },
  C: { label: 'C - High (177mm)', height: 177 },
  F: { label: 'F - Extra-High (243mm)', height: 243 },
};

const sideColours = ['Orion Grey', 'Silk White', 'Stainless Steel', 'Terra Black', 'Carbon Black Matte'];
const bottomColours = ['White', 'Grey', 'Black', 'Oak', 'Walnut'];
const nominalLengths = [270, 300, 350, 400, 450, 500, 550, 600];

export function LegraboxManager() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<LegraboxConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<LegraboxConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const emptyConfig: Partial<LegraboxConfig> = {
    name: '',
    height_type: 'M',
    height_mm: 66,
    side_colour: 'Orion Grey',
    bottom_colour: 'White',
    has_drawer_mat: false,
    nominal_length: 450,
    load_capacity_kg: 40,
    price: 0,
    sku: '',
    supplier: 'Blum',
    notes: '',
    is_active: true,
    antislip_mat_cost: 0,
    tip_on_cost: 0,
  };

  const [formData, setFormData] = useState<Partial<LegraboxConfig>>(emptyConfig);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('legrabox_configurations')
      .select('*')
      .order('height_type')
      .order('nominal_length');
    
    if (error) {
      toast({ title: 'Error loading Legrabox configurations', variant: 'destructive' });
    } else {
      setConfigs(data || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editingConfig) {
        // Update existing
        const { error } = await supabase
          .from('legrabox_configurations')
          .update(formData as any)
          .eq('id', editingConfig.id);
        
        if (error) throw error;
        toast({ title: 'Configuration updated' });
      } else {
        // Create new
        const { error } = await supabase
          .from('legrabox_configurations')
          .insert(formData as any);
        
        if (error) throw error;
        toast({ title: 'Configuration created' });
      }
      
      setIsDialogOpen(false);
      setEditingConfig(null);
      setFormData(emptyConfig);
      loadConfigs();
    } catch (error) {
      toast({ title: 'Error saving configuration', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('legrabox_configurations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Configuration deleted' });
      loadConfigs();
    } catch (error) {
      toast({ title: 'Error deleting configuration', variant: 'destructive' });
    }
  };

  const openEditDialog = (config: LegraboxConfig) => {
    setEditingConfig(config);
    setFormData(config);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingConfig(null);
    setFormData(emptyConfig);
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Blum Legrabox Configurations</span>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? 'Edit Legrabox Configuration' : 'New Legrabox Configuration'}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 p-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Legrabox M 450mm Orion Grey"
                      />
                    </div>

                    <div>
                      <Label>Height Type</Label>
                      <Select
                        value={formData.height_type}
                        onValueChange={(value: 'M' | 'K' | 'C' | 'F') => 
                          setFormData({ 
                            ...formData, 
                            height_type: value,
                            height_mm: heightTypes[value].height 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(heightTypes).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                              {value.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Nominal Length (mm)</Label>
                      <Select
                        value={String(formData.nominal_length)}
                        onValueChange={(value) => setFormData({ ...formData, nominal_length: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nominalLengths.map((length) => (
                            <SelectItem key={length} value={String(length)}>
                              {length}mm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Side Colour</Label>
                      <Select
                        value={formData.side_colour}
                        onValueChange={(value) => setFormData({ ...formData, side_colour: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sideColours.map((colour) => (
                            <SelectItem key={colour} value={colour}>
                              {colour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Bottom Panel Colour</Label>
                      <Select
                        value={formData.bottom_colour}
                        onValueChange={(value) => setFormData({ ...formData, bottom_colour: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {bottomColours.map((colour) => (
                            <SelectItem key={colour} value={colour}>
                              {colour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Load Capacity (kg)</Label>
                      <Input
                        type="number"
                        value={formData.load_capacity_kg}
                        onChange={(e) => setFormData({ ...formData, load_capacity_kg: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label>Price (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="e.g., LGX-M-450-OG"
                      />
                    </div>

                    <div>
                      <Label>Supplier</Label>
                      <Input
                        value={formData.supplier}
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Antislip Mat Cost (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.antislip_mat_cost || 0}
                        onChange={(e) => setFormData({ ...formData, antislip_mat_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="Additional cost when mat selected"
                      />
                    </div>

                    <div>
                      <Label>TIP-ON Cost (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.tip_on_cost || 0}
                        onChange={(e) => setFormData({ ...formData, tip_on_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="Additional cost when TIP-ON selected"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
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
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Side Colour</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Mat Cost</TableHead>
                  <TableHead>TIP-ON</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell>{config.height_type} ({config.height_mm}mm)</TableCell>
                    <TableCell>{config.nominal_length}mm</TableCell>
                    <TableCell>{config.side_colour}</TableCell>
                    <TableCell>€{config.price.toFixed(2)}</TableCell>
                    <TableCell>€{(config.antislip_mat_cost || 0).toFixed(2)}</TableCell>
                    <TableCell>€{(config.tip_on_cost || 0).toFixed(2)}</TableCell>
                    <TableCell>{config.is_active ? '✓' : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(config)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
