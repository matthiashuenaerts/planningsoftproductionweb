import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, ExternalLink, Layers } from 'lucide-react';
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
  price_per_unit?: number | null;
  isGroup?: boolean;
  groupProducts?: Array<{ product: Product; quantity: number }>;
}

interface ProductGroup {
  id: string;
  name: string;
  description: string | null;
  article_code: string | null;
  image_path: string | null;
  total_price?: number;
  items_count?: number;
  products?: Array<{ product: Product; quantity: number }>;
}

interface ProductSelectorProps {
  onProductSelect: (product: Product) => void;
  onGroupSelect?: (group: ProductGroup, products: Array<{ product: Product; quantity: number }>) => void;
  buttonVariant?: 'default' | 'outline' | 'ghost';
  buttonText?: string;
  showGroups?: boolean;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  onProductSelect,
  onGroupSelect,
  buttonVariant = 'outline',
  buttonText = 'Select from Products',
  showGroups = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ProductGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      if (showGroups) {
        fetchProductGroups();
      }
    }
  }, [isOpen, showGroups]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.article_code && product.article_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.supplier && product.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProducts(filtered);

      const filteredG = productGroups.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.article_code && group.article_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredGroups(filteredG);
    } else {
      setFilteredProducts(products);
      setFilteredGroups(productGroups);
    }
  }, [searchTerm, products, productGroups]);

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

  const fetchProductGroups = async () => {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('product_groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;

      const { data: items, error: itemsError } = await supabase
        .from('product_group_items')
        .select('group_id, quantity, product_id');

      if (itemsError) throw itemsError;

      const { data: allProducts } = await supabase
        .from('products')
        .select('*');

      const productMap = new Map((allProducts || []).map(p => [p.id, p]));

      const groupsWithDetails = (groups || []).map(group => {
        const groupItems = items?.filter(i => i.group_id === group.id) || [];
        const productsInGroup = groupItems.map(item => ({
          product: productMap.get(item.product_id) as Product,
          quantity: item.quantity
        })).filter(item => item.product);

        const totalPrice = productsInGroup.reduce((sum, item) => {
          return sum + (item.product.price_per_unit || 0) * item.quantity;
        }, 0);

        return {
          ...group,
          total_price: totalPrice,
          items_count: groupItems.length,
          products: productsInGroup
        };
      });

      setProductGroups(groupsWithDetails);
      setFilteredGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error fetching product groups:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleGroupSelect = (group: ProductGroup) => {
    if (onGroupSelect && group.products) {
      onGroupSelect(group, group.products);
    }
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
          ) : showGroups ? (
            <Tabs defaultValue="products">
              <TabsList>
                <TabsTrigger value="products">
                  <Package className="mr-2 h-4 w-4" />
                  Individual Products ({filteredProducts.length})
                </TabsTrigger>
                <TabsTrigger value="groups">
                  <Layers className="mr-2 h-4 w-4" />
                  Group Products ({filteredGroups.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Article Code</TableHead>
                      <TableHead>Supplier</TableHead>
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
                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No products found matching your search.' : 'No products available.'}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Article Code</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Total Price</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          {group.image_path ? (
                            <img
                              src={getImageUrl(group.image_path) || ''}
                              alt={group.name}
                              className="h-10 w-10 object-cover rounded"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group.name}</div>
                            {group.products && group.products.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {group.products.slice(0, 3).map(p => 
                                  `${p.product.name} (×${p.quantity})`
                                ).join(', ')}
                                {group.products.length > 3 && '...'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {group.article_code && (
                            <Badge variant="outline">{group.article_code}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{group.items_count || 0} products</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          €{(group.total_price || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleGroupSelect(group)}
                            disabled={!onGroupSelect}
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredGroups.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No group products found matching your search.' : 'No group products available.'}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Article Code</TableHead>
                    <TableHead>Supplier</TableHead>
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
              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No products found matching your search.' : 'No products available.'}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelector;
