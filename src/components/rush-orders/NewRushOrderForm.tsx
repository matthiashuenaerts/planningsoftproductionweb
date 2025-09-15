import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Calendar as CalendarIcon, Camera, File as FileIcon, Check, X, RotateCcw, Image } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      assignedUsers: [],
      projectId: ''
    }
  });
  
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  
  // Camera states
  const [cameraMode, setCameraMode] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

  // Fetch projects
  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client')
        .order('name');
      
      if (error) throw error;
      return data;
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
  
  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraMode('camera');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);
    
    // Convert to file for upload
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `rush-order-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        setValue('attachment', file);
        setFilePreview({ name: file.name, type: file.type, url: imageDataUrl });
      }
    }, 'image/jpeg', 0.8);
    
    stopCamera();
    setCameraMode('preview');
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setValue('attachment', undefined);
    setFilePreview(null);
    startCamera();
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const cancelCamera = () => {
    stopCamera();
    setCameraMode('none');
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    setCameraMode('none');
  };

  const clearImage = () => {
    setValue('attachment', undefined);
    setFilePreview(null);
    setCapturedImage(null);
    setCameraMode('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      setCapturedImage(null);
      setCameraMode('none');
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
        data.attachment,
        data.projectId || undefined
      );
      
      if (!rushOrder) throw new Error("Failed to create rush order");
      
      // Assign tasks and create actual task records if project is selected
      if (data.selectedTasks.length > 0) {
        await rushOrderService.assignTasksToRushOrder(rushOrder.id, data.selectedTasks, data.projectId);
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
  
  // Camera view
  if (cameraMode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Take Photo</h3>
          <Button variant="ghost" size="icon" onClick={cancelCamera}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              onClick={captureImage}
              className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16"
            >
              <Camera className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={cancelCamera}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Photo preview
  if (cameraMode === 'preview' && capturedImage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Photo Preview</h3>
        </div>
        
        <div className="relative">
          <img
            src={capturedImage}
            alt="Captured attachment"
            className="w-full rounded-lg max-h-96 object-contain bg-gray-100"
          />
        </div>
        
        <p className="text-sm text-gray-600">
          Photo captured successfully. Confirm to use this image or retake.
        </p>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={retakePhoto}>
            Retake Photo
          </Button>
          <Button onClick={confirmPhoto} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4" />
            Use Photo
          </Button>
        </div>
      </div>
    );
  }
  
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
            <label htmlFor="projectId" className="block text-sm font-medium">Project (Optional)</label>
            <Select onValueChange={(value) => setValue('projectId', value === 'none' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {loadingProjects ? (
                  <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                ) : (
                  projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.client}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Attachment</label>
            {filePreview ? (
              <div className="relative w-full text-center border-2 border-dashed border-gray-300 rounded-lg p-6">
                {filePreview.url ? (
                  <img src={filePreview.url} alt="Preview" className="w-full h-auto rounded-md max-h-64 object-contain" />
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
                  onClick={clearImage}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCamera}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerFileInput}
                    className="flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    Choose File
                  </Button>
                </div>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer" onClick={triggerFileInput}>
                  <div className="text-center">
                    <FileIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Click to upload an image or document</p>
                    <p className="text-xs text-gray-400">Images, PDF, DOC, XLS, etc.</p>
                  </div>
                </div>
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
