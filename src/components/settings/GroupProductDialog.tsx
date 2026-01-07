import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Package, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  article_code: string | null;
  price_per_unit: number | null;
  image_path: string | null;
}

interface GroupItem {
  product_id: string;
  quantity: number;
  product?: Product;
}

interface ProductGroup {
  id: string;
  name: string;
  description: string | null;
  article_code: string | null;
  image_path: string | null;
}

interface GroupProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: ProductGroup | null;
  onSave: () => void;
}

const GroupProductDialog: React.FC<GroupProductDialogProps> = ({
  open,
  onOpenChange,
  editingGroup,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [articleCode, setArticleCode] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    if (open) {
      if (editingGroup) {
        setName(editingGroup.name);
        setDescription(editingGroup.description || '');
        setArticleCode(editingGroup.article_code || '');
        fetchGroupItems(editingGroup.id);
      } else {
        resetForm();
      }
    }
  }, [open, editingGroup]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setArticleCode('');
    setGroupItems([]);
    setSelectedProductId('');
    setImageFile(null);
  };

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setProducts([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, article_code, price_per_unit, image_path')
        .or(`name.ilike.%${searchTerm}%,article_code.ilike.%${searchTerm}%`)
        .order('name')
        .limit(50);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const fetchGroupItems = async (groupId: string) => {
    try {
      // Fetch group items with product details using a join
      const { data, error } = await supabase
        .from('product_group_items')
        .select(`
          product_id, 
          quantity,
          products:product_id (
            id,
            name,
            article_code,
            price_per_unit,
            image_path
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;

      const itemsWithProducts = (data || []).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.products as unknown as Product,
      }));

      setGroupItems(itemsWithProducts);
    } catch (error) {
      console.error('Error fetching group items:', error);
    }
  };

  const addProduct = () => {
    if (!selectedProductId) return;
    
    if (groupItems.find(item => item.product_id === selectedProductId)) {
      toast({
        title: 'Error',
        description: 'This product is already in the group',
        variant: 'destructive',
      });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    setGroupItems([...groupItems, { product_id: selectedProductId, quantity: 1, product }]);
    setSelectedProductId('');
  };

  const removeProduct = (productId: string) => {
    setGroupItems(groupItems.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setGroupItems(groupItems.map(item => 
      item.product_id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const calculateTotalPrice = () => {
    return groupItems.reduce((total, item) => {
      const product = item.product || products.find(p => p.id === item.product_id);
      const price = product?.price_per_unit || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileName = `groups/${Date.now()}-${file.name}`;
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    if (groupItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Add at least one product to the group',
        variant: 'destructive',
      });
      return;
    }

    try {
      let imagePath = editingGroup?.image_path || null;

      if (imageFile) {
        imagePath = await uploadImage(imageFile);
        if (!imagePath && imageFile) return;
      }

      const groupData = {
        name,
        description: description || null,
        article_code: articleCode || null,
        image_path: imagePath,
      };

      let groupId: string;

      if (editingGroup) {
        const { error } = await supabase
          .from('product_groups')
          .update(groupData)
          .eq('id', editingGroup.id);

        if (error) throw error;
        groupId = editingGroup.id;

        // Delete existing items
        await supabase
          .from('product_group_items')
          .delete()
          .eq('group_id', groupId);
      } else {
        const { data, error } = await supabase
          .from('product_groups')
          .insert(groupData)
          .select('id')
          .single();

        if (error) throw error;
        groupId = data.id;
      }

      // Insert new items
      const itemsToInsert = groupItems.map(item => ({
        group_id: groupId,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('product_group_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: 'Success',
        description: editingGroup ? 'Group product updated' : 'Group product created',
      });

      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('Error saving group product:', error);
      toast({
        title: 'Error',
        description: 'Failed to save group product',
        variant: 'destructive',
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {editingGroup ? 'Edit Group Product' : 'Create Group Product'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group product name"
              />
            </div>
            <div>
              <Label>Article Code</Label>
              <Input
                value={articleCode}
                onChange={(e) => setArticleCode(e.target.value)}
                placeholder="Optional article code"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div>
            <Label>Group Image</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="mt-1"
            />
            {editingGroup?.image_path && !imageFile && (
              <img
                src={getImageUrl(editingGroup.image_path) || ''}
                alt="Current"
                className="h-16 w-16 object-cover rounded mt-2"
              />
            )}
          </div>

          <div className="border-t pt-4">
            <Label className="text-base font-semibold">Products in Group</Label>
            
            <div className="space-y-2 mt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name or article code..."
                  className="pl-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {productSearch.trim() && products.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {products
                    .filter(p => !groupItems.find(item => item.product_id === p.id))
                    .map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        onClick={() => {
                          setSelectedProductId(product.id);
                          const foundProduct = products.find(p => p.id === product.id);
                          setGroupItems([...groupItems, { product_id: product.id, quantity: 1, product: foundProduct }]);
                          setProductSearch('');
                          setProducts([]);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {product.image_path && (
                            <img
                              src={getImageUrl(product.image_path) || ''}
                              alt={product.name}
                              className="h-8 w-8 object-cover rounded"
                            />
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.article_code && (
                              <div className="text-xs text-muted-foreground">{product.article_code}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.price_per_unit != null && (
                            <span className="text-sm text-muted-foreground">€{product.price_per_unit.toFixed(2)}</span>
                          )}
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    ))}
                  {products.filter(p => !groupItems.find(item => item.product_id === p.id)).length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      All matching products already added
                    </div>
                  )}
                </div>
              )}
              
              {productSearch.trim() && products.length === 0 && !isSearching && (
                <div className="text-sm text-muted-foreground">
                  No products found. Try a different search term.
                </div>
              )}
            </div>

            {groupItems.length > 0 && (
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-32">Quantity</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-32">Subtotal</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.map((item) => {
                    const product = item.product || products.find(p => p.id === item.product_id);
                    const unitPrice = product?.price_per_unit || 0;
                    const subtotal = unitPrice * item.quantity;

                    return (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product?.image_path && (
                              <img
                                src={getImageUrl(product.image_path) || ''}
                                alt={product?.name}
                                className="h-8 w-8 object-cover rounded"
                              />
                            )}
                            <span>{product?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>€{unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="font-medium">€{subtotal.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {groupItems.length > 0 && (
              <div className="flex justify-end mt-4 text-lg font-semibold">
                Total Price: €{calculateTotalPrice().toFixed(2)}
              </div>
            )}

            {groupItems.length === 0 && (
              <div className="text-center py-4 text-muted-foreground border rounded-md mt-4">
                No products added yet. Select products from the dropdown above.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? 'Uploading...' : editingGroup ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupProductDialog;
