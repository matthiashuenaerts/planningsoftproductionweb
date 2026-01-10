import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Trash2, Save, ArrowUpDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CsvImportConfig {
  id: string;
  config_name: string;
  csv_header: string;
  db_column: string;
  is_required: boolean;
  display_order: number;
  description: string | null;
}

// Available database columns for the parts table
const PARTS_DB_COLUMNS = [
  { value: 'materiaal', label: 'Materiaal (Material)' },
  { value: 'dikte', label: 'Dikte (Thickness)' },
  { value: 'nerf', label: 'Nerf (Grain)' },
  { value: 'lengte', label: 'Lengte (Length)' },
  { value: 'breedte', label: 'Breedte (Width)' },
  { value: 'aantal', label: 'Aantal (Quantity)' },
  { value: 'cnc_pos', label: 'CNC Pos (CNC Position)' },
  { value: 'wand_naam', label: 'Wand Naam (Wall Name)' },
  { value: 'afplak_boven', label: 'Afplak Boven (Edge Top)' },
  { value: 'afplak_onder', label: 'Afplak Onder (Edge Bottom)' },
  { value: 'afplak_links', label: 'Afplak Links (Edge Left)' },
  { value: 'afplak_rechts', label: 'Afplak Rechts (Edge Right)' },
  { value: 'commentaar', label: 'Commentaar (Comment)' },
  { value: 'commentaar_2', label: 'Commentaar 2 (Comment 2)' },
  { value: 'cncprg1', label: 'CNCPRG1 (CNC Program 1)' },
  { value: 'cncprg2', label: 'CNCPRG2 (CNC Program 2)' },
  { value: 'abd', label: 'ABD' },
  { value: 'afbeelding', label: 'Afbeelding (Image)' },
  { value: 'doorlopende_nerf', label: 'Doorlopende Nerf (Continuous Grain)' },
];

// Available database columns for the accessories table
const ACCESSORIES_DB_COLUMNS = [
  { value: 'article_name', label: 'Article Name' },
  { value: 'article_description', label: 'Article Description' },
  { value: 'article_code', label: 'Article Code' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'stock_location', label: 'Stock Location' },
  { value: 'status', label: 'Status' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'qr_code_text', label: 'QR Code Text' },
  { value: 'unit_price', label: 'Unit Price' },
];

interface ConfigSectionProps {
  configName: string;
  dbColumns: { value: string; label: string }[];
  title: string;
  description: string;
}

const ConfigSection: React.FC<ConfigSectionProps> = ({ configName, dbColumns, title, description }) => {
  const [configs, setConfigs] = useState<CsvImportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Map<string, Partial<CsvImportConfig>>>(new Map());
  const [newConfig, setNewConfig] = useState({ csv_header: '', db_column: '', description: '' });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfigs();
  }, [configName]);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('csv_import_configs')
        .select('*')
        .eq('config_name', configName)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error loading CSV import configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load CSV import configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (id: string, field: keyof CsvImportConfig, value: any) => {
    const current = editedConfigs.get(id) || {};
    setEditedConfigs(new Map(editedConfigs.set(id, { ...current, [field]: value })));
  };

  const saveConfig = async (config: CsvImportConfig) => {
    const edits = editedConfigs.get(config.id);
    if (!edits) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('csv_import_configs')
        .update(edits)
        .eq('id', config.id);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Configuration updated successfully' });
      setEditedConfigs(new Map(editedConfigs));
      editedConfigs.delete(config.id);
      loadConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error } = await supabase.from('csv_import_configs').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Configuration deleted successfully' });
      loadConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({ title: 'Error', description: 'Failed to delete configuration', variant: 'destructive' });
    }
  };

  const addNewConfig = async () => {
    if (!newConfig.csv_header || !newConfig.db_column) {
      toast({ title: 'Error', description: 'CSV header and database column are required', variant: 'destructive' });
      return;
    }

    try {
      const maxOrder = Math.max(...configs.map(c => c.display_order), 0);
      const { error } = await supabase.from('csv_import_configs').insert({
        config_name: configName,
        csv_header: newConfig.csv_header,
        db_column: newConfig.db_column,
        description: newConfig.description || null,
        display_order: maxOrder + 1,
        is_required: false,
      });

      if (error) throw error;

      toast({ title: 'Added', description: 'New mapping added successfully' });
      setNewConfig({ csv_header: '', db_column: '', description: '' });
      setShowAddDialog(false);
      loadConfigs();
    } catch (error: any) {
      console.error('Error adding config:', error);
      toast({ 
        title: 'Error', 
        description: error.message?.includes('duplicate') 
          ? 'This CSV header already exists' 
          : 'Failed to add configuration', 
        variant: 'destructive' 
      });
    }
  };

  const getDisplayValue = (config: CsvImportConfig, field: keyof CsvImportConfig) => {
    const edits = editedConfigs.get(config.id);
    if (edits && field in edits) return edits[field];
    return config[field];
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
            {title}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Column Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>CSV Header (exact match from your CSV file)</Label>
                <Input
                  value={newConfig.csv_header}
                  onChange={(e) => setNewConfig({ ...newConfig, csv_header: e.target.value })}
                  placeholder="e.g., My Custom Header"
                />
              </div>
              <div className="space-y-2">
                <Label>Database Column</Label>
                <Select
                  value={newConfig.db_column}
                  onValueChange={(value) => setNewConfig({ ...newConfig, db_column: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select database column" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbColumns.map((col) => (
                      <SelectItem key={col.value} value={col.value}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
              <Button onClick={addNewConfig} className="w-full">
                Add Mapping
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
                <TableHead className="w-[50px]">
                  <ArrowUpDown className="h-4 w-4" />
                </TableHead>
                <TableHead>CSV Header</TableHead>
                <TableHead>Database Column</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Required</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {config.display_order}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={getDisplayValue(config, 'csv_header') as string}
                      onChange={(e) => handleFieldChange(config.id, 'csv_header', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={getDisplayValue(config, 'db_column') as string}
                      onValueChange={(value) => handleFieldChange(config.id, 'db_column', value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dbColumns.map((col) => (
                          <SelectItem key={col.value} value={col.value}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={(getDisplayValue(config, 'description') as string) || ''}
                      onChange={(e) => handleFieldChange(config.id, 'description', e.target.value)}
                      className="h-8"
                      placeholder="Description"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={getDisplayValue(config, 'is_required') as boolean}
                      onCheckedChange={(checked) => handleFieldChange(config.id, 'is_required', checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editedConfigs.has(config.id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveConfig(config)}
                          disabled={saving}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteConfig(config.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export const CsvImportConfigSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="parts_list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="parts_list">Parts List Import</TabsTrigger>
          <TabsTrigger value="accessories">Accessories Import</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parts_list">
          <ConfigSection
            configName="parts_list"
            dbColumns={PARTS_DB_COLUMNS}
            title="Parts List CSV Column Mappings"
            description="Configure how CSV column headers map to database fields for parts list imports."
          />
        </TabsContent>
        
        <TabsContent value="accessories">
          <ConfigSection
            configName="accessories"
            dbColumns={ACCESSORIES_DB_COLUMNS}
            title="Accessories CSV Column Mappings"
            description="Configure how CSV column headers map to database fields for accessories imports."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
