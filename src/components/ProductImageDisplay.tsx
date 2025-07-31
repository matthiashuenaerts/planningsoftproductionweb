import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { ImageModal } from '@/components/ui/image-modal';
import { supabase } from '@/integrations/supabase/client';

interface ProductImageDisplayProps {
  articleCode: string;
}

interface Product {
  id: string;
  name: string;
  image_path: string | null;
  website_link: string | null;
}

export const ProductImageDisplay: React.FC<ProductImageDisplayProps> = ({ articleCode }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!articleCode) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('id, name, image_path, website_link')
          .eq('article_code', articleCode)
          .maybeSingle();

        if (error) throw error;
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [articleCode]);

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(imagePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <ImageIcon className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (!product || !product.image_path) {
    return null;
  }

  const imageUrl = getImageUrl(product.image_path);
  if (!imageUrl) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsImageModalOpen(true)}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        View Image
      </Button>
      <ImageModal
        open={isImageModalOpen}
        onOpenChange={setIsImageModalOpen}
        imageUrl={imageUrl}
        title={product.name}
        websiteLink={product.website_link}
      />
    </>
  );
};