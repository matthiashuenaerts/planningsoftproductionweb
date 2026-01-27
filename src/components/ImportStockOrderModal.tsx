import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Upload, FileText, Search, X, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { parsePDFForOrder, ParsedOrderData } from '@/services/pdfParseService';

interface ImportStockOrderModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

interface OrderItem {
  description: string;
  quantity: number;
  article_code: string;
  notes?: string;
  unit_price?: number;
  source?: 'manual' | 'product' | 'material' | 'pdf';
}

interface Product {
  id: string;
  name: string;
  article_code: string | null;
  description: string | null;
  supplier: string | null;
  price_per_unit: number | null;
}

interface Material {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_per_unit: number;
  supplier: string | null;
}

const ImportStockOrderModal: React.FC<ImportStockOrderModalProps> = ({ onClose, onImportSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { description: '', quantity: 1, article_code: '', notes: '', source: 'manual' }
  ]);

  // Database items
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Search states
  const [productSearch, setProductSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [activeTab, setActiveTab] = useState('manual');

  // PDF upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null);

  // Fetch products and materials on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Fetch products with pagination
        const BATCH_SIZE = 1000;
        let allProducts: Product[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, article_code, description, supplier, price_per_unit')
            .order('name')
            .range(offset, offset + BATCH_SIZE - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allProducts = [...allProducts, ...data];
            offset += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }
        setProducts(allProducts);

        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('cabinet_materials')
          .select('id, name, sku, category, cost_per_unit, supplier')
          .eq('in_stock', true)
          .order('category')
          .order('name');

        if (materialsError) throw materialsError;
        setMaterials(materialsData || []);

      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load products and materials",
          variant: "destructive"
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [toast]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { description: '', quantity: 1, article_code: '', notes: '', source: 'manual' }]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updated = orderItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setOrderItems(updated);
  };

  const addProductToOrder = (product: Product) => {
    const newItem: OrderItem = {
      description: product.name,
      quantity: 1,
      article_code: product.article_code || '',
      notes: product.description || '',
      unit_price: product.price_per_unit || undefined,
      source: 'product'
    };
    
    // Update supplier if not set
    if (!formData.supplier && product.supplier) {
      setFormData(prev => ({ ...prev, supplier: product.supplier! }));
    }
    
    setOrderItems(prev => [...prev.filter(item => item.description || item.article_code), newItem]);
    toast({ title: "Product added", description: product.name });
  };

  const addMaterialToOrder = (material: Material) => {
    const newItem: OrderItem = {
      description: `${material.name} (${material.category})`,
      quantity: 1,
      article_code: material.sku,
      notes: '',
      unit_price: material.cost_per_unit,
      source: 'material'
    };
    
    // Update supplier if not set
    if (!formData.supplier && material.supplier) {
      setFormData(prev => ({ ...prev, supplier: material.supplier! }));
    }
    
    setOrderItems(prev => [...prev.filter(item => item.description || item.article_code), newItem]);
    toast({ title: "Material added", description: material.name });
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF file",
        variant: "destructive"
      });
      return;
    }

    setPdfFile(file);
    setPdfLoading(true);

    try {
      // Parse the PDF
      const productMatches = products.map(p => ({
        id: p.id,
        name: p.name,
        article_code: p.article_code || '',
        description: p.description || undefined,
        supplier: p.supplier || undefined,
      }));

      const materialMatches = materials.map(m => ({
        id: m.id,
        name: m.name,
        sku: m.sku,
        category: m.category,
      }));

      const parsed = await parsePDFForOrder(file, productMatches, materialMatches);
      setParsedData(parsed);

      // Auto-fill form data
      if (parsed.supplier && !formData.supplier) {
        setFormData(prev => ({ ...prev, supplier: parsed.supplier! }));
      }
      if (parsed.orderDate) {
        setFormData(prev => ({ ...prev, orderDate: parsed.orderDate! }));
      }
      if (parsed.expectedDelivery) {
        setFormData(prev => ({ ...prev, expectedDelivery: parsed.expectedDelivery! }));
      }
      if (parsed.notes) {
        setFormData(prev => ({ ...prev, notes: parsed.notes! }));
      }

      // Add parsed items
      if (parsed.items.length > 0) {
        const newItems: OrderItem[] = parsed.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          article_code: item.article_code,
          notes: item.notes || '',
          unit_price: item.unit_price,
          source: 'pdf' as const
        }));
        
        setOrderItems(prev => {
          const existing = prev.filter(item => item.description || item.article_code);
          return [...existing, ...newItems];
        });

        toast({
          title: "PDF parsed successfully",
          description: `Found ${parsed.items.length} items`
        });
      } else {
        toast({
          title: "PDF parsed",
          description: "No matching items found. Please add items manually."
        });
      }

    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      toast({
        title: "Error parsing PDF",
        description: error.message || "Failed to extract data from PDF",
        variant: "destructive"
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    setParsedData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier.trim()) {
      toast({
        title: "Error",
        description: "Please fill in the supplier name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.expectedDelivery) {
      toast({
        title: "Error",
        description: "Please fill in the expected delivery date",
        variant: "destructive"
      });
      return;
    }

    // Validate that at least one order item has a description
    const validItems = orderItems.filter(item => item.description.trim());
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one order item with a description",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create the stock order with the provided supplier and no project_id
      const newOrder = await orderService.create({
        project_id: null, // No project linking
        supplier: formData.supplier,
        order_date: formData.orderDate,
        expected_delivery: formData.expectedDelivery,
        status: 'pending',
        order_type: 'standard',
        notes: formData.notes || null
      });

      // Add order items
      for (const item of validItems) {
        await orderService.createOrderItem({
          order_id: newOrder.id,
          description: item.description,
          quantity: item.quantity,
          article_code: item.article_code || '',
          notes: item.notes || null
        });
      }

      toast({
        title: "Success",
        description: `Stock order created with ${validItems.length} items`
      });

      onImportSuccess();
    } catch (error: any) {
      console.error('Error importing stock order:', error);
      toast({
        title: "Error",
        description: `Failed to import stock order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists for search
  const filteredProducts = productSearch
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.article_code && p.article_code.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.supplier && p.supplier.toLowerCase().includes(productSearch.toLowerCase()))
      ).slice(0, 50)
    : products.slice(0, 50);

  const filteredMaterials = materialSearch
    ? materials.filter(m =>
        m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.sku.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.category.toLowerCase().includes(materialSearch.toLowerCase())
      ).slice(0, 50)
    : materials.slice(0, 50);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import STOCK Order</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="pdf">PDF Import</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="manual" className="h-full overflow-auto p-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Input
                      id="supplier"
                      value={formData.supplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                      placeholder="Enter supplier name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="orderDate">Order Date</Label>
                    <Input
                      id="orderDate"
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="expectedDelivery">Expected Delivery *</Label>
                  <Input
                    id="expectedDelivery"
                    type="date"
                    value={formData.expectedDelivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Order Items ({orderItems.filter(i => i.description).length})</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-3">
                      {orderItems.map((item, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2 bg-background">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Item {index + 1}</span>
                              {item.source && item.source !== 'manual' && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.source}
                                </Badge>
                              )}
                            </div>
                            {orderItems.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrderItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="md:col-span-2">
                              <Input
                                value={item.description}
                                onChange={(e) => updateOrderItem(index, 'description', e.target.value)}
                                placeholder="Description"
                              />
                            </div>
                            <div>
                              <Input
                                value={item.article_code}
                                onChange={(e) => updateOrderItem(index, 'article_code', e.target.value)}
                                placeholder="Article code"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              placeholder="Qty"
                            />
                            <Input
                              value={item.notes || ''}
                              onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                              placeholder="Notes"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                
                <div>
                  <Label htmlFor="notes">Order Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes about this order"
                    rows={2}
                  />
                </div>
              </form>
            </TabsContent>

            <TabsContent value="products" className="h-full overflow-hidden flex flex-col p-1">
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products by name, code, or supplier..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {loadingData ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer border"
                        onClick={() => addProductToOrder(product)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{product.name}</div>
                          <div className="text-sm text-muted-foreground flex gap-2">
                            {product.article_code && <span>{product.article_code}</span>}
                            {product.supplier && <span>• {product.supplier}</span>}
                            {product.price_per_unit && <span>• €{product.price_per_unit.toFixed(2)}</span>}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No products found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Showing {filteredProducts.length} of {products.length} products. Click to add to order.
              </p>
            </TabsContent>

            <TabsContent value="materials" className="h-full overflow-hidden flex flex-col p-1">
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search materials by name, SKU, or category..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {loadingData ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {filteredMaterials.map(material => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer border"
                        onClick={() => addMaterialToOrder(material)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{material.name}</div>
                          <div className="text-sm text-muted-foreground flex gap-2">
                            <Badge variant="outline" className="text-xs">{material.category}</Badge>
                            <span>{material.sku}</span>
                            <span>• €{material.cost_per_unit.toFixed(2)}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No materials found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Showing {filteredMaterials.length} of {materials.length} materials. Click to add to order.
              </p>
            </TabsContent>

            <TabsContent value="pdf" className="h-full overflow-auto p-1">
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {pdfFile ? (
                    <div className="space-y-3">
                      <FileText className="h-12 w-12 mx-auto text-primary" />
                      <div>
                        <p className="font-medium">{pdfFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(pdfFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {pdfLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Analyzing PDF...</span>
                        </div>
                      ) : parsedData && (
                        <div className="text-sm text-left bg-muted p-3 rounded-lg">
                          <p><strong>Supplier:</strong> {parsedData.supplier || 'Not detected'}</p>
                          <p><strong>Order Date:</strong> {parsedData.orderDate || 'Not detected'}</p>
                          <p><strong>Delivery Date:</strong> {parsedData.expectedDelivery || 'Not detected'}</p>
                          <p><strong>Items Found:</strong> {parsedData.items.length}</p>
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={clearPdf}>
                        <X className="h-4 w-4 mr-1" />
                        Remove PDF
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">Click to upload PDF</p>
                      <p className="text-sm text-muted-foreground">
                        Order confirmation or invoice PDF
                      </p>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePdfUpload}
                      />
                    </label>
                  )}
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">How PDF Import Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload an order confirmation or invoice PDF</li>
                    <li>• The system extracts text and matches against your products/materials</li>
                    <li>• Supplier, dates, and item details are auto-filled when detected</li>
                    <li>• Review and adjust the extracted data before importing</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {orderItems.filter(i => i.description).length} items in order
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Order'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportStockOrderModal;
