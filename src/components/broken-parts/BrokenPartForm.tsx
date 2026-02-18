import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Check, X, RotateCcw, Image } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { useLanguage } from '@/context/LanguageContext';

const BrokenPartForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { currentEmployee } = useAuth();
  const { createLocalizedPath } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraMode, setCameraMode] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
        title: "Error",
        description: "You must be logged in to report a broken part",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Upload image if selected
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

      // Insert broken part record
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
        title: "Success",
        description: "Broken part reported successfully",
      });
      
      navigate(createLocalizedPath('/broken-parts'));
    } catch (error) {
      console.error('Error reporting broken part:', error);
      toast({
        title: "Error",
        description: "Failed to report broken part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cameraMode === 'camera') {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    );
  }

  if (cameraMode === 'preview' && capturedImage) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Photo Preview</h3>
            </div>
            
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured broken part"
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => setFormData({...formData, project_id: value})}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workstation">Workstation</Label>
            <Select
              value={formData.workstation_id}
              onValueChange={(value) => setFormData({...formData, workstation_id: value})}
            >
              <SelectTrigger id="workstation">
                <SelectValue placeholder="Select a workstation" />
              </SelectTrigger>
              <SelectContent>
                {workstations.map((workstation: any) => (
                  <SelectItem key={workstation.id} value={workstation.id}>
                    {workstation.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the broken part"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
              className="min-h-32"
            />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
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
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Image className="h-4 w-4" />
                Choose File
              </Button>
              {(imagePreview || selectedImage) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearImage}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear
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
                  alt="Preview"
                  className="max-h-40 rounded-md"
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Report Broken Part"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrokenPartForm;
