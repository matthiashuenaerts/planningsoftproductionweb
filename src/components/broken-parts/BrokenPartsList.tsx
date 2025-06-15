import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Plus, AlertTriangle, X, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from '@/context/LanguageContext';

const BrokenPartsList: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const { t, createLocalizedPath } = useLanguage();

  const { data: brokenParts = [], isLoading, error } = useQuery({
    queryKey: ['broken-parts'],
    queryFn: async () => {
      return brokenPartsService.getAll();
    }
  });

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from('broken_parts').getPublicUrl(path);
    return data.publicUrl;
  };

  const openImageDialog = (imagePath: string) => {
    if (!imagePath) return;
    setSelectedImage(getImageUrl(imagePath));
  };

  const handleImageError = (id: string) => {
    setImageError(prev => ({ ...prev, [id]: true }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <p>Loading broken parts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center text-red-500">
            <p>Failed to load broken parts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('broken_parts')}
          </CardTitle>
          <Button asChild>
            <Link to={createLocalizedPath("/broken-parts/new")}>
              <Plus className="mr-2 h-4 w-4" />
              {t('report_broken_part')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {brokenParts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Workstation</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokenParts.map((part: any) => (
                    <TableRow key={part.id}>
                      <TableCell>
                        {part.image_path ? (
                          <div className="relative">
                            <div 
                              className="w-20 h-20 relative overflow-hidden rounded-md cursor-pointer"
                              onClick={() => openImageDialog(part.image_path)}
                            >
                              <AspectRatio ratio={1/1}>
                                {imageError[part.id] ? (
                                  <div className="flex items-center justify-center w-full h-full bg-gray-100">
                                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                                  </div>
                                ) : (
                                  <img
                                    src={getImageUrl(part.image_path)}
                                    alt="Broken part"
                                    className="object-cover w-full h-full"
                                    onError={() => handleImageError(part.id)}
                                  />
                                )}
                              </AspectRatio>
                              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all">
                                <Eye className="h-6 w-6 text-white opacity-0 hover:opacity-100" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded-md text-gray-400">
                            No image
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{part.projects?.name || "Not specified"}</TableCell>
                      <TableCell>{part.workstations?.name || "Not specified"}</TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate">{part.description}</div>
                      </TableCell>
                      <TableCell>{part.employees?.name}</TableCell>
                      <TableCell>
                        {part.created_at && format(new Date(part.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No broken parts reported</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new broken part report.
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

      {/* Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Broken Part Image</DialogTitle>
            <DialogClose className="absolute right-4 top-4">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          {selectedImage && (
            <div className="overflow-hidden">
              <img 
                src={selectedImage} 
                alt="Broken part full view" 
                className="w-full object-contain max-h-[80vh]"
                onError={() => {
                  console.error("Failed to load image in dialog");
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BrokenPartsList;
