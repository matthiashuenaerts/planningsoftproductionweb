import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { Calendar as CalendarIcon, Camera, File as FileIcon, Check, X, RotateCcw, Image, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { StandardTask, standardTasksService } from '@/services/standardTasksService';
import { rushOrderService } from '@/services/rushOrderService';
import { useAuth } from '@/context/AuthContext';
import { RushOrderFormData } from '@/types/rushOrder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { ensureStorageBucket } from "@/integrations/supabase/createBucket";
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useLanguage } from '@/context/LanguageContext';

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface NewRushOrderFormProps {
  onSuccess?: () => void;
  initialValues?: Partial<RushOrderFormData>;
}

const NewRushOrderForm: React.FC<NewRushOrderFormProps> = ({ onSuccess, initialValues }) => {
  const { t } = useLanguage();
  const { register, handleSubmit: formHandleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RushOrderFormData>({
    defaultValues: {
      title: initialValues?.title || '',
      description: initialValues?.description || '',
      deadline: initialValues?.deadline || new Date(),
      attachment: undefined,
      selectedTasks: initialValues?.selectedTasks || [],
      assignedUsers: initialValues?.assignedUsers || [],
      projectId: initialValues?.projectId || ''
    }
  });
  
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date>(initialValues?.deadline || new Date());
  const [deadlineTime, setDeadlineTime] = useState<string>(
    initialValues?.deadline ? format(initialValues.deadline, 'HH:mm') : '17:00'
  );
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const isMobile = useIsMobile();
  
  const [cameraMode, setCameraMode] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  const { data: standardTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['standardTasks'],
    queryFn: () => standardTasksService.getAll()
  });
  
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('*')
        .in('role', ['admin', 'manager', 'worker', 'installation_team']);
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    }
  });

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name, client')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
  
  useEffect(() => {
    const checkBuckets = async () => {
      const result = await ensureStorageBucket('attachments');
      if (!result.success) {
        console.error("Failed to ensure attachments bucket:", result.error);
        toast({
          title: t('ro_storage_error'),
          description: t('ro_storage_error_desc'),
          variant: "destructive"
        });
      }
    };
    checkBuckets();
  }, [toast, t]);
  
  useEffect(() => {
    setValue('selectedTasks', selectedTaskIds);
    setValue('assignedUsers', selectedUserIds);
  }, [selectedTaskIds, selectedUserIds, setValue]);

  useEffect(() => {
    if (initialValues?.attachment) {
      setValue('attachment', initialValues.attachment);
      if (initialValues.attachment.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview({ 
            name: initialValues.attachment!.name, 
            type: initialValues.attachment!.type, 
            url: reader.result as string 
          });
        };
        reader.readAsDataURL(initialValues.attachment);
      } else {
        setFilePreview({ name: initialValues.attachment.name, type: initialValues.attachment.type });
      }
    }
  }, [initialValues?.attachment, setValue]);
  
  useEffect(() => {
    const [hours, minutes] = deadlineTime.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    setValue('deadline', combined);
  }, [date, deadlineTime, setValue]);
  
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraMode('camera');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: t('ro_camera_error'),
        description: t('ro_camera_error_desc'),
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

  const captureImageFn = () => {
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
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `rush-order-${Date.now()}.jpg`, { type: 'image/jpeg' });
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
    setTimeout(() => startCamera(), 100);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('attachment', file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview({ name: file.name, type: file.type, url: reader.result as string });
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview({ name: file.name, type: file.type });
      }
      setCapturedImage(null);
      setCameraMode('none');
    }
  };
  
  const handleTaskToggle = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };
  
  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };
  
  const onSubmit = async (data: RushOrderFormData) => {
    if (!currentEmployee) return;
    setIsSubmitting(true);
    try {
      const formattedDeadline = format(data.deadline, "yyyy-MM-dd'T'HH:mm:ss");
      const rushOrder = await rushOrderService.createRushOrder(
        data.title, data.description, formattedDeadline,
        currentEmployee.id, data.attachment, data.projectId || undefined
      );
      if (!rushOrder) throw new Error("Failed to create rush order");
      if (data.selectedTasks.length > 0) {
        await rushOrderService.assignTasksToRushOrder(rushOrder.id, data.selectedTasks, data.projectId);
      }
      if (data.assignedUsers.length > 0) {
        await rushOrderService.assignUsersToRushOrder(rushOrder.id, data.assignedUsers);
      }
      await rushOrderService.notifyAllUsers(rushOrder.id, `New rush order created: ${data.title}`);
      toast({ title: t('success'), description: t('ro_created_success') });
      reset();
      setFilePreview(null);
      setSelectedTaskIds([]);
      setSelectedUserIds([]);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error submitting rush order:", error);
      toast({
        title: t('error'),
        description: `${t('ro_create_error')}: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const triggerFileInput = () => fileInputRef.current?.click();
  const watchData = watch();
  
  // Camera view
  if (cameraMode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('ro_take_photo')}</h3>
          <Button variant="ghost" size="icon" onClick={cancelCamera}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
            <Button variant="outline" size="icon" onClick={switchCamera}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="lg" onClick={captureImageFn}
              className="bg-background text-foreground hover:bg-muted rounded-full w-16 h-16">
              <Camera className="h-6 w-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={cancelCamera}
              className="bg-white/20 border-white/30 text-white hover:bg-white/30">
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
          <h3 className="text-lg font-medium">{t('ro_photo_preview')}</h3>
        </div>
        <div className="relative">
          <img src={capturedImage} alt="Captured attachment"
            className="w-full rounded-lg max-h-96 object-contain bg-muted" />
        </div>
        <p className="text-sm text-muted-foreground">{t('ro_photo_captured')}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={retakePhoto}>{t('ro_retake_photo')}</Button>
          <Button onClick={confirmPhoto} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4" />
            {t('ro_use_photo')}
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <form onSubmit={formHandleSubmit(onSubmit)} className={`${isMobile ? 'space-y-3' : 'space-y-6'}`}>
      <div className={`grid grid-cols-1 ${isMobile ? 'gap-3' : 'md:grid-cols-2 gap-4 md:gap-6'}`}>
        <div className={`${isMobile ? 'space-y-2.5' : 'space-y-4 md:space-y-6'} min-w-0`}>
          <div className="space-y-1">
            <label htmlFor="title" className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_title')}</label>
            <Input
              id="title"
              placeholder={t('ro_title_placeholder')}
              {...register("title", { required: t('ro_title_required') })}
              className={`w-full ${isMobile ? 'h-9 text-sm' : ''}`}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label htmlFor="description" className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_description')}</label>
            <Textarea
              id="description"
              placeholder={t('ro_description_placeholder')}
              {...register("description", { required: t('ro_description_required') })}
              className={`w-full ${isMobile ? 'min-h-[70px] text-sm' : 'min-h-[100px]'}`}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_deadline')}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      isMobile && "h-9 text-sm",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className={`mr-2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                    {date ? format(date, "PPP") : <span>{t('ro_pick_date')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                    weekStartsOn={1}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className={`${isMobile ? 'h-9 text-sm w-full' : 'w-full sm:w-28'}`}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="projectId" className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_project_optional')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal",
                    isMobile && "h-9 text-sm",
                    !watchData.projectId && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">
                    {watchData.projectId
                      ? projects?.find(p => p.id === watchData.projectId)
                        ? `${projects.find(p => p.id === watchData.projectId)!.name} - ${projects.find(p => p.id === watchData.projectId)!.client}`
                        : t('ro_select_project')
                      : t('ro_no_project')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('ro_select_project')} className={isMobile ? 'text-sm' : ''} />
                  <CommandList>
                    <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
                      {loadingProjects ? t('ro_loading_projects') : 'No projects found'}
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => setValue('projectId', '')}
                      >
                        <Check className={cn("mr-2 h-3.5 w-3.5", !watchData.projectId ? "opacity-100" : "opacity-0")} />
                        {t('ro_no_project')}
                      </CommandItem>
                      {projects?.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={`${project.name} ${project.client}`}
                          onSelect={() => setValue('projectId', project.id)}
                        >
                          <Check className={cn("mr-2 h-3.5 w-3.5", watchData.projectId === project.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{project.name} - {project.client}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_attachment')}</label>
            {filePreview ? (
              <div className={`relative w-full text-center border-2 border-dashed border-border rounded-lg ${isMobile ? 'p-3' : 'p-4 md:p-6'}`}>
                {filePreview.url ? (
                  <img src={filePreview.url} alt="Preview" className={`w-full h-auto rounded-md object-contain ${isMobile ? 'max-h-40' : 'max-h-64'}`} />
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <FileIcon className={`text-muted-foreground ${isMobile ? 'h-8 w-8' : 'h-12 w-12'}`} />
                    <p className="font-medium text-xs break-all">{filePreview.name}</p>
                  </div>
                )}
                <Button type="button" variant="destructive" size="sm"
                  className="absolute top-1.5 right-1.5" onClick={clearImage}>
                  {t('ro_remove')}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" onClick={startCamera} className="flex items-center gap-1.5" size="sm">
                    <Camera className="h-3.5 w-3.5" />
                    <span className={isMobile ? 'text-xs' : ''}>{t('ro_take_photo')}</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={triggerFileInput} className="flex items-center gap-1.5" size="sm">
                    <Image className="h-3.5 w-3.5" />
                    <span className={isMobile ? 'text-xs' : ''}>{t('ro_choose_file')}</span>
                  </Button>
                </div>
                <div className={`flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer ${isMobile ? 'p-3' : 'p-4 md:p-6'}`} onClick={triggerFileInput}>
                  <div className="text-center">
                    <FileIcon className={`mx-auto text-muted-foreground/60 ${isMobile ? 'h-8 w-8' : 'h-12 w-12'}`} />
                    <p className={`mt-1.5 text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_click_upload')}</p>
                    <p className="text-[10px] text-muted-foreground/60">{t('ro_file_types')}</p>
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
        
        <div className={`${isMobile ? 'space-y-2.5' : 'space-y-4 md:space-y-6'} min-w-0`}>
          <div className="space-y-1">
            <label className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_select_tasks')}</label>
            <Card>
              <CardHeader className={isMobile ? 'p-2.5' : 'p-3 md:p-4'}>
                <CardTitle className={isMobile ? 'text-xs' : 'text-sm md:text-base'}>{t('ro_standard_tasks')}</CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'p-2.5' : 'p-3 md:p-4'} pt-0`}>
                {loadingTasks ? (
                  <div className="flex justify-center p-3 text-xs text-muted-foreground">{t('ro_loading_tasks')}</div>
                ) : (
                  <ScrollArea className={isMobile ? 'h-[150px]' : 'h-[200px]'}>
                    <div className="grid grid-cols-1 gap-1.5">
                      {standardTasks?.map((task: StandardTask) => (
                        <CheckboxCard
                          key={task.id}
                          id={task.id}
                          title={task.task_name}
                          description={`${t('ro_task_number')} ${task.task_number}`}
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
              <p className="text-xs text-destructive">{t('ro_select_task_required')}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <label className={`block font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{t('ro_assign_users')}</label>
            <Card>
              <CardHeader className={isMobile ? 'p-2.5' : 'p-3 md:p-4'}>
                <CardTitle className={isMobile ? 'text-xs' : 'text-sm md:text-base'}>{t('ro_team_members')}</CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'p-2.5' : 'p-3 md:p-4'} pt-0`}>
                {loadingEmployees ? (
                  <div className="flex justify-center p-3 text-xs text-muted-foreground">{t('ro_loading_users')}</div>
                ) : (
                  <ScrollArea className={isMobile ? 'h-[150px]' : 'h-[200px]'}>
                    <div className="grid grid-cols-1 gap-1.5">
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
              <p className="text-xs text-destructive">{t('ro_assign_user_required')}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className={`flex ${isMobile ? 'pt-1' : ''} justify-end`}>
        <Button type="submit" disabled={isSubmitting} size={isMobile ? 'sm' : 'default'} className={`bg-red-600 hover:bg-red-700 ${isMobile ? 'w-full' : ''}`}>
          {isSubmitting ? t('ro_creating') : t('ro_create_rush_order')}
        </Button>
      </div>
    </form>
  );
};

export default NewRushOrderForm;
