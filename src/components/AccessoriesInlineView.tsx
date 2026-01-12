import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, ExternalLink, Edit, ShoppingCart, QrCode, Upload, Pencil, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { orderService } from '@/services/orderService';
import { useNavigate } from 'react-router-dom';
import OrderEditModal from './OrderEditModal';
import NewOrderModal from './NewOrderModal';
import { AccessoryQrCodeDialog } from './AccessoryQrCodeDialog';
import AccessoryCsvImporter from './AccessoryCsvImporter';
import ProductSelector from './ProductSelector';
import { supabase } from '@/integrations/supabase/client';

interface AccessoriesInlineViewProps {
  projectId: string;
}

export const AccessoriesInlineView = ({ projectId }: AccessoriesInlineViewProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const [showQrCodeDialog, setShowQrCodeDialog] = useState(false);
  const [sortedAccessoriesForQr, setSortedAccessoriesForQr] = useState<Accessory[]>([]);
  const [accessoryToDelete, setAccessoryToDelete] = useState<string | null>(null);
  
  const [editingStatusAccessoryId, setEditingStatusAccessoryId] = useState<string | null>(null);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState<{status: Accessory['status'], quantity: number}>({status: 'to_check', quantity: 1});
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    article_name: string;
    article_description: string;
    article_code: string;
    quantity: number;
    stock_location: string;
    supplier: string;
    status: Accessory['status'];
    qr_code_text: string;
  }>({
    article_name: '',
    article_description: '',
    article_code: '',
    quantity: 1,
    stock_location: '',
    supplier: '',
    status: 'to_check',
    qr_code_text: ''
  });

  const statuses: Accessory['status'][] = ['to_check', 'in_stock', 'delivered', 'to_order', 'ordered'];

  const [showProcessingArticles, setShowProcessingArticles] = useState(false);
  const [processingArticleCodes, setProcessingArticleCodes] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<{
    article_name: string;
    article_description: string;
    article_code: string;
    quantity: number;
    stock_location: string;
    supplier: string;
    status: Accessory['status'];
    qr_code_text: string;
  }>({
    article_name: '',
    article_description: '',
    article_code: '',
    quantity: 1,
    stock_location: '',
    supplier: '',
    status: 'to_check',
    qr_code_text: ''
  });

  useEffect(() => {
    loadAccessories();
    loadOrders();
    loadSuppliers();
    loadProcessingArticleCodes();
  }, [projectId]);

  const loadProcessingArticleCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('article_code')
        .eq('is_processing_article', true)
        .not('article_code', 'is', null);

      if (error) throw error;
      const codes = new Set((data || []).map(p => p.article_code).filter(Boolean) as string[]);
      setProcessingArticleCodes(codes);
    } catch (error) {
      console.error('Failed to load processing article codes:', error);
    }
  };

  const loadAccessories = async () => {
    try {
      setLoading(true);
      const data = await accessoriesService.getByProject(projectId);
      setAccessories(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load accessories: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await orderService.getByProject(projectId);
      setOrders(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load orders: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load suppliers: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await accessoriesService.create({
        ...formData,
        project_id: projectId
      });
      
      setFormData({
        article_name: '',
        article_description: '',
        article_code: '',
        quantity: 1,
        stock_location: '',
        supplier: '',
        status: 'to_check' as const,
        qr_code_text: ''
      });
      
      setShowForm(false);
      await loadAccessories();
      
      toast({
        title: "Success",
        description: "Accessory added successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to add accessory: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accessoryToDelete) return;
    
    try {
      setLoading(true);
      await accessoriesService.delete(accessoryToDelete);
      await loadAccessories();
      
      toast({
        title: "Success",
        description: "Accessory deleted successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete accessory: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setAccessoryToDelete(null);
    }
  };

  const handleStatusUpdate = async (accessoryId: string, newStatus: Accessory['status'], quantityToOrder: number) => {
    try {
      setLoading(true);
      
      const accessory = accessories.find(a => a.id === accessoryId);
      if (!accessory) return;

      if (newStatus === 'to_order' && quantityToOrder < accessory.quantity) {
        // Split the accessory - update existing one with remaining quantity
        const remainingQuantity = accessory.quantity - quantityToOrder;
        await accessoriesService.update(accessoryId, { 
          quantity: remainingQuantity 
        });
        
        // Create new accessory with ordered quantity
        await accessoriesService.create({
          project_id: projectId,
          article_name: accessory.article_name,
          article_description: accessory.article_description,
          article_code: accessory.article_code,
          quantity: quantityToOrder,
          stock_location: accessory.stock_location,
          supplier: accessory.supplier,
          status: newStatus,
          qr_code_text: accessory.qr_code_text
        });
      } else {
        // Update the entire accessory
        await accessoriesService.update(accessoryId, { status: newStatus });
      }
      
      setEditingStatusAccessoryId(null);
      await loadAccessories();
      
      toast({
        title: "Success",
        description: "Accessory status updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update accessory status: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderEditModal(true);
  };

  const handleOrderEditSuccess = () => {
    loadAccessories();
    loadOrders();
  };

  const handleAccessorySelection = (accessoryId: string, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setSelectedAccessories(prev => 
      isChecked 
        ? [...prev, accessoryId]
        : prev.filter(id => id !== accessoryId)
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    if (isChecked) {
      // Only select from visible (filtered) accessories
      const selectableAccessories = accessories.filter(acc => {
        // Skip processing articles if they're hidden
        if (!showProcessingArticles && acc.article_code && processingArticleCodes.has(acc.article_code)) {
          return false;
        }
        return acc.status === 'to_order' && !acc.order_id;
      });
      setSelectedAccessories(selectableAccessories.map(acc => acc.id));
    } else {
      setSelectedAccessories([]);
    }
  };

  const handleCreateOrderFromAccessories = () => {
    if (selectedAccessories.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one accessory to create an order",
        variant: "destructive"
      });
      return;
    }
    setShowNewOrderModal(true);
  };

  const handleOrderCreated = async (orderId: string) => {
    try {
      await accessoriesService.linkToOrder(selectedAccessories, orderId);
      setSelectedAccessories([]);
      await loadAccessories();
      await loadOrders();
      
      toast({
        title: "Success",
        description: "Order created and accessories linked successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to link accessories to order: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleOpenQrDialog = () => {
    // Sort accessories by status priority and name
    const statusPriority = { 'to_check': 1, 'to_order': 2, 'in_stock': 3, 'ordered': 4, 'delivered': 5 };
    const sorted = [...accessories].sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.article_name.localeCompare(b.article_name);
    });
    setSortedAccessoriesForQr(sorted);
    setShowQrCodeDialog(true);
  };

  const getRowClassName = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-50 border-green-200';
      case 'in_stock': return 'bg-blue-50 border-blue-200';
      case 'ordered': return 'bg-yellow-50 border-yellow-200';
      case 'to_order': return 'bg-orange-50 border-orange-200';
      case 'to_check': return 'bg-gray-50 border-gray-200';
      default: return '';
    }
  };

  const getOrderInfo = (orderId: string | undefined) => {
    if (!orderId) return null;
    return orders.find(order => order.id === orderId);
  };

  const handleGoToOrder = (orderId: string) => {
    // Navigate to orders tab with order ID in URL
    const currentPath = window.location.pathname;
    const newUrl = `${currentPath}?tab=orders&orderId=${orderId}`;
    window.history.pushState({}, '', newUrl);
    
    // Trigger a popstate event to update the component
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleEditAccessory = (accessory: Accessory) => {
    setEditingAccessoryId(accessory.id);
    setEditFormData({
      article_name: accessory.article_name,
      article_description: accessory.article_description || '',
      article_code: accessory.article_code || '',
      quantity: accessory.quantity,
      stock_location: accessory.stock_location || '',
      supplier: accessory.supplier || '',
      status: accessory.status,
      qr_code_text: accessory.qr_code_text || ''
    });
  };

  const handleUpdateAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccessoryId) return;
    
    try {
      setLoading(true);
      await accessoriesService.update(editingAccessoryId, editFormData);
      
      setEditingAccessoryId(null);
      await loadAccessories();
      
      toast({
        title: "Success",
        description: "Accessory updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update accessory: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter accessories to optionally hide processing articles
  const filteredAccessories = accessories.filter(acc => {
    if (showProcessingArticles) return true;
    // Hide if article_code matches a processing article
    if (acc.article_code && processingArticleCodes.has(acc.article_code)) {
      return false;
    }
    return true;
  });

  const processingArticleCount = accessories.filter(acc => 
    acc.article_code && processingArticleCodes.has(acc.article_code)
  ).length;

  const getPrefilledOrderData = () => {
    const selectedItems = accessories.filter(acc => selectedAccessories.includes(acc.id));
    
    if (selectedItems.length === 0) return null;

    // Get supplier from first item, or most common supplier
    const suppliers = selectedItems.map(item => item.supplier).filter(Boolean);
    const supplier = suppliers.length > 0 ? suppliers[0] : '';

    return {
      accessories: selectedItems,
      orderItems: selectedItems.map(acc => ({
        description: acc.article_name,
        quantity: acc.quantity,
        article_code: acc.article_code || '',
        notes: acc.article_description || '',
        accessory_id: acc.id
      })),
      supplier
    };
  };

  const handleProductSelect = (product: any) => {
    setFormData(prev => ({
      ...prev,
      article_name: product.name,
      article_description: product.description || '',
      article_code: product.article_code || '',
      supplier: product.supplier || '',
      stock_location: product.location || '',
      qr_code_text: product.qr_code || ''
    }));
    setShowForm(true);
  };

  const handleGroupSelect = async (group: any, products: Array<{ product: any; quantity: number }>) => {
    try {
      const accessoriesToCreate = products.map(({ product, quantity }) => ({
        project_id: projectId,
        article_name: product.name,
        article_description: product.description || `From group: ${group.name}`,
        article_code: product.article_code || '',
        quantity: quantity,
        stock_location: product.location || '',
        supplier: product.supplier || '',
        status: 'to_check' as const,
        qr_code_text: product.qr_code || ''
      }));

      await accessoriesService.createMany(accessoriesToCreate);
      
      toast({
        title: "Success",
        description: `Added ${products.length} accessories from group "${group.name}"`
      });
      
      loadAccessories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to add accessories: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accessories</CardTitle>
            <div className="flex gap-2">
              <ProductSelector 
                onProductSelect={handleProductSelect} 
                onGroupSelect={handleGroupSelect}
                buttonText="Select from Products" 
              />
              <Button
                onClick={() => setShowForm(!showForm)}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Accessory
              </Button>
              <Button
                onClick={() => setShowCsvImporter(!showCsvImporter)}
                size="sm"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              {selectedAccessories.length > 0 && (
                <Button
                  onClick={handleCreateOrderFromAccessories}
                  size="sm"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Order ({selectedAccessories.length})
                </Button>
              )}
              <Button
                onClick={handleOpenQrDialog}
                size="sm"
                variant="outline"
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR Codes
              </Button>
              {processingArticleCount > 0 && (
                <Button
                  onClick={() => setShowProcessingArticles(!showProcessingArticles)}
                  size="sm"
                  variant={showProcessingArticles ? "default" : "outline"}
                >
                  {showProcessingArticles ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Processing ({processingArticleCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Add New Accessory</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="article_name">Article Name *</Label>
                      <Input
                        id="article_name"
                        value={formData.article_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, article_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="article_code">Article Code</Label>
                      <Input
                        id="article_code"
                        value={formData.article_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, article_code: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select
                        value={formData.supplier}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, supplier: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.name}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="stock_location">Stock Location</Label>
                      <Input
                        id="stock_location"
                        value={formData.stock_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, stock_location: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: Accessory['status']) => setFormData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map(status => (
                            <SelectItem key={status} value={status}>
                              {status.replace('_', ' ').toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="article_description">Description</Label>
                    <Textarea
                      id="article_description"
                      value={formData.article_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, article_description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="qr_code_text">QR Code Text</Label>
                    <Input
                      id="qr_code_text"
                      value={formData.qr_code_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, qr_code_text: e.target.value }))}
                      placeholder="Optional QR code text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Adding..." : "Add Accessory"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showCsvImporter && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Import Accessories from CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <AccessoryCsvImporter
                  projectId={projectId}
                  onImportSuccess={() => {
                    setShowCsvImporter(false);
                    loadAccessories();
                  }}
                />
              </CardContent>
            </Card>
          )}

          {editingAccessoryId && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Edit Accessory</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateAccessory} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_article_name">Article Name *</Label>
                      <Input
                        id="edit_article_name"
                        value={editFormData.article_name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, article_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_article_code">Article Code</Label>
                      <Input
                        id="edit_article_code"
                        value={editFormData.article_code}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, article_code: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_quantity">Quantity *</Label>
                      <Input
                        id="edit_quantity"
                        type="number"
                        min="1"
                        value={editFormData.quantity}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_supplier">Supplier</Label>
                      <Input
                        id="edit_supplier"
                        value={editFormData.supplier}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, supplier: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_stock_location">Stock Location</Label>
                      <Input
                        id="edit_stock_location"
                        value={editFormData.stock_location}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, stock_location: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_status">Status</Label>
                      <Select
                        value={editFormData.status}
                        onValueChange={(value: Accessory['status']) => setEditFormData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map(status => (
                            <SelectItem key={status} value={status}>
                              {status.replace('_', ' ').toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit_article_description">Description</Label>
                    <Textarea
                      id="edit_article_description"
                      value={editFormData.article_description}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, article_description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_qr_code_text">QR Code Text</Label>
                    <Input
                      id="edit_qr_code_text"
                      value={editFormData.qr_code_text}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, qr_code_text: e.target.value }))}
                      placeholder="Optional QR code text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Updating..." : "Update Accessory"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingAccessoryId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedAccessories.length > 0 && selectedAccessories.length === filteredAccessories.filter(acc => acc.status === 'to_order' && !acc.order_id).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccessories.map((accessory) => (
                  <TableRow key={accessory.id} className={getRowClassName(accessory.status)}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAccessories.includes(accessory.id)}
                        onCheckedChange={(checked) => handleAccessorySelection(accessory.id, checked as boolean)}
                        disabled={accessory.status !== 'to_order' || !!accessory.order_id}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{accessory.article_name}</div>
                        {accessory.article_description && (
                          <div className="text-sm text-muted-foreground">{accessory.article_description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{accessory.article_code || '-'}</TableCell>
                    <TableCell>{accessory.quantity}</TableCell>
                    <TableCell>{accessory.supplier || '-'}</TableCell>
                    <TableCell>{accessory.stock_location || '-'}</TableCell>
                    <TableCell>
                      {editingStatusAccessoryId === accessory.id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                              {accessory.status.replace('_', ' ').toUpperCase()}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="space-y-4">
                              <div>
                                <Label>New Status</Label>
                                <Select
                                  value={statusUpdateInfo.status}
                                  onValueChange={(value: Accessory['status']) => 
                                    setStatusUpdateInfo(prev => ({ ...prev, status: value }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statuses.map(status => (
                                      <SelectItem key={status} value={status}>
                                        {status.replace('_', ' ').toUpperCase()}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {statusUpdateInfo.status === 'to_order' && (
                                <div>
                                  <Label>Quantity to Order</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={accessory.quantity}
                                    value={statusUpdateInfo.quantity}
                                    onChange={(e) => 
                                      setStatusUpdateInfo(prev => ({ 
                                        ...prev, 
                                        quantity: Math.min(parseInt(e.target.value) || 1, accessory.quantity) 
                                      }))
                                    }
                                  />
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Available: {accessory.quantity}
                                  </p>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusUpdate(accessory.id, statusUpdateInfo.status, statusUpdateInfo.quantity)}
                                  disabled={loading}
                                >
                                  Update
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingStatusAccessoryId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingStatusAccessoryId(accessory.id);
                            setStatusUpdateInfo({ status: accessory.status, quantity: accessory.quantity });
                          }}
                        >
                          {accessory.status.replace('_', ' ').toUpperCase()}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {accessory.order_id ? (
                        <div>
                          {(() => {
                            const orderInfo = getOrderInfo(accessory.order_id);
                            return orderInfo ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{orderInfo.supplier}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGoToOrder(accessory.order_id!)}
                                  className="h-6 w-6 p-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Order not found</span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(accessory.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAccessory(accessory)}
                          className="h-7 w-7 p-0"
                          title="Edit accessory"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {accessory.order_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditOrder(accessory.order_id!)}
                            className="h-7 w-7 p-0"
                            title="Edit order"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAccessoryToDelete(accessory.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Delete accessory"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAccessories.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {accessories.length === 0 
                ? 'No accessories found. Add one using the form above or import from CSV.'
                : `No accessories to display. ${processingArticleCount} processing article(s) hidden.`
              }
            </div>
          )}
        </CardContent>
      </Card>

      {showOrderEditModal && selectedOrderId && (
        <OrderEditModal
          open={showOrderEditModal}
          onOpenChange={(open) => {
            setShowOrderEditModal(open);
            if (!open) setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
          onSuccess={handleOrderEditSuccess}
        />
      )}

      {showNewOrderModal && (
        <NewOrderModal
          open={showNewOrderModal}
          onOpenChange={setShowNewOrderModal}
          projectId={projectId}
          onSuccess={handleOrderCreated}
          showAddOrderButton={false}
          prefilledData={getPrefilledOrderData()}
        />
      )}

      <AccessoryQrCodeDialog
        open={showQrCodeDialog}
        onOpenChange={setShowQrCodeDialog}
        projectId={projectId}
        accessories={sortedAccessoriesForQr}
        onAccessoryUpdate={loadAccessories}
      />

      <AlertDialog open={!!accessoryToDelete} onOpenChange={(open) => !open && setAccessoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this accessory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};