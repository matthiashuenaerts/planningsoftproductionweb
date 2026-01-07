import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Upload, ExternalLink, FileText, Package, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import GroupProductDialog from './GroupProductDialog';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  article_code: z.string().optional(),
  supplier: z.string().optional(),
  standard_order_quantity: z.number().min(1, 'Quantity must be at least 1').optional(),
  website_link: z.string().url('Invalid URL').optional().or(z.literal('')),
  barcode: z.string().optional(),
  qr_code: z.string().optional(),
  location: z.string().optional(),
  price_per_unit: z.number().min(0, 'Price must be 0 or greater').optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

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
  price_per_unit: number | null;
  created_at: string;
  updated_at: string;
}

interface ProductGroup {
  id: string;
  name: string;
  description: string | null;
  article_code: string | null;
  image_path: string | null;
  total_price?: number;
  items_count?: number;
}

const PRODUCTS_PER_PAGE = 100;

const ProductsSettings: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  
  // Pagination and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      article_code: '',
      supplier: '',
      standard_order_quantity: 1,
      website_link: '',
      barcode: '',
      qr_code: '',
      location: '',
      price_per_unit: 0,
    },
  });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset and fetch when search changes
  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    fetchProducts(0, debouncedSearchTerm, true);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchSuppliers();
    fetchProductGroups();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (loadMoreRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
            fetchProducts(page + 1, debouncedSearchTerm, false);
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(loadMoreRef.current);
    }
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, page, debouncedSearchTerm]);

  const fetchProducts = async (pageNum: number, search: string, isReset: boolean) => {
    try {
      if (isReset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let query = supabase
        .from('products')
        .select('*')
        .order('name')
        .range(pageNum * PRODUCTS_PER_PAGE, (pageNum + 1) * PRODUCTS_PER_PAGE - 1);

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,article_code.ilike.%${search}%,supplier.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const newProducts = data || [];
      
      if (isReset) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }
      
      setPage(pageNum);
      setHasMore(newProducts.length === PRODUCTS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchProductGroups = async () => {
    try {
      // First get all groups
      const { data: groups, error: groupsError } = await supabase
        .from('product_groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;

      // Then get items with product prices
      const { data: items, error: itemsError } = await supabase
        .from('product_group_items')
        .select('group_id, quantity, product_id');

      if (itemsError) throw itemsError;

      // Get product prices
      const productIds = [...new Set(items?.map(i => i.product_id) || [])];
      let productPrices: Record<string, number> = {};
      
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, price_per_unit')
          .in('id', productIds);
        
        products?.forEach(p => {
          productPrices[p.id] = p.price_per_unit || 0;
        });
      }

      // Calculate totals for each group
      const groupsWithTotals = (groups || []).map(group => {
        const groupItems = items?.filter(i => i.group_id === group.id) || [];
        const totalPrice = groupItems.reduce((sum, item) => {
          return sum + (productPrices[item.product_id] || 0) * item.quantity;
        }, 0);
        return {
          ...group,
          total_price: totalPrice,
          items_count: groupItems.length,
        };
      });

      setProductGroups(groupsWithTotals);
    } catch (error) {
      console.error('Error fetching product groups:', error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group product deleted successfully',
      });
      fetchProductGroups();
    } catch (error) {
      console.error('Error deleting group product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete group product',
        variant: 'destructive',
      });
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) throw error;
      return data.path;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      let imagePath = editingProduct?.image_path || null;

      if (imageFile) {
        imagePath = await uploadImage(imageFile);
        if (!imagePath) return;
      }

      const productData = {
        name: data.name,
        description: data.description || null,
        article_code: data.article_code || null,
        supplier: data.supplier || null,
        standard_order_quantity: data.standard_order_quantity || 1,
        website_link: data.website_link || null,
        barcode: data.barcode || null,
        qr_code: data.qr_code || null,
        location: data.location || null,
        price_per_unit: data.price_per_unit || null,
        image_path: imagePath,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Product updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Product created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingProduct(null);
      setImageFile(null);
      form.reset();
      fetchProducts(0, debouncedSearchTerm, true);
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'Error',
        description: 'Failed to save product',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || '',
      article_code: product.article_code || '',
      supplier: product.supplier || '',
      standard_order_quantity: product.standard_order_quantity || 1,
      website_link: product.website_link || '',
      barcode: product.barcode || '',
      qr_code: product.qr_code || '',
      location: product.location || '',
      price_per_unit: product.price_per_unit || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      fetchProducts(0, debouncedSearchTerm, true);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;

    try {
      setCsvImporting(true);
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: 'Error',
          description: 'CSV file must have at least a header and one data row',
          variant: 'destructive',
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const productsToInsert = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const product: any = {};
        headers.forEach((header, index) => {
          const value = values[index];
          switch (header) {
            case 'name':
              product.name = value;
              break;
            case 'description':
              product.description = value || null;
              break;
            case 'article_code':
            case 'article code':
              product.article_code = value || null;
              break;
            case 'supplier':
              product.supplier = value || null;
              break;
            case 'standard_order_quantity':
            case 'standard order quantity':
            case 'quantity':
              product.standard_order_quantity = parseInt(value) || 1;
              break;
            case 'website_link':
            case 'website link':
            case 'website':
              product.website_link = value || null;
              break;
            case 'barcode':
              product.barcode = value || null;
              break;
            case 'qr_code':
            case 'qr code':
              product.qr_code = value || null;
              break;
            case 'location':
              product.location = value || null;
              break;
            case 'price_per_unit':
            case 'price per unit':
            case 'price':
              product.price_per_unit = parseFloat(value) || null;
              break;
          }
        });

        if (product.name) {
          productsToInsert.push(product);
        }
      }

      if (productsToInsert.length === 0) {
        toast({
          title: 'Error',
          description: 'No valid products found in CSV file',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('products')
        .insert(productsToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${productsToInsert.length} products imported successfully`,
      });

      setIsCsvDialogOpen(false);
      setCsvFile(null);
      fetchProducts(0, debouncedSearchTerm, true);
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to import CSV file',
        variant: 'destructive',
      });
    } finally {
      setCsvImporting(false);
    }
  };

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    // If it's already a full URL, return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(imagePath);
    return data.publicUrl;
  };

  if (loading) {
    return <div>Loading products...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Products Management</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Products from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                     <p className="text-sm text-muted-foreground mt-2">
                       Expected columns: name, description, article_code, supplier, standard_order_quantity, website_link, barcode, qr_code, location
                     </p>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCsvDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCsvImport} disabled={!csvFile || csvImporting}>
                      {csvImporting ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingProduct(null);
                form.reset();
                setImageFile(null);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="article_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Article Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.name} value={supplier.name}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="standard_order_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standard Order Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="price_per_unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per Unit (€)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field} 
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="website_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website Link</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                   <div className="grid grid-cols-2 gap-4">
                     <FormField
                       control={form.control}
                       name="barcode"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Barcode</FormLabel>
                           <FormControl>
                             <Input {...field} placeholder="Product barcode..." />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                     <FormField
                       control={form.control}
                       name="qr_code"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>QR Code</FormLabel>
                           <FormControl>
                             <Input {...field} placeholder="QR code text..." />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>

                   <FormField
                     control={form.control}
                     name="location"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Location</FormLabel>
                         <FormControl>
                           <Input {...field} placeholder="Storage location..." />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />

                  <div>
                    <Label>Product Image</Label>
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                      {editingProduct?.image_path && !imageFile && (
                        <div className="mt-2">
                          <img
                            src={getImageUrl(editingProduct.image_path) || ''}
                            alt="Current product"
                            className="h-20 w-20 object-cover rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={uploading}>
                      {uploading ? 'Uploading...' : editingProduct ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="products">
          <TabsList className="mb-4">
            <TabsTrigger value="products">Individual Products</TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Group Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {/* Search bar */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, article code, or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Article Code</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Order Qty</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
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
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.article_code && (
                        <Badge variant="outline">{product.article_code}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{product.supplier}</TableCell>
                    <TableCell>{product.location}</TableCell>
                    <TableCell>
                      {product.price_per_unit != null ? `€${product.price_per_unit.toFixed(2)}` : '-'}
                    </TableCell>
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
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Infinite scroll loader */}
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more products...
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <div className="text-muted-foreground text-sm">
                  All {products.length} products loaded
                </div>
              )}
            </div>

            {products.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No products found matching your search.' : 'No products found. Create your first product to get started.'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups">
            <div className="mb-4">
              <Button onClick={() => {
                setEditingGroup(null);
                setIsGroupDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Group Product
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Article Code</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Total Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productGroups.map((group) => (
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
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      {group.article_code && (
                        <Badge variant="outline">{group.article_code}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge>{group.items_count || 0} products</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      €{(group.total_price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingGroup(group);
                            setIsGroupDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {productGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No group products found. Create your first group product to bundle multiple products together.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <GroupProductDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        editingGroup={editingGroup}
        onSave={fetchProductGroups}
      />
    </Card>
  );
};

export default ProductsSettings;