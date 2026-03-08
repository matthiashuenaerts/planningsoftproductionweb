import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, ExternalLink, Layers, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SignedStorageImage from '@/components/SignedStorageImage';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Search products via API with debounce
  const searchProducts = useCallback(async (term: string) => {
    if (!term.trim()) {
      setProducts([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${term}%,article_code.ilike.%${term}%,supplier.ilike.%${term}%,description.ilike.%${term}%`)
        .order('name')
        .limit(100);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Search product groups via API
  const searchProductGroups = useCallback(async (term: string) => {
    if (!term.trim()) {
      setProductGroups([]);
      return;
    }
    
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('product_groups')
        .select('*')
        .or(`name.ilike.%${term}%,article_code.ilike.%${term}%,description.ilike.%${term}%`)
        .order('name')
        .limit(50);

      if (groupsError) throw groupsError;

      if (!groups || groups.length === 0) {
        setProductGroups([]);
        return;
      }

      const groupIds = groups.map(g => g.id);
      const { data: items } = await supabase
        .from('product_group_items')
        .select('group_id, quantity, product_id')
        .in('group_id', groupIds);

      const productIds = [...new Set((items || []).map(i => i.product_id))];
      const { data: groupProducts } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      const productMap = new Map((groupProducts || []).map(p => [p.id, p]));

      const groupsWithDetails = groups.map(group => {
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
    } catch (error) {
      console.error('Error searching product groups:', error);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      searchProducts(searchTerm);
      if (showGroups) {
        searchProductGroups(searchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, showGroups, searchProducts, searchProductGroups]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setProducts([]);
      setProductGroups([]);
    }
  }, [isOpen]);

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

  // Images are rendered via SignedStorageImage component for private bucket access

  // ── Mobile product card ──
  const ProductCard = ({ product }: { product: Product }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => handleProductSelect(product)}
    >
      {product.image_path ? (
        <SignedStorageImage
          bucket="product-images"
          path={product.image_path}
          alt={product.name}
          className="h-12 w-12 object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {product.article_code && (
            <span className="text-[11px] text-muted-foreground font-mono">{product.article_code}</span>
          )}
          {product.supplier && (
            <span className="text-[11px] text-muted-foreground">· {product.supplier}</span>
          )}
        </div>
        {product.description && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {product.description}
          </p>
        )}
      </div>
      {product.website_link && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); window.open(product.website_link!, '_blank'); }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  // ── Mobile group card ──
  const GroupCard = ({ group }: { group: ProductGroup }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => handleGroupSelect(group)}
    >
      {group.image_path ? (
        <img
          src={getImageUrl(group.image_path) || ''}
          alt={group.name}
          className="h-12 w-12 object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          <Layers className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{group.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {group.article_code && (
            <span className="text-[11px] text-muted-foreground font-mono">{group.article_code}</span>
          )}
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{group.items_count || 0} items</Badge>
        </div>
        {group.products && group.products.length > 0 && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {group.products.slice(0, 2).map(p => `${p.product.name} ×${p.quantity}`).join(', ')}
            {group.products.length > 2 && '...'}
          </p>
        )}
      </div>
      <span className="text-xs font-semibold text-foreground flex-shrink-0">
        €{(group.total_price || 0).toFixed(2)}
      </span>
    </div>
  );

  // ── Shared inner content ──
  const SelectorContent = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, code, supplier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl"
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {!searchTerm.trim() ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Start typing to search products...</p>
        </div>
      ) : isSearching ? (
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Searching...</p>
        </div>
      ) : showGroups ? (
        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="products" className="text-xs">
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Products ({products.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Groups ({productGroups.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-3">
            {isMobile ? (
              <div className="space-y-2">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
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
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_path ? (
                          <img src={getImageUrl(product.image_path) || ''} alt={product.name} className="h-10 w-10 object-cover rounded" />
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
                              {product.description.length > 50 ? `${product.description.substring(0, 50)}...` : product.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.article_code && <Badge variant="outline">{product.article_code}</Badge>}</TableCell>
                      <TableCell>{product.supplier}</TableCell>
                      <TableCell>{product.standard_order_quantity}</TableCell>
                      <TableCell>
                        {product.website_link && (
                          <Button variant="ghost" size="sm" onClick={() => window.open(product.website_link!, '_blank')}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleProductSelect(product)}>Select</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No products found.</div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="mt-3">
            {isMobile ? (
              <div className="space-y-2">
                {productGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
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
                  {productGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        {group.image_path ? (
                          <img src={getImageUrl(group.image_path) || ''} alt={group.name} className="h-10 w-10 object-cover rounded" />
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
                              {group.products.slice(0, 3).map(p => `${p.product.name} (×${p.quantity})`).join(', ')}
                              {group.products.length > 3 && '...'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{group.article_code && <Badge variant="outline">{group.article_code}</Badge>}</TableCell>
                      <TableCell><Badge variant="secondary">{group.items_count || 0} products</Badge></TableCell>
                      <TableCell className="font-medium">€{(group.total_price || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleGroupSelect(group)} disabled={!onGroupSelect}>Select</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {productGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No groups found.</div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {isMobile ? (
            <div className="space-y-2">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
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
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_path ? (
                        <img src={getImageUrl(product.image_path) || ''} alt={product.name} className="h-10 w-10 object-cover rounded" />
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
                            {product.description.length > 50 ? `${product.description.substring(0, 50)}...` : product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.article_code && <Badge variant="outline">{product.article_code}</Badge>}</TableCell>
                    <TableCell>{product.supplier}</TableCell>
                    <TableCell>{product.standard_order_quantity}</TableCell>
                    <TableCell>
                      {product.website_link && (
                        <Button variant="ghost" size="sm" onClick={() => window.open(product.website_link!, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleProductSelect(product)}>Select</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {products.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No products found.</div>
          )}
        </>
      )}
    </div>
  );

  const triggerButton = (
    <Button variant={buttonVariant} type="button">
      <Package className="mr-2 h-4 w-4" />
      {buttonText}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto px-4 pb-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Select Product
            </SheetTitle>
          </SheetHeader>
          <SelectorContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
        </DialogHeader>
        <SelectorContent />
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelector;
