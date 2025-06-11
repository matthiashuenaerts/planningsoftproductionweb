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
import { PlusCircle, Edit, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { workstationService, Workstation } from '@/services/workstationService';
import { useForm } from 'react-hook-form';
import { TaskWorkstationsManager } from './TaskWorkstationsManager';
import { WorkstationTasksManager } from './WorkstationTasksManager';

const WorkstationSettings: React.FC = () => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkstation, setSelectedWorkstation] = useState<Workstation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTaskMapping, setShowTaskMapping] = useState(false);
  const [showTasksManager, setShowTasksManager] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: '',
      description: ''
    }
  });

  const loadWorkstations = async () => {
    try {
      setLoading(true);
      const data = await workstationService.getAll();
      setWorkstations(data);
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
    form.reset({
      name: workstation.name,
      description: workstation.description || ''
    });
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

  const handleUpdate = async (data: { name: string; description: string }) => {
    if (!selectedWorkstation) return;
    
    try {
      await workstationService.update(selectedWorkstation.id, {
        name: data.name,
        description: data.description || null
      });
      
      toast({
        title: "Success",
        description: "Workstation updated successfully"
      });
      
      setIsEditing(false);
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
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workstations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No workstations found. Create your first one!
                    </TableCell>
                  </TableRow>
                ) : (
                  workstations.map((workstation) => (
                    <TableRow key={workstation.id}>
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
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleOpenEdit(workstation)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                          </Dialog>
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
    </div>
  );
};

export default WorkstationSettings;
