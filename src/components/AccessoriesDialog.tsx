
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, ShoppingCart, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { orderService } from '@/services/orderService';
import { useNavigate } from 'react-router-dom';

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
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    article_name: '',
    article_description: '',
    article_code: '',
    quantity: 1,
    stock_location: '',
    status: 'to_check' as const
  });

  useEffect(() => {
    if (open) {
      loadAccessories();
      loadOrders();
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
        status: 'to_check'
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

  const handleStatusChange = async (accessoryId: string, newStatus: Accessory['status']) => {
    try {
      await accessoriesService.update(accessoryId, { status: newStatus });
      toast({
        title: "Success",
        description: "Accessory status updated successfully"
      });
      loadAccessories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handlePlaceOrder = async () => {
    if (selectedAccessories.length === 0) {
      toast({
        title: "Error",
        description: "Please select accessories to order",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create a new order
      const order = await orderService.create({
        project_id: projectId,
        supplier: 'Accessories Order',
        order_date: new Date().toISOString(),
        expected_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        status: 'pending'
      });

      // Link selected accessories to the order
      await accessoriesService.linkToOrder(selectedAccessories, order.id);

      toast({
        title: "Success",
        description: "Order placed successfully for selected accessories"
      });

      setSelectedAccessories([]);
      loadAccessories();
      loadOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to place order: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      to_check: { label: 'To Check', className: 'bg-gray-100 text-gray-800' },
      in_stock: { label: 'In Stock', className: 'bg-green-100 text-green-800' },
      delivered: { label: 'Delivered', className: 'bg-blue-100 text-blue-800' },
      to_order: { label: 'To Order', className: 'bg-yellow-100 text-yellow-800' },
      ordered: { label: 'Ordered', className: 'bg-orange-100 text-orange-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const toggleAccessorySelection = (accessoryId: string) => {
    setSelectedAccessories(prev =>
      prev.includes(accessoryId)
        ? prev.filter(id => id !== accessoryId)
        : [...prev, accessoryId]
    );
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Accessories</DialogTitle>
          <DialogDescription>
            Manage accessories for this project. You can add new accessories and place orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Accessory
            </Button>
            
            {selectedAccessories.length > 0 && (
              <Button onClick={handlePlaceOrder} variant="outline">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Place Order ({selectedAccessories.length})
              </Button>
            )}
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

                  <div className="grid grid-cols-3 gap-4">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Article Name</TableHead>
                  <TableHead>Article Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Stock Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading accessories...
                    </TableCell>
                  </TableRow>
                ) : accessories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No accessories found. Add your first accessory above.
                    </TableCell>
                  </TableRow>
                ) : (
                  accessories.map((accessory) => {
                    const orderInfo = getOrderInfo(accessory.order_id);
                    return (
                      <TableRow key={accessory.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAccessories.includes(accessory.id)}
                            onCheckedChange={() => toggleAccessorySelection(accessory.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{accessory.article_name}</TableCell>
                        <TableCell>{accessory.article_code || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate" title={accessory.article_description || ''}>
                          {accessory.article_description || '-'}
                        </TableCell>
                        <TableCell>{accessory.quantity}</TableCell>
                        <TableCell>{accessory.stock_location || '-'}</TableCell>
                        <TableCell>
                          <Select
                            value={accessory.status}
                            onValueChange={(value: Accessory['status']) => 
                              handleStatusChange(accessory.id, value)
                            }
                          >
                            <SelectTrigger className="w-32">
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
                        </TableCell>
                        <TableCell>
                          {orderInfo ? formatDate(orderInfo.expected_delivery) : '-'}
                        </TableCell>
                        <TableCell>
                          {orderInfo ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGoToOrder(orderInfo.id)}
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Go to
                            </Button>
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
  );
};
