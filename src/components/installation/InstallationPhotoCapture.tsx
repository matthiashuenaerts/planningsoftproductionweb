import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { Camera, Upload, Trash2, Loader2 } from 'lucide-react';
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');

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
  }, [open, projectId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentEmployee) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `installation-photos/${projectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto' : 'max-w-lg max-h-[85vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Werf Foto's
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload section */}
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
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploaden...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Foto Maken / Selecteren</>
              )}
            </Button>
          </div>

          {/* Photo grid */}
          {loading ? (
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
