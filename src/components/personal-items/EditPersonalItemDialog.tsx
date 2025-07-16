import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CalendarIcon, Camera, Paperclip, X, Download, Trash2, RotateCcw, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PersonalItem } from '@/pages/NotesAndTasks';

interface EditPersonalItemDialogProps {
  item: PersonalItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EditPersonalItemDialog: React.FC<EditPersonalItemDialogProps> = ({
  item,
  open,
  onOpenChange,
  onSuccess
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    title: item.title,
    content: item.content || '',
    type: item.type,
    priority: item.priority,
    status: item.status,
    due_date: item.due_date ? new Date(item.due_date) : null,
  });
  
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState(item.attachments || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Camera states
  const [cameraStep, setCameraStep] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    if (open) {
      setFormData({
        title: item.title,
        content: item.content || '',
        type: item.type,
        priority: item.priority,
        status: item.status,
        due_date: item.due_date ? new Date(item.due_date) : null,
      });
      setExistingAttachments(item.attachments || []);
      setNewAttachments([]);
      setCapturedImages([]);
      setCameraStep('none');
    }
  }, [item, open]);

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
      setCameraStep('camera');
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
    setCapturedImages(prev => [...prev, imageDataUrl]);
    stopCamera();
    setCameraStep('preview');
  };

  const addAnotherPhoto = () => {
    startCamera();
  };

  const removeImage = (index: number) => {
    const newImages = capturedImages.filter((_, i) => i !== index);
    setCapturedImages(newImages);
    if (newImages.length === 0) {
      setCameraStep('none');
    }
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const confirmPhotos = async () => {
    // Convert captured images to File objects and add to new attachments
    for (const [index, imageDataUrl] of capturedImages.entries()) {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `camera-photo-${Date.now()}-${index}.jpg`, {
        type: 'image/jpeg'
      });
      setNewAttachments(prev => [...prev, file]);
    }
    
    setCapturedImages([]);
    setCameraStep('none');
    
    toast({
      title: "Success",
      description: `${capturedImages.length} photo(s) added to attachments`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Update the personal item
      const { error: itemError } = await supabase
        .from('personal_items')
        .update({
          title: formData.title,
          content: formData.content || null,
          type: formData.type,
          priority: formData.priority,
          status: formData.status,
          due_date: formData.due_date ? formData.due_date.toISOString() : null,
        })
        .eq('id', item.id);

      if (itemError) throw itemError;

      // Upload new attachments if any
      if (newAttachments.length > 0) {
        for (const file of newAttachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${item.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('personal-attachments')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Save attachment record
          const { error: attachmentError } = await supabase
            .from('personal_item_attachments')
            .insert({
              personal_item_id: item.id,
              file_name: file.name,
              file_path: fileName,
              file_type: file.type,
              file_size: file.size,
            });

          if (attachmentError) throw attachmentError;
        }
      }

      toast({
        title: "Success",
        description: `${formData.type === 'note' ? 'Note' : 'Task'} updated successfully`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewAttachments(prev => [...prev, ...files]);
  };

  const removeNewAttachment = (index: number) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const deleteExistingAttachment = async (attachmentId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('personal-attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('personal_item_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
      
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({
        title: "Error",
        description: "Failed to delete attachment",
        variant: "destructive",
      });
    }
  };

  const downloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('personal-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImages([]);
    setCameraStep('none');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cameraStep === 'camera' ? 'Take Photo' : 
             cameraStep === 'preview' ? 'Preview Photos' :
             `Edit ${formData.type === 'note' ? 'Note' : 'Task'}`}
          </DialogTitle>
        </DialogHeader>

        {cameraStep === 'camera' && (
          <div className="space-y-4">
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
                  onClick={() => {
                    stopCamera();
                    setCameraStep('none');
                  }}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {cameraStep === 'preview' && capturedImages.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2 bg-gray-100 rounded-lg">
              {capturedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Captured photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg aspect-square"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {capturedImages.length} photo(s) captured. Add more or confirm to add to attachments.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={addAnotherPhoto}>
                <Camera className="h-4 w-4 mr-2" />
                Add Photo
              </Button>
              <Button onClick={confirmPhotos} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" />
                Confirm Photos
              </Button>
            </div>
          </div>
        )}

        {cameraStep === 'none' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value: 'note' | 'task') => setFormData(prev => ({ ...prev, type: value }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="note" id="note" />
                  <Label htmlFor="note">Note</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="task" id="task" />
                  <Label htmlFor="task">Task</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'completed' | 'archived') => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'task' && (
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-2">
              <Label>Attachments</Label>
              
              {/* Existing attachments */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current attachments:</Label>
                  {existingAttachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm truncate">{attachment.file_name}</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAttachment(attachment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExistingAttachment(attachment.id, attachment.file_path)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Add File
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCamera}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="*/*"
              />

              {/* New attachments */}
              {newAttachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">New attachments:</Label>
                  {newAttachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNewAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditPersonalItemDialog;
