import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { Camera, Upload, Trash2, Loader2, X, SwitchCamera } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';

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
  const { t } = useLanguage();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [captureCount, setCaptureCount] = useState(0);

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
      setCameraActive(true);
      setCaptureCount(0);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      toast({ title: t('inst_camera_not_available'), description: t('inst_camera_not_available_desc'), variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraActive(false);
    setCaptureCount(0);
  };

  const switchCamera = async () => {
    stopCamera();
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    setTimeout(() => startCamera(), 200);
  };

  const drawTimestamp = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const now = new Date();
    const timestamp = format(now, 'dd/MM/yyyy HH:mm');
    const fontSize = Math.max(20, Math.floor(height / 30));
    ctx.font = `bold ${fontSize}px Arial`;
    const textWidth = ctx.measureText(timestamp).width;
    const padding = 12;
    const x = width - textWidth - padding * 2;
    const y = height - padding * 2;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - padding, y - fontSize - padding / 2, textWidth + padding * 2, fontSize + padding);

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timestamp, x, y);
  };

  const captureAndSave = async () => {
    if (!videoRef.current || !canvasRef.current || !currentEmployee) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    drawTimestamp(ctx, canvas.width, canvas.height);

    setUploading(true);
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      });
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

      setCaptureCount(c => c + 1);
      toast({ title: t('inst_photo_saved'), description: t('inst_photo_saved_desc') });
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
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
      toast({ title: t('inst_photos_uploaded'), description: `${files.length} foto(s)` });
      setCaption('');
      loadPhotos();
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!photoToDelete) return;
    try {
      await supabase.storage.from('project_files').remove([photoToDelete.file_path]);
      await supabase.from('installation_photos' as any).delete().eq('id', photoToDelete.id);
      // Also remove from project_files table
      try {
        await supabase.from('project_files' as any).delete().eq('file_path', photoToDelete.file_path);
      } catch { /* ignore */ }
      toast({ title: t('inst_photo_deleted') });
      setPhotoToDelete(null);
      loadPhotos();
    } catch (err: any) {
      toast({ title: t('inst_error'), description: err.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) stopCamera(); onOpenChange(o); }}>
        <DialogContent className={isMobile ? 'max-w-[100vw] h-[100dvh] p-0 m-0 rounded-none' : 'max-w-2xl max-h-[90vh] overflow-y-auto'}>
          <DialogHeader className={isMobile ? 'p-4 pb-2' : ''}>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" /> {t('inst_yard_photos')}
            </DialogTitle>
          </DialogHeader>

          <canvas ref={canvasRef} className="hidden" />

          <div className={`space-y-4 ${isMobile ? 'px-4 pb-4 overflow-y-auto' : ''}`}>
            {/* Camera view - large and prominent */}
            {cameraActive && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full ${isMobile ? 'h-[60dvh]' : 'h-[50vh]'} object-cover`}
                />
                {captureCount > 0 && (
                  <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold">
                    {captureCount}
                  </div>
                )}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <Button size="icon" variant="secondary" className="h-12 w-12 rounded-full" onClick={switchCamera}>
                    <SwitchCamera className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-16 w-16 rounded-full bg-white text-black hover:bg-gray-200 border-4 border-white/50"
                    onClick={captureAndSave}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-12 w-12 rounded-full"
                    onClick={() => { stopCamera(); loadPhotos(); }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Upload section */}
            {!cameraActive && (
              <div className="space-y-2">
                <Input
                  placeholder={t('inst_caption_optional')}
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
                  <Button variant="default" onClick={startCamera} disabled={uploading}>
                    <Camera className="h-4 w-4 mr-2" /> {t('inst_camera')}
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('inst_uploading')}</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> {t('inst_select_files')}</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Photo grid */}
            {!cameraActive && (
              loading ? (
                <div className="py-8 text-center text-muted-foreground">{t('inst_loading')}</div>
              ) : photos.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('inst_no_photos')}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photos.map(photo => (
                    <PhotoThumbnail key={photo.id} photo={photo} onDelete={setPhotoToDelete} />
                  ))}
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!photoToDelete} onOpenChange={(o) => { if (!o) setPhotoToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inst_delete_photo')}</AlertDialogTitle>
            <AlertDialogDescription>{t('inst_delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
      <p className="text-[10px] px-1.5 pb-1 text-muted-foreground/60">
        {format(new Date(photo.created_at), 'dd/MM/yyyy HH:mm')}
      </p>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(photo)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default InstallationPhotoCapture;
