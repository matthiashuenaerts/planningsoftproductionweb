
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brokenPartsService } from '@/services/brokenPartsService';
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, X, Eye, MoreVertical, Trash, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useLanguage } from '@/context/LanguageContext';
import { BrokenPartDetailDialog } from './BrokenPartDetailDialog';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import SignedStorageImage from '@/components/SignedStorageImage';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 20;

const BrokenPartsList: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBrokenPart, setSelectedBrokenPart] = useState<any | null>(null);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { t, createLocalizedPath } = useLanguage();
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const isAdmin = currentEmployee?.role === 'admin';

  const { data: brokenParts = [], isLoading, error } = useQuery({
    queryKey: ['broken-parts', tenant?.id],
    queryFn: async () => {
      return brokenPartsService.getAll(tenant?.id);
    }
  });

  const visibleParts = brokenParts.slice(0, visibleCount);
  const hasMore = visibleCount < brokenParts.length;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, brokenParts.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, brokenParts.length]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tenant?.id]);

  // Use signed URLs for private bucket access
  const getSignedImageUrl = async (path: string): Promise<string | null> => {
    if (!path) return null;
    const { createSignedUrl } = await import('@/lib/storageUtils');
    return await createSignedUrl('broken_parts', path);
  };

  const openImageDialog = async (imagePath: string) => {
    if (!imagePath) return;
    const signedUrl = await getSignedImageUrl(imagePath);
    setSelectedImage(signedUrl);
  };

  const handleImageError = (id: string) => {
    setImageError(prev => ({ ...prev, [id]: true }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(t('confirm_delete_broken_part') || 'Are you sure you want to delete this broken part?')) {
      return;
    }

    try {
      await brokenPartsService.delete(id);
      queryClient.invalidateQueries({ queryKey: ['broken-parts'] });
      toast({
        title: t('success') || 'Success',
        description: t('broken_part_deleted') || 'Broken part deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting broken part:', error);
      toast({
        title: t('error') || 'Error',
        description: t('failed_to_delete') || 'Failed to delete broken part',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center text-destructive">
            <p>{t('failed_to_load') || 'Failed to load broken parts'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderMobileCard = (part: any) => (
    <Card
      key={part.id}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedBrokenPart(part)}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            {part.image_path && !imageError[part.id] ? (
              <div
                className="w-16 h-16 rounded-md overflow-hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  openImageDialog(part.image_path);
                }}
              >
                <SignedStorageImage
                  bucket="broken_parts"
                  path={part.image_path}
                  alt={t('broken_parts') || 'Broken part'}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {part.projects?.name || t('not_specified') || 'Not specified'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {part.workstations?.name || t('not_specified') || 'Not specified'}
            </p>
            <p className="text-sm text-foreground mt-1 line-clamp-2">{part.description}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">{part.employees?.name}</span>
              <span className="text-xs text-muted-foreground">
                {part.created_at && format(new Date(part.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          {/* Admin action */}
          {isAdmin && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => handleDelete(part.id, e)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    {t('delete') || 'Delete'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
       <Card className="w-full overflow-hidden">
        <CardHeader className={`flex flex-row items-center justify-between ${isMobile ? 'px-3 py-3' : ''}`}>
          <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            {t('broken_parts')}
          </CardTitle>
          <Button asChild size="sm" className={isMobile ? 'text-xs' : ''}>
            <Link to={createLocalizedPath("/broken-parts/new")}>
              <Plus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {t('report_broken_part')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className={isMobile ? 'px-3' : ''}>
          {brokenParts.length > 0 ? (
            <>
              {isMobile ? (
                <div className="space-y-3">
                  {visibleParts.map(renderMobileCard)}
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                        <TableHead className="w-[90px]">{t('image') || 'Image'}</TableHead>
                        <TableHead className="w-[20%]">{t('project') || 'Project'}</TableHead>
                        <TableHead className="w-[15%]">{t('workstation') || 'Workstation'}</TableHead>
                        <TableHead className="w-[30%]">{t('description') || 'Description'}</TableHead>
                        <TableHead className="w-[15%]">{t('reported_by') || 'Reported By'}</TableHead>
                        <TableHead className="w-[120px]">{t('date') || 'Date'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleParts.map((part: any) => (
                        <TableRow 
                          key={part.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedBrokenPart(part)}
                        >
                          {isAdmin && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={(e) => handleDelete(part.id, e)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    {t('delete') || 'Delete'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                          <TableCell>
                            {part.image_path ? (
                              <div
                                className="w-16 h-16 relative overflow-hidden rounded-md cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageDialog(part.image_path);
                                }}
                              >
                                <AspectRatio ratio={1}>
                                  {imageError[part.id] ? (
                                    <div className="flex items-center justify-center w-full h-full bg-muted">
                                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                                    </div>
                                  ) : (
                                    <SignedStorageImage
                                      bucket="broken_parts"
                                      path={part.image_path}
                                      alt={t('broken_parts') || 'Broken part'}
                                      className="object-cover w-full h-full"
                                    />
                                  )}
                                </AspectRatio>
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center transition-all">
                                  <Eye className="h-5 w-5 text-white opacity-0 hover:opacity-100" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-md text-muted-foreground text-xs">
                                —
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="truncate">{part.projects?.name || t('not_specified') || 'Not specified'}</TableCell>
                          <TableCell className="truncate">{part.workstations?.name || t('not_specified') || 'Not specified'}</TableCell>
                          <TableCell>
                            <div className="truncate">{part.description}</div>
                          </TableCell>
                          <TableCell className="truncate">{part.employees?.name}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {part.created_at && format(new Date(part.created_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {visibleCount} / {brokenParts.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-2 text-sm font-medium text-foreground">{t('no_broken_parts') || 'No broken parts reported'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('get_started_broken_parts') || 'Get started by creating a new broken part report.'}
              </p>
              <div className="mt-6">
                <Button asChild>
                  <Link to={createLocalizedPath("/broken-parts/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('report_broken_part')}
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl w-[95vw] p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">{t('broken_part_image') || 'Broken Part Image'}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="overflow-hidden rounded-md">
              <img 
                src={selectedImage} 
                alt={t('broken_parts') || 'Broken part full view'}
                className="w-full object-contain max-h-[75vh]"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BrokenPartDetailDialog
        open={!!selectedBrokenPart}
        onOpenChange={(open) => !open && setSelectedBrokenPart(null)}
        brokenPart={selectedBrokenPart}
      />
    </>
  );
};

export default BrokenPartsList;
