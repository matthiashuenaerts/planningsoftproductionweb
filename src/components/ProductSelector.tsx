import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Package, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  article_code: string | null;
  supplier: string | null;
  standard_order_quantity: number | null;
  website_link: string | null;
  image_path: string | null;
  barcode: string | null;
  qr_code: string | null;
  location: string | null;
}

interface ProductSelectorProps {
  onProductSelect: (product: Product) => void;
  buttonVariant?: 'default' | 'outline' | 'ghost';
  buttonText?: string;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  onProductSelect,
  buttonVariant = 'outline',
  buttonText = 'Select from Products'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.article_code && product.article_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.supplier && product.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(imagePath);
    return data.publicUrl;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} type="button">
          <Package className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, code, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Article Code</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Std Qty</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_path ? (
                        <img
                          src={getImageUrl(product.image_path) || ''}
                          alt={product.name}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground">
                            {product.description.length > 50 
                              ? `${product.description.substring(0, 50)}...` 
                              : product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.article_code && (
                        <Badge variant="outline">{product.article_code}</Badge>
                      )}
                    </TableCell>
                     <TableCell>{product.supplier}</TableCell>
                     <TableCell>{product.location}</TableCell>
                     <TableCell>{product.standard_order_quantity}</TableCell>
                    <TableCell>
                      {product.website_link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(product.website_link!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleProductSelect(product)}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No products found matching your search.' : 'No products available.'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelector;