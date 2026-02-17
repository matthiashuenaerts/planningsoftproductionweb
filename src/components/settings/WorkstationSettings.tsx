import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit, Trash, Loader2, ScanBarcode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { workstationService, Workstation } from '@/services/workstationService';
import { useForm } from 'react-hook-form';
import { TaskWorkstationsManager } from './TaskWorkstationsManager';
import { WorkstationTasksManager } from './WorkstationTasksManager';
import PartsTrackingSettingsDialog from './PartsTrackingSettingsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
const WorkstationSettings: React.FC = () => {
  const { tenant } = useTenant();
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkstation, setSelectedWorkstation] = useState<Workstation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTaskMapping, setShowTaskMapping] = useState(false);
  const [showTasksManager, setShowTasksManager] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showIconDialog, setShowIconDialog] = useState(false);
  const [showPartsTracking, setShowPartsTracking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadIconFile, setUploadIconFile] = useState<File | null>(null);
  const [workstationPositions, setWorkstationPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      x_position: 50,
      y_position: 50,
      sort_order: 0,
      production_line: 1
    }
  });

  const loadWorkstations = async () => {
    try {
      setLoading(true);
      const data = await workstationService.getAll(tenant?.id);
      setWorkstations(data);
      
      // Load positions
      const { data: positions, error: posError } = await supabase
        .from('workstation_positions')
        .select('*');
      
      if (!posError && positions) {
        const posMap = new Map<string, { x: number; y: number }>();
        positions.forEach((p: any) => {
          posMap.set(p.workstation_id, { x: Number(p.x_position), y: Number(p.y_position) });
        });
        setWorkstationPositions(posMap);
      }
    } catch (error: any) {
      console.error('Error loading workstations:', error);
      toast({
        title: "Error",
        description: `Failed to load workstations: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkstations();
  }, []);

  const handleOpenEdit = (workstation: Workstation) => {
    setSelectedWorkstation(workstation);
    setIsEditing(true);
    const pos = workstationPositions.get(workstation.id);
    form.reset({
      name: workstation.name,
      description: workstation.description || '',
      x_position: pos?.x ?? 50,
      y_position: pos?.y ?? 50,
      sort_order: workstation.sort_order ?? 0,
      production_line: workstation.production_line ?? 1
    });
    setShowEditDialog(true);
  };

  const handleCreate = async (data: { name: string; description: string }) => {
    try {
      await workstationService.create({
        name: data.name,
        description: data.description || null
      });
      
      toast({
        title: "Success",
        description: "Workstation created successfully"
      });
      
      form.reset();
      loadWorkstations();
    } catch (error: any) {
      console.error('Error creating workstation:', error);
      toast({
        title: "Error",
        description: `Failed to create workstation: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async (data: { name: string; description: string; x_position: number; y_position: number; sort_order: number; production_line: number }) => {
    if (!selectedWorkstation) return;
    
    try {
      await workstationService.update(selectedWorkstation.id, {
        name: data.name,
        description: data.description || null,
        sort_order: data.sort_order,
        production_line: data.production_line
      });
      
      // Update or insert position
      const { error: posError } = await supabase
        .from('workstation_positions')
        .upsert({
          workstation_id: selectedWorkstation.id,
          x_position: data.x_position,
          y_position: data.y_position
        }, { onConflict: 'workstation_id' });
      
      if (posError) throw posError;
      
      toast({
        title: "Success",
        description: "Workstation updated successfully"
      });
      
      setIsEditing(false);
      setShowEditDialog(false);
      setSelectedWorkstation(null);
      form.reset();
      loadWorkstations();
    } catch (error: any) {
      console.error('Error updating workstation:', error);
      toast({
        title: "Error",
        description: `Failed to update workstation: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (workstation: Workstation) => {
    try {
      setIsDeleting(true);
      await workstationService.delete(workstation.id);
      
      toast({
        title: "Success",
        description: "Workstation deleted successfully"
      });
      
      loadWorkstations();
    } catch (error: any) {
      console.error('Error deleting workstation:', error);
      toast({
        title: "Error",
        description: `Failed to delete workstation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedWorkstation || !uploadFile) return;
    try {
      setUploading(true);
      const ext = uploadFile.name.split('.').pop();
      const path = `workstations/${selectedWorkstation.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, uploadFile, {
        upsert: true,
        contentType: uploadFile.type,
      });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      await workstationService.update(selectedWorkstation.id, { image_path: pub.publicUrl });
      toast({ title: 'Success', description: 'Image uploaded successfully' });
      setShowImageDialog(false);
      setUploadFile(null);
      loadWorkstations();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleIconUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedWorkstation || !uploadIconFile) return;
    try {
      setUploadingIcon(true);
      const ext = uploadIconFile.name.split('.').pop();
      const path = `workstation-icons/${selectedWorkstation.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, uploadIconFile, {
        upsert: true,
        contentType: uploadIconFile.type,
      });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      await workstationService.update(selectedWorkstation.id, { icon_path: pub.publicUrl });
      toast({ title: 'Success', description: 'Icon uploaded successfully' });
      setShowIconDialog(false);
      setUploadIconFile(null);
      loadWorkstations();
    } catch (error: any) {
      console.error('Error uploading icon:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload icon', variant: 'destructive' });
    } finally {
      setUploadingIcon(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Workstations</CardTitle>
            <CardDescription>Manage workstations for your factory</CardDescription>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button onClick={() => {
                form.reset({ name: '', description: '' });
                setIsEditing(false);
              }}>
                <PlusCircle className="mr-2 h-4 w-4" /> 
                Add Workstation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Workstation' : 'Add New Workstation'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Update workstation details' : 'Add a new workstation to the system'}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(isEditing ? handleUpdate : handleCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter workstation name" {...field} required />
                        </FormControl>
                        <FormDescription>
                          The name of the workstation (e.g., CUTTING, WELDING)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter workstation description" {...field} />
                        </FormControl>
                        <FormDescription>
                          Detailed description of this workstation's function
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-3">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workstations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No workstations found. Create your first one!
                    </TableCell>
                  </TableRow>
                ) : (
                  workstations
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((workstation) => (
                    <TableRow key={workstation.id}>
                      <TableCell className="text-center font-medium">{workstation.sort_order ?? 0}</TableCell>
                      <TableCell className="text-center">{workstation.production_line ?? 1}</TableCell>
                      <TableCell>{workstation.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{workstation.description}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowTaskMapping(true);
                            }}
                          >
                            Tasks
                          </Button>
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowTasksManager(true);
                            }}
                          >
                            Workstation Tasks
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowPartsTracking(true);
                            }}
                          >
                            <ScanBarcode className="h-3 w-3 mr-1" />
                            Parts Tracking
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowImageDialog(true);
                            }}
                          >
                            Upload image
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowIconDialog(true);
                            }}
                          >
                            Upload icon
                          </Button>
                          <Button
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleOpenEdit(workstation)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(workstation)}
                            disabled={isDeleting}
                          >
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedWorkstation && (
        <Dialog open={showTaskMapping} onOpenChange={setShowTaskMapping}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage Tasks for {selectedWorkstation.name}</DialogTitle>
              <DialogDescription>
                Select which tasks are assigned to this workstation
              </DialogDescription>
            </DialogHeader>
            
            <TaskWorkstationsManager 
              workstationId={selectedWorkstation.id} 
              workstationName={selectedWorkstation.name} 
            />
            
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedWorkstation && (
        <Dialog open={showTasksManager} onOpenChange={setShowTasksManager}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>Manage Workstation Tasks</DialogTitle>
              <DialogDescription>
                Create and manage tasks specific to {selectedWorkstation.name}
              </DialogDescription>
            </DialogHeader>
            
            <WorkstationTasksManager 
              workstationId={selectedWorkstation.id} 
              workstationName={selectedWorkstation.name} 
            />
            
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Upload Dialog */}
      {selectedWorkstation && (
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Image for {selectedWorkstation.name}</DialogTitle>
              <DialogDescription>
                Upload an image that will be displayed for this workstation
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleImageUpload} className="space-y-4">
              <div>
                <label htmlFor="image" className="block text-sm font-medium mb-2">
                  Select Image
                </label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              
              {selectedWorkstation.image_path && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Current image:</p>
                  <img 
                    src={selectedWorkstation.image_path} 
                    alt={selectedWorkstation.name}
                    className="w-32 h-32 object-cover rounded-md border"
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={uploading || !uploadFile}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Upload
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Icon Upload Dialog */}
      {selectedWorkstation && (
        <Dialog open={showIconDialog} onOpenChange={setShowIconDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Icon for {selectedWorkstation.name}</DialogTitle>
              <DialogDescription>
                Upload an icon that will be used as progress indicator and in dashboard tiles
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleIconUpload} className="space-y-4">
              <div>
                <label htmlFor="icon" className="block text-sm font-medium mb-2">
                  Select Icon (PNG, SVG, or other image formats)
                </label>
                <Input
                  id="icon"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadIconFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              
              {selectedWorkstation.icon_path && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Current icon:</p>
                  <img 
                    src={selectedWorkstation.icon_path} 
                    alt={`${selectedWorkstation.name} icon`}
                    className="w-8 h-8 object-contain border rounded"
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={uploadingIcon || !uploadIconFile}>
                  {uploadingIcon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Upload
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Workstation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setIsEditing(false);
          setSelectedWorkstation(null);
          form.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workstation</DialogTitle>
            <DialogDescription>
              Update workstation details and floor plan position
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter workstation name" {...field} required />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter workstation description" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sort_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Order in production flow
                      </FormDescription>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="production_line"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Line</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>
                        Production line number
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="x_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>X Position (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Horizontal position on floor plan (0-100%)
                      </FormDescription>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="y_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Y Position (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Vertical position on floor plan (0-100%)
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {selectedWorkstation && (
        <PartsTrackingSettingsDialog
          isOpen={showPartsTracking}
          onClose={() => setShowPartsTracking(false)}
          workstationId={selectedWorkstation.id}
          workstationName={selectedWorkstation.name}
        />
      )}
    </div>
  );
};

export default WorkstationSettings;
