
import React, { useState } from 'react';
import { extractStoragePath } from '@/lib/storageUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  Share2, 
  CheckCircle, 
  Circle, 
  FileText, 
  ListTodo, 
  Paperclip, 
  Users,
  Calendar,
  Download,
  UserMinus
} from 'lucide-react';
import { format } from 'date-fns';
import { PersonalItem } from '@/pages/NotesAndTasks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ImageModal } from '@/components/ui/image-modal';

interface PersonalItemCardProps {
  item: PersonalItem;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onToggleComplete: () => void;
  refetch: () => void;
}

const PersonalItemCard: React.FC<PersonalItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onShare,
  onToggleComplete,
  refetch
}) => {
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  const isOwner = item.user_id === currentEmployee?.id;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return t('nt_high');
      case 'medium': return t('nt_medium');
      case 'low': return t('nt_low');
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('nt_active');
      case 'completed': return t('nt_completed');
      case 'archived': return t('nt_archived');
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  const getSignedImageUrl = async (filePath: string) => {
    const storagePath = extractStoragePath('personal-attachments', filePath);
    if (!storagePath) return '';
    const { data, error } = await supabase.storage
      .from('personal-attachments')
      .createSignedUrl(storagePath, 3600);
    if (error) {
      console.error('Error creating signed URL:', error);
      return '';
    }
    return data.signedUrl;
  };

  const handleImageClick = async (attachment: any) => {
    const imageUrl = await getSignedImageUrl(attachment.file_path);
    setSelectedImage({
      src: imageUrl,
      alt: attachment.file_name
    });
  };

  const handleDownloadAttachment = async (attachment: any) => {
    setIsDownloading(attachment.id);
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

      toast({
        title: t('success') || "Success",
        description: t('nt_file_downloaded'),
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t('error') || "Error",
        description: t('nt_download_failed'),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(null);
    }
  };

  const imageAttachments = item.attachments?.filter(att => isImageFile(att.file_name)) || [];

  return (
    <>
      <Card className="h-fit hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {item.type === 'note' ? (
                <FileText className="h-4 w-4 text-blue-600" />
              ) : (
                <ListTodo className="h-4 w-4 text-green-600" />
              )}
              <CardTitle className="text-sm font-medium truncate">
                {item.title}
              </CardTitle>
            </div>
            {item.type === 'task' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleComplete}
                className="p-1 h-6 w-6"
              >
                {item.status === 'completed' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Badge className={getPriorityColor(item.priority)}>
              {getPriorityLabel(item.priority)}
            </Badge>
            <Badge className={getStatusColor(item.status)}>
              {getStatusLabel(item.status)}
            </Badge>
            {item.is_shared && (
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {t('nt_shared')}
              </Badge>
            )}
            {!isOwner && (
              <Badge variant="secondary">
                {t('nt_shared_with_you')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {item.content && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
              {item.content}
            </p>
          )}

          {item.due_date && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <Calendar className="h-3 w-3" />
              <span>{t('nt_due')}: {format(new Date(item.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          {imageAttachments.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                <Paperclip className="h-3 w-3" />
                <span>{t('nt_images')} ({imageAttachments.length})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {imageAttachments.slice(0, 4).map((attachment) => (
                  <ImagePreview 
                    key={attachment.id}
                    attachment={attachment}
                    onClick={() => handleImageClick(attachment)}
                  />
                ))}
                {imageAttachments.length > 4 && (
                  <div className="bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 aspect-square">
                    {(t('nt_more') || '+{{count}} more').replace('{{count}}', String(imageAttachments.length - 4))}
                  </div>
                )}
              </div>
            </div>
          )}

          {item.attachments && item.attachments.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                <Paperclip className="h-3 w-3" />
                <span>{(t('nt_attachments_count') || '{{count}} attachment(s)').replace('{{count}}', String(item.attachments.length))}</span>
              </div>
              <div className="space-y-1">
                {item.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1">{attachment.file_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                      disabled={isDownloading === attachment.id}
                      className="p-1 h-6 w-6"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.shares && item.shares.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <Users className="h-3 w-3" />
                <span>{t('nt_shared_with')}</span>
              </div>
              <div className="text-xs text-gray-600">
                {item.shares.map(share => share.employee_name).join(', ')}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {format(new Date(item.updated_at), 'MMM d, HH:mm')}
            </span>
            
            <div className="flex gap-1">
              {(isOwner || item.shares?.some(share => 
                share.shared_with_user_id === currentEmployee?.id && share.can_edit
              )) && (
                <Button variant="ghost" size="sm" onClick={onEdit} className="p-1 h-6 w-6">
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              
              {isOwner && (
                <Button variant="ghost" size="sm" onClick={onShare} className="p-1 h-6 w-6">
                  <Share2 className="h-3 w-3" />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDelete} 
                className="p-1 h-6 w-6 text-red-600"
                title={isOwner ? t('nt_delete_permanently') : t('nt_remove_shared')}
              >
                {isOwner ? (
                  <Trash2 className="h-3 w-3" />
                ) : (
                  <UserMinus className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedImage && (
        <ImageModal
          src={selectedImage.src}
          alt={selectedImage.alt}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
};

// Separate component for image preview
const ImagePreview: React.FC<{
  attachment: any;
  onClick: () => void;
}> = ({ attachment, onClick }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadImage = async () => {
      try {
        const storagePath = extractStoragePath('personal-attachments', attachment.file_path);
        if (!storagePath) { setLoading(false); return; }
        const { data, error } = await supabase.storage
          .from('personal-attachments')
          .createSignedUrl(storagePath, 3600);
        if (error) throw error;
        setImageUrl(data.signedUrl);
      } catch (error) {
        console.error('Error loading image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [attachment.file_path]);

  if (loading) {
    return (
      <div className="bg-gray-100 rounded aspect-square animate-pulse"></div>
    );
  }

  return (
    <div 
      className="relative cursor-pointer group"
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={attachment.file_name}
        className="w-full aspect-square object-cover rounded group-hover:opacity-80 transition-opacity"
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded"></div>
    </div>
  );
};

export default PersonalItemCard;
