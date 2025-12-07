import React, { useState, useEffect } from 'react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Upload, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
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
      fetchProducts();
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
      fetchProducts();
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
      fetchProducts();
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
        {products.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No products found. Create your first product to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductsSettings;