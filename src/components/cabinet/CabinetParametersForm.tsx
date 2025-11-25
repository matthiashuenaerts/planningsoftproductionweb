import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];
type CabinetMaterial = Database['public']['Tables']['cabinet_materials']['Row'];

const configSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  width: z.number().min(100).max(3000),
  height: z.number().min(100).max(3000),
  depth: z.number().min(100).max(800),
  horizontal_divisions: z.number().min(0).max(10),
  vertical_divisions: z.number().min(0).max(10),
  drawer_count: z.number().min(0).max(10),
  door_type: z.string().optional(),
  finish: z.string().optional(),
  edge_banding: z.string().optional(),
});

interface CabinetParametersFormProps {
  projectId: string;
  configuration: CabinetConfiguration | null;
  onUpdate: (config: CabinetConfiguration) => void;
  onReload: () => void;
}

export function CabinetParametersForm({ projectId, configuration, onUpdate, onReload }: CabinetParametersFormProps) {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<CabinetMaterial[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      name: configuration?.name || 'New Cabinet',
      width: Number(configuration?.width) || 600,
      height: Number(configuration?.height) || 720,
      depth: Number(configuration?.depth) || 350,
      horizontal_divisions: configuration?.horizontal_divisions || 1,
      vertical_divisions: configuration?.vertical_divisions || 0,
      drawer_count: configuration?.drawer_count || 0,
      door_type: configuration?.door_type || 'hinged',
      finish: configuration?.finish || 'none',
      edge_banding: configuration?.edge_banding || 'matching',
    },
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    if (configuration) {
      form.reset({
        name: configuration.name,
        width: Number(configuration.width),
        height: Number(configuration.height),
        depth: Number(configuration.depth),
        horizontal_divisions: configuration.horizontal_divisions || 0,
        vertical_divisions: configuration.vertical_divisions || 0,
        drawer_count: configuration.drawer_count || 0,
        door_type: configuration.door_type || 'hinged',
        finish: configuration.finish || 'none',
        edge_banding: configuration.edge_banding || 'matching',
      });
    }
  }, [configuration]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('cabinet_materials')
        .select('*')
        .eq('in_stock', true)
        .order('category');

      if (error) throw error;
      setMaterials(data);
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const onSubmit = async (values: z.infer<typeof configSchema>) => {
    setSaving(true);
    try {
      if (configuration) {
        // Update existing
        const { data, error } = await supabase
          .from('cabinet_configurations')
          .update({
            name: values.name,
            width: values.width,
            height: values.height,
            depth: values.depth,
            horizontal_divisions: values.horizontal_divisions,
            vertical_divisions: values.vertical_divisions,
            drawer_count: values.drawer_count,
            door_type: values.door_type,
            finish: values.finish,
            edge_banding: values.edge_banding,
          })
          .eq('id', configuration.id)
          .select()
          .single();

        if (error) throw error;
        onUpdate(data);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('cabinet_configurations')
          .insert({
            project_id: projectId,
            name: values.name,
            width: values.width,
            height: values.height,
            depth: values.depth,
            horizontal_divisions: values.horizontal_divisions,
            vertical_divisions: values.vertical_divisions,
            drawer_count: values.drawer_count,
            door_type: values.door_type,
            finish: values.finish,
            edge_banding: values.edge_banding,
          })
          .select()
          .single();

        if (error) throw error;
        onUpdate(data);
        onReload();
      }

      toast({
        title: 'Success',
        description: 'Cabinet configuration saved',
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cabinet Parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cabinet Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="depth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depth (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="horizontal_divisions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shelves</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vertical_divisions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dividers</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="drawer_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drawers</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="door_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hinged">Hinged</SelectItem>
                        <SelectItem value="sliding">Sliding</SelectItem>
                        <SelectItem value="none">No Doors</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="finish"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Finish</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="matt">Matt</SelectItem>
                        <SelectItem value="gloss">Gloss</SelectItem>
                        <SelectItem value="satin">Satin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="edge_banding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edge Banding</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="matching">Matching</SelectItem>
                        <SelectItem value="contrast">Contrast</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
