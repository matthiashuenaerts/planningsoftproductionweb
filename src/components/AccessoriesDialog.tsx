
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Trash2, ExternalLink, Edit, ShoppingCart, QrCode, Upload } from 'lucide-react';
import ProductSelector from './ProductSelector';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { orderService } from '@/services/orderService';
import { useNavigate } from 'react-router-dom';
import OrderEditModal from './OrderEditModal';
import NewOrderModal from './NewOrderModal';
import { AccessoryQrCodeDialog } from './AccessoryQrCodeDialog';
import AccessoryCsvImporter from './AccessoryCsvImporter';
import { supabase } from '@/integrations/supabase/client';

interface AccessoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const AccessoriesDialog = ({ open, onOpenChange, projectId }: AccessoriesDialogProps) => {
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
  
  const [editingStatusAccessoryId, setEditingStatusAccessoryId] = useState<string | null>(null);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState<{status: Accessory['status'], quantity: number}>({status: 'to_check', quantity: 1});

  const statuses: Accessory['status'][] = ['to_check', 'in_stock', 'delivered', 'to_order', 'ordered'];

  const [formData, setFormData] = useState({
    article_name: '',
    article_description: '',
    article_code: '',
    quantity: 1,
    stock_location: '',
    supplier: '',
    status: 'to_check' as const,
    qr_code_text: ''
  });

  useEffect(() => {
    if (open) {
      loadAccessories();
      loadOrders();
      loadSuppliers();
    }
  }, [open, projectId]);

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
      await accessoriesService.create({
        ...formData,
        project_id: projectId
      });
      
      toast({
        title: "Success",
        description: "Accessory added successfully"
      });
      
