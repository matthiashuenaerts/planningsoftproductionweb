import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { CheckboxCard } from '@/components/settings/CheckboxCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Camera, File as FileIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { rushOrderService } from '@/services/rushOrderService';
import { useAuth } from '@/context/AuthContext';
import { RushOrderFormData } from '@/types/rushOrder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { ensureStorageBucket } from "@/integrations/supabase/createBucket";

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
}

const NewRushOrderForm: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const { register, handleSubmit: formHandleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RushOrderFormData>({
    defaultValues: {
      title: '',
      description: '',
      deadline: new Date(),
      attachment: undefined,
      selectedTasks: [],
      assignedUsers: []
    }
  });
  
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  
  // Selected tasks and users
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Fetch standard tasks
  const { data: standardTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['standardTasks'],
    queryFn: standardTasksService.getAll
  });
  
  // Fetch employees
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .in('role', ['admin', 'manager', 'worker', 'installation_team']);
      
      if (error) throw error;
      return data as Employee[];
    }
  });
  
  // Ensure storage bucket exists on component mount
  useEffect(() => {
    const checkBuckets = async () => {
      const result = await ensureStorageBucket('attachments');
      if (!result.success) {
        console.error("Failed to ensure attachments bucket:", result.error);
        toast({
          title: "Storage Error",
          description: "There was a problem setting up file storage. Some features might be limited.",
          variant: "destructive"
        });
      }
    };
    checkBuckets();
  }, [toast]);
  
  // Update form when selections change
  useEffect(() => {
    setValue('selectedTasks', selectedTaskIds);
    setValue('assignedUsers', selectedUserIds);
  }, [selectedTaskIds, selectedUserIds, setValue]);
  
  // Update date in form when popover date changes
  useEffect(() => {
    setValue('deadline', date);
  }, [date, setValue]);
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('attachment', file);
      
      if (file.type.startsWith('image/')) {
        // Create preview for images
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview({ name: file.name, type: file.type, url: reader.result as string });
        };
        reader.readAsDataURL(file);
      } else {
        // For documents, just store file info
        setFilePreview({ name: file.name, type: file.type });
      }
    }
  };
  
  // Handle task selection
  const handleTaskToggle = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };
  
  // Handle user selection
  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };
  
  // Handle form submission
  const onSubmit = async (data: RushOrderFormData) => {
    if (!currentEmployee) return;
    
    setIsSubmitting(true);
    
    try {
      // Format deadline
      const formattedDeadline = format(data.deadline, "yyyy-MM-dd'T'HH:mm:ss");
      
      // Create rush order
      const rushOrder = await rushOrderService.createRushOrder(
        data.title,
        data.description,
        formattedDeadline,
        currentEmployee.id,
        data.attachment
      );
      
      if (!rushOrder) throw new Error("Failed to create rush order");
      
      // Assign tasks
      if (data.selectedTasks.length > 0) {
        await rushOrderService.assignTasksToRushOrder(rushOrder.id, data.selectedTasks);
      }
      
      // Assign users
      if (data.assignedUsers.length > 0) {
        await rushOrderService.assignUsersToRushOrder(rushOrder.id, data.assignedUsers);
      }
      
      // Send notifications to all users
      await rushOrderService.notifyAllUsers(
        rushOrder.id, 
        `New rush order created: ${data.title}`
      );
      
      toast({
        title: "Success",
        description: "Rush order created successfully"
      });
      
      // Reset form
      reset();
      setFilePreview(null);
      setSelectedTaskIds([]);
      setSelectedUserIds([]);
      
      // Call onSuccess callback
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error submitting rush order:", error);
      toast({
        title: "Error",
        description: `An error occurred while creating the rush order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  const watchData = watch();
  
  return (
    <form onSubmit={formHandleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium">Title</label>
            <Input
              id="title"
              placeholder="Rush order title"
              {...register("title", { required: "Title is required" })}
              className="w-full"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium">Description</label>
            <Textarea
              id="description"
              placeholder="Describe the rush order in detail"
              {...register("description", { required: "Description is required" })}
              className="w-full min-h-[100px]"
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">Deadline</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">Attachment</label>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer" onClick={triggerFileInput}>
              {filePreview ? (
                <div className="relative w-full text-center">
                  {filePreview.url ? (
                    <img src={filePreview.url} alt="Preview" className="w-full h-auto rounded-md" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileIcon className="h-12 w-12 text-gray-400" />
                      <p className="font-medium text-sm break-all">{filePreview.name}</p>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilePreview(null);
                      setValue('attachment', undefined);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Click to upload an image or document</p>
                  <p className="text-xs text-gray-400">Images, PDF, DOC, XLS, etc.</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="attachment-upload"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Select Tasks</label>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-md">Standard Tasks</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {loadingTasks ? (
                  <div className="flex justify-center p-4">Loading tasks...</div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-1 gap-2">
                      {standardTasks?.map((task: StandardTask) => (
                        <CheckboxCard
                          key={task.id}
                          id={task.id}
                          title={task.task_name}
                          description={`Task #${task.task_number}`}
                          checked={selectedTaskIds.includes(task.id)}
                          onCheckedChange={(checked) => handleTaskToggle(task.id, checked)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            {errors.selectedTasks && selectedTaskIds.length === 0 && (
              <p className="text-sm text-red-500">Please select at least one task</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">Assign Users</label>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-md">Team Members</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {loadingEmployees ? (
                  <div className="flex justify-center p-4">Loading users...</div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-1 gap-2">
                      {employees?.map((employee) => (
                        <CheckboxCard
                          key={employee.id}
                          id={employee.id}
                          title={employee.name}
                          description={employee.role}
                          checked={selectedUserIds.includes(employee.id)}
                          onCheckedChange={(checked) => handleUserToggle(employee.id, checked)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            {errors.assignedUsers && selectedUserIds.length === 0 && (
              <p className="text-sm text-red-500">Please assign at least one user</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-red-600 hover:bg-red-700"
        >
          {isSubmitting ? "Creating..." : "Create Rush Order"}
        </Button>
      </div>
    </form>
  );
};

export default NewRushOrderForm;
