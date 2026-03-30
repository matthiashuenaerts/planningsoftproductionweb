import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { Camera, Upload, Trash2, Loader2, RotateCcw, X, Check, SwitchCamera } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface InstallationPhotoCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

interface Photo {
  id: string;
  file_path: string;
  caption: string | null;
  created_at: string;
}

const InstallationPhotoCapture: React.FC<InstallationPhotoCaptureProps> = ({
  open, onOpenChange, projectId, projectName
}) => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  const [cameraMode, setCameraMode] = useState<'none' | 'camera' | 'preview'>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const YARD_FOLDER = `yard-photos/${projectId}`;

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('installation_photos' as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setPhotos((data as any) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadPhotos();
    return () => stopCamera();
  }, [open, projectId]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      setCameraMode('camera');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      toast({ title: 'Camera niet beschikbaar', description: 'Gebruik de bestandsselectie.', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraMode('none');
    setCapturedImage(null);
  };

  const switchCamera = async () => {
    stopCamera();
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    setTimeout(() => startCamera(), 200);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    setCameraMode('preview');
  };

  const uploadCapturedPhoto = async () => {
    if (!capturedImage || !currentEmployee) return;
    setUploading(true);
    try {
      const blob = await (await fetch(capturedImage)).blob();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const path = `${YARD_FOLDER}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project_files')
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      await supabase.from('installation_photos' as any).insert({
        project_id: projectId,
        uploaded_by: currentEmployee.id,
        file_path: path,
        caption: caption || null,
      });

      // Also create a project file reference in the yard-photos folder
      try {
        await supabase.from('project_files' as any).insert({
          project_id: projectId,
          file_name: fileName,
          file_path: path,
          file_type: 'image/jpeg',
          file_size: blob.size,
          folder: 'Werf Foto\'s',
          uploaded_by: currentEmployee.id,
        });
      } catch { /* ignore */ }

      toast({ title: 'Foto opgeslagen', description: 'De foto is opgeslagen in de werf map.' });
      setCaption('');
      setCapturedImage(null);
      setCameraMode('none');
      stopCamera();
      loadPhotos();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentEmployee) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `${YARD_FOLDER}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project_files')
          .upload(path, file);

        if (uploadError) throw uploadError;

        await supabase.from('installation_photos' as any).insert({
          project_id: projectId,
          uploaded_by: currentEmployee.id,
          file_path: path,
          caption: caption || null,
        });

        // Also register in project files
        try {
          await supabase.from('project_files' as any).insert({
            project_id: projectId,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
            folder: 'Werf Foto\'s',
            uploaded_by: currentEmployee.id,
          });
        } catch { /* ignore */ }
      }
      toast({ title: 'Foto\'s geüpload', description: `${files.length} foto(\'s) opgeslagen.` });
      setCaption('');
      loadPhotos();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: Photo) => {
    try {
      await supabase.storage.from('project_files').remove([photo.file_path]);
      await supabase.from('installation_photos' as any).delete().eq('id', photo.id);
      loadPhotos();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
      <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto p-4' : 'max-w-lg max-h-[85vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Werf Foto's
          </DialogTitle>
        </DialogHeader>

        <canvas ref={canvasRef} className="hidden" />

        <div className="space-y-4">
          {/* Camera view */}
          {cameraMode === 'camera' && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full" onClick={switchCamera}>
                  <SwitchCamera className="h-5 w-5" />
                </Button>
                <Button size="icon" className="h-14 w-14 rounded-full bg-white text-black hover:bg-gray-200" onClick={capturePhoto}>
                  <Camera className="h-6 w-6" />
                </Button>
                <Button size="icon" variant="destructive" className="h-10 w-10 rounded-full" onClick={stopCamera}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview captured image */}
          {cameraMode === 'preview' && capturedImage && (
            <div className="relative rounded-lg overflow-hidden">
              <img src={capturedImage} alt="Preview" className="w-full aspect-[4/3] object-cover" />
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full" onClick={() => { setCapturedImage(null); setCameraMode('camera'); }}>
                  <RotateCcw className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={uploadCapturedPhoto}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
                </Button>
              </div>
            </div>
          )}

          {/* Upload section (when camera not active) */}
          {cameraMode === 'none' && (
            <div className="space-y-2">
              <Input
                placeholder="Bijschrift (optioneel)"
                value={caption}
                onChange={e => setCaption(e.target.value)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  onClick={startCamera}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4 mr-2" /> Camera
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploaden...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Selecteren</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          {cameraMode === 'none' && (
            loading ? (
              <div className="py-8 text-center text-muted-foreground">Laden...</div>
            ) : photos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nog geen foto's voor dit project
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map(photo => (
                  <PhotoThumbnail key={photo.id} photo={photo} onDelete={handleDelete} />
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PhotoThumbnail: React.FC<{ photo: Photo; onDelete: (p: Photo) => void }> = ({ photo, onDelete }) => {
  const signedUrl = useSignedUrl('project_files', photo.file_path);

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border">
      {signedUrl ? (
        <img src={signedUrl} alt={photo.caption || 'Werf foto'} className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-32 bg-muted flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {photo.caption && (
        <p className="text-xs p-1.5 truncate text-muted-foreground">{photo.caption}</p>
      )}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(photo)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default InstallationPhotoCapture;