      setFormData({
        article_name: '',
        article_description: '',
        article_code: '',
        quantity: 1,
        stock_location: '',
        supplier: '',
        status: 'to_check',
        qr_code_text: ''
      });
      setShowForm(false);
      loadAccessories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to add accessory: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await accessoriesService.delete(id);
      toast({
        title: "Success",
        description: "Accessory deleted successfully"
      });
      loadAccessories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete accessory: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleStatusUpdate = async (accessoryId: string, newStatus: Accessory['status'], quantityToOrder: number) => {
    const accessory = accessories.find(a => a.id === accessoryId);
    if (!accessory) return;

    setLoading(true);

    try {
        if (newStatus === 'to_order' && quantityToOrder > 0 && quantityToOrder < accessory.quantity) {
            // Split accessory
            await accessoriesService.update(accessory.id, {
                quantity: accessory.quantity - quantityToOrder,
                status: 'in_stock',
            });
            const { id, created_at, updated_at, ...restOfAccessory } = accessory;
            await accessoriesService.create({
                ...restOfAccessory,
                project_id: projectId,
                quantity: quantityToOrder,
                status: 'to_order',
            });
            toast({ title: "Success", description: "Accessory status updated and new 'to order' item created." });
        } else {
            await accessoriesService.update(accessory.id, { status: newStatus });
            toast({ title: "Success", description: "Accessory status updated successfully" });
        }
        loadAccessories();
    } catch (error: any) {
        toast({ title: "Error", description: `Failed to update status: ${error.message}`, variant: "destructive" });
    } finally {
        setLoading(false);
        setEditingStatusAccessoryId(null);
    }
  };

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderEditModal(true);
  };

  const handleOrderEditSuccess = () => {
    loadOrders();
    loadAccessories();
    setShowOrderEditModal(false);
    setSelectedOrderId(null);
  };

  const handleAccessorySelection = (accessoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccessories(prev => [...prev, accessoryId]);
    } else {
      setSelectedAccessories(prev => prev.filter(id => id !== accessoryId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccessories(accessories.map(acc => acc.id));
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

    const selectedAccessoryObjects = accessories.filter(acc => 
      selectedAccessories.includes(acc.id)
    );

    // Check if all selected accessories have the same supplier
    const suppliers = selectedAccessoryObjects.map(acc => acc.supplier).filter(Boolean);
    const uniqueSuppliers = [...new Set(suppliers)];
    const commonSupplier = uniqueSuppliers.length === 1 ? uniqueSuppliers[0] : '';

    // Create order items from selected accessories
    const orderItems = selectedAccessoryObjects.map(accessory => ({
      description: accessory.article_description || accessory.article_name,
      quantity: accessory.quantity,
      article_code: accessory.article_code || '',
      article_name: accessory.article_name
    }));

    // Generate supplier name
    let supplierName = '';
    if (commonSupplier) {
      supplierName = commonSupplier;
    } else if (selectedAccessoryObjects.length > 0) {
      const articleNames = selectedAccessoryObjects.map(a => a.article_name).join(', ');
      supplierName = `Mixed Accessories - ${articleNames.substring(0, 50)}${articleNames.length > 50 ? '...' : ''}`;
    } else {
      supplierName = 'Accessories Order';
    }

    setShowNewOrderModal(true);
  };

  const handleOrderCreated = async (orderId: string) => {
    // Link selected accessories to the new order and update their status
    try {
      await accessoriesService.linkToOrder(selectedAccessories, orderId);
      
      toast({
        title: "Success",
        description: "Order created and accessories linked successfully"
      });
      
      setSelectedAccessories([]);
      setShowNewOrderModal(false);
      loadAccessories();
      loadOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to link accessories to order: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleOpenQrDialog = () => {
    if (accessories.length === 0) {
        toast({ title: "No accessories", description: "There are no accessories to show.", variant: "destructive" });
        return;
    }
    const sorted = [...accessories].sort((a, b) => {
        const locA = a.stock_location || '';
        const locB = b.stock_location || '';
        return locA.localeCompare(locB);
    });
    setSortedAccessoriesForQr(sorted);
    setShowQrCodeDialog(true);
  };

  const getRowClassName = (status: string) => {
    switch (status) {
      case 'in_stock':
      case 'delivered':
        return 'bg-green-50 hover:bg-green-100';
      case 'to_order':
        return 'bg-red-50 hover:bg-red-100';
      default:
        return '';
    }
  };

  const getOrderInfo = (orderId: string | undefined) => {
    if (!orderId) return null;
    return orders.find(order => order.id === orderId);
  };

  const handleGoToOrder = (orderId: string) => {
    navigate(`/projects/${projectId}/orders`);
    onOpenChange(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handleProductSelect = (product: any) => {
    setFormData({
      article_name: product.name,
      article_description: product.description || '',
      article_code: product.article_code || '',
      quantity: product.standard_order_quantity || 1,
      stock_location: '',
      supplier: product.supplier || '',
      status: 'to_check' as const,
      qr_code_text: product.qr_code || ''
    });
    setShowForm(true);
  };

  const getPrefilledOrderData = () => {
    const selectedAccessoryObjects = accessories.filter(acc => 
      selectedAccessories.includes(acc.id)
    );

    // Check if all selected accessories have the same supplier
    const suppliers = selectedAccessoryObjects.map(acc => acc.supplier).filter(Boolean);
    const uniqueSuppliers = [...new Set(suppliers)];
    const commonSupplier = uniqueSuppliers.length === 1 ? uniqueSuppliers[0] : '';

    // Create order items from selected accessories
    const orderItems = selectedAccessoryObjects.map(accessory => ({
      description: accessory.article_description || accessory.article_name,
      quantity: accessory.quantity,
      article_code: accessory.article_code || '',
      article_name: accessory.article_name
    }));

    return {
      accessories: selectedAccessoryObjects,
      orderItems,
      supplier: commonSupplier
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Accessories</DialogTitle>
            <DialogDescription>
              Manage accessories for this project. Select accessories to create orders.
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <ProductSelector onProductSelect={handleProductSelect} buttonText="Select from Products" />
                <Button onClick={() => { setShowForm(!showForm); setShowCsvImporter(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Accessory
                </Button>
                <Button variant="outline" onClick={() => { setShowCsvImporter(!showCsvImporter); setShowForm(false); }}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import from CSV
                </Button>
                {selectedAccessories.length > 0 && (
                  <Button onClick={handleCreateOrderFromAccessories} variant="outline">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Create Order ({selectedAccessories.length})
                  </Button>
                )}
                <Button onClick={handleOpenQrDialog} variant="outline">
                  <QrCode className="mr-2 h-4 w-4" />
                  Open with QR
                </Button>
              </div>
            </div>

            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Accessory</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    <div>
                      <Label htmlFor="article_description">Article Description</Label>
                      <Textarea
                        id="article_description"
                        value={formData.article_description}
                        onChange={(e) => setFormData(prev => ({ ...prev, article_description: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                        <Label htmlFor="qr_code_text">QR Code Text</Label>
                        <Input
                          id="qr_code_text"
                          value={formData.qr_code_text}
                          onChange={(e) => setFormData(prev => ({ ...prev, qr_code_text: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="quantity">Quantity *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                          required
                        />
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
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to_check">To Check</SelectItem>
                            <SelectItem value="in_stock">In Stock</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="to_order">To Order</SelectItem>
                            <SelectItem value="ordered">Ordered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit">Add Accessory</Button>
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {showCsvImporter && (
              <Card>
                <CardHeader>
                  <CardTitle>Import Accessories from CSV</CardTitle>
                </CardHeader>
                <CardContent>
                  <AccessoryCsvImporter 
                    projectId={projectId} 
                    onImportSuccess={() => {
                      loadAccessories();
                      setShowCsvImporter(false);
                    }} 
                  />
                </CardContent>
              </Card>
            )}


            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedAccessories.length === accessories.length && accessories.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Article Name</TableHead>
                    <TableHead>Article Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Stock Location</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        Loading accessories...
                      </TableCell>
                    </TableRow>
                  ) : accessories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No accessories found. Add your first accessory above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    accessories.map((accessory) => {
                      const orderInfo = getOrderInfo(accessory.order_id);
                      return (
                        <TableRow key={accessory.id} className={getRowClassName(accessory.status)}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAccessories.includes(accessory.id)}
                              onCheckedChange={(checked) => handleAccessorySelection(accessory.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{accessory.article_name}</TableCell>
                          <TableCell>{accessory.article_code || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={accessory.article_description || ''}>
                            {accessory.article_description || '-'}
                          </TableCell>
                          <TableCell>{accessory.quantity}</TableCell>
                          <TableCell>{accessory.stock_location || '-'}</TableCell>
                          <TableCell>{accessory.supplier || '-'}</TableCell>
                          <TableCell>
                            <Popover 
                                open={editingStatusAccessoryId === accessory.id} 
                                onOpenChange={(isOpen) => {
                                    if (isOpen) {
                                        setEditingStatusAccessoryId(accessory.id);
                                        setStatusUpdateInfo({ status: accessory.status, quantity: accessory.status === 'to_order' ? accessory.quantity : 1 });
                                    } else {
                                        setEditingStatusAccessoryId(null);
                                    }
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="capitalize">
                                        {accessory.status.replace(/_/g, ' ')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4 space-y-4">
                                    <h4 className="font-medium leading-none">Update Status</h4>
                                    <div className="space-y-2">
                                        <Label>New Status</Label>
                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            {statuses.map((status) => (
                                                <Button
                                                  key={status}
                                                  variant={statusUpdateInfo.status === status ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => setStatusUpdateInfo(prev => ({ ...prev, status, quantity: status === 'to_order' ? accessory.quantity : prev.quantity }))}
                                                  className="capitalize w-full justify-center"
                                                >
                                                    {status.replace(/_/g, ' ')}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    {statusUpdateInfo.status === 'to_order' && accessory.quantity > 1 && (
                                        <div className="space-y-2">
                                            <Label htmlFor="quantity_to_order">Quantity to Order</Label>
                                            <Input
                                                id="quantity_to_order"
                                                type="number"
                                                min="1"
                                                max={accessory.quantity}
                                                value={statusUpdateInfo.quantity}
                                                onChange={(e) => setStatusUpdateInfo(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                            />
                                        </div>
                                    )}
                                    <Button 
                                        onClick={() => handleStatusUpdate(accessory.id, statusUpdateInfo.status, statusUpdateInfo.quantity)}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? 'Saving...' : 'Save'}
                                    </Button>
                                </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            {orderInfo ? formatDate(orderInfo.expected_delivery) : '-'}
                          </TableCell>
                          <TableCell>
                            {orderInfo ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleGoToOrder(orderInfo.id)}
                                  className="flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Go to
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditOrder(orderInfo.id)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  Edit
                                </Button>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(accessory.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedOrderId && (
        <OrderEditModal
          open={showOrderEditModal}
          onOpenChange={setShowOrderEditModal}
          orderId={selectedOrderId}
          onSuccess={handleOrderEditSuccess}
        />
      )}

      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId}
        onSuccess={handleOrderCreated}
        prefilledData={selectedAccessories.length > 0 ? getPrefilledOrderData() : null}
      />
      
      <AccessoryQrCodeDialog
        open={showQrCodeDialog}
        onOpenChange={setShowQrCodeDialog}
        accessories={sortedAccessoriesForQr}
        projectId={projectId}
        onAccessoryUpdate={loadAccessories}
      />
    </>
  );
};
