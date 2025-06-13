
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
import { Plus, Trash2, Package, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { orderService } from '@/services/orderService';

interface AccessoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const AccessoriesDialog = ({ open, onOpenChange, projectId }: AccessoriesDialogProps) => {
  const { toast } = useToast();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">Loading accessories...</div>
            ) : accessories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No accessories found. Add your first accessory above.
              </div>
            ) : (
              accessories.map((accessory) => (
                <Card key={accessory.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={selectedAccessories.includes(accessory.id)}
                          onCheckedChange={() => toggleAccessorySelection(accessory.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{accessory.article_name}</h4>
                            {getStatusBadge(accessory.status)}
                          </div>
                          {accessory.article_description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {accessory.article_description}
                            </p>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                            {accessory.article_code && <span>Code: {accessory.article_code}</span>}
                            <span>Qty: {accessory.quantity}</span>
                            {accessory.stock_location && <span>Location: {accessory.stock_location}</span>}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(accessory.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
