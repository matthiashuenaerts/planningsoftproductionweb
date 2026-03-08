import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Check, X, RotateCcw, Image, ChevronsUpDown } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

const BrokenPartForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { currentEmployee } = useAuth();
  const { t, createLocalizedPath } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraMode, setCameraMode] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [workstationOpen, setWorkstationOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    project_id: '',
    workstation_id: '',
    description: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch workstations
  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations', tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('workstations')
        .select('id, name')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

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
        title: t('bp_camera_error'),
        description: t('bp_camera_error_msg'),
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
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `broken-part-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        setSelectedImage(file);
        setImagePreview(imageDataUrl);
      }
    }, 'image/jpeg', 0.8);
    
    stopCamera();
    setCameraMode('preview');
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setSelectedImage(null);
    setImagePreview(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setCapturedImage(null);
      setCameraMode('none');
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCapturedImage(null);
    setCameraMode('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee) {
      toast({
        title: t('bp_error'),
        description: t('bp_must_login'),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      let imagePath = null;
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${currentEmployee.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('broken_parts')
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;
        imagePath = filePath;
      }

      const { error } = await supabase
        .from('broken_parts')
        .insert({
          project_id: formData.project_id || null,
          workstation_id: formData.workstation_id || null,
          description: formData.description,
          image_path: imagePath,
          reported_by: currentEmployee.id
        });

      if (error) throw error;

      toast({
        title: t('bp_success'),
        description: t('bp_success_msg'),
      });
      
      navigate(createLocalizedPath('/broken-parts'));
    } catch (error) {
      console.error('Error reporting broken part:', error);
      toast({
        title: t('bp_error'),
        description: t('bp_error_msg'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cameraMode === 'camera') {
    return (
      <Card className="w-full">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-medium">{t('bp_take_photo')}</h3>
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
                  className="bg-white text-black hover:bg-muted rounded-full w-14 h-14 sm:w-16 sm:h-16"
                >
                  <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
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
        </CardContent>
      </Card>
    );
  }

  if (cameraMode === 'preview' && capturedImage) {
    return (
      <Card className="w-full">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-medium">{t('bp_photo_preview')}</h3>
            </div>
            
            <div className="relative">
              <img
                src={capturedImage}
                alt={t('bp_photo_preview')}
                className="w-full rounded-lg max-h-96 object-contain bg-muted"
              />
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('bp_photo_captured_msg')}
            </p>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={retakePhoto} className="text-xs sm:text-sm">
                {t('bp_retake_photo')}
              </Button>
              <Button onClick={confirmPhoto} size="sm" className="flex items-center gap-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('bp_use_photo')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedProject = projects.find((p: any) => p.id === formData.project_id);
  const selectedWorkstation = workstations.find((w: any) => w.id === formData.workstation_id);

  return (
    <Card className="w-full">
      <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Project - Searchable */}
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">{t('bp_project')}</Label>
            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectOpen}
                  className="w-full justify-between text-sm font-normal h-9 sm:h-10"
                >
                  <span className="truncate">
                    {selectedProject ? selectedProject.name : t('bp_select_project')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('bp_search_placeholder')} className="text-sm" />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty className="text-xs py-4 text-center">{t('bp_no_results')}</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project: any) => (
                        <CommandItem
                          key={project.id}
                          value={project.name}
                          onSelect={() => {
                            setFormData({ ...formData, project_id: project.id });
                            setProjectOpen(false);
                          }}
                          className="text-sm"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              formData.project_id === project.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{project.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Workstation - Searchable */}
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">{t('bp_workstation')}</Label>
            <Popover open={workstationOpen} onOpenChange={setWorkstationOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={workstationOpen}
                  className="w-full justify-between text-sm font-normal h-9 sm:h-10"
                >
                  <span className="truncate">
                    {selectedWorkstation ? selectedWorkstation.name : t('bp_select_workstation')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('bp_search_placeholder')} className="text-sm" />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty className="text-xs py-4 text-center">{t('bp_no_results')}</CommandEmpty>
                    <CommandGroup>
                      {workstations.map((ws: any) => (
                        <CommandItem
                          key={ws.id}
                          value={ws.name}
                          onSelect={() => {
                            setFormData({ ...formData, workstation_id: ws.id });
                            setWorkstationOpen(false);
                          }}
                          className="text-sm"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              formData.workstation_id === ws.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{ws.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs sm:text-sm">{t('bp_description')}</Label>
            <Textarea
              id="description"
              placeholder={t('bp_describe_broken')}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
              className="min-h-24 sm:min-h-32 text-sm"
            />
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">{t('bp_image')}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="flex items-center gap-1.5 text-xs sm:text-sm"
              >
                <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('bp_take_photo')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs sm:text-sm"
              >
                <Image className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t('bp_choose_file')}
              </Button>
              {(imagePreview || selectedImage) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearImage}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t('bp_clear_image')}
                </Button>
              )}
            </div>
            
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt={t('bp_photo_preview')}
                  className="max-h-40 rounded-md"
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full text-sm" size="sm" disabled={isSubmitting}>
            {isSubmitting ? t('bp_submitting') : t('bp_submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrokenPartForm;
