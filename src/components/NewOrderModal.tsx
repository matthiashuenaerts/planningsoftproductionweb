
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';

interface OrderItem {
  description: string;
  quantity: number;
  article_code: string;
  article_name?: string;
}

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: (orderId?: string) => void;
  showAddOrderButton?: boolean;
  prefilledData?: {
    accessories: any[];
    orderItems: OrderItem[];
  } | null;
}

const NewOrderModal = ({ 
  open, 
  onOpenChange, 
  projectId, 
  onSuccess, 
  showAddOrderButton = false,
  prefilledData = null
}: NewOrderModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier: '',
    expected_delivery: '',
    status: 'pending' as Order['status'],
    notes: '',
    order_reference: ''
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (prefilledData && open) {
      // Set order items from prefilled data
      setOrderItems(prefilledData.orderItems);
      
      // Generate supplier name based on accessories
      const supplierName = prefilledData.accessories.length > 0 
        ? `Accessories Order - ${prefilledData.accessories.map(a => a.article_name).join(', ').substring(0, 50)}${prefilledData.accessories.length > 1 ? '...' : ''}`
        : 'Accessories Order';
      
      setFormData(prev => ({
        ...prev,
        supplier: supplierName
      }));
    } else if (!prefilledData && open) {
      // Reset when no prefilled data
      setOrderItems([]);
      setFormData({
        supplier: '',
        expected_delivery: '',
        status: 'pending',
        notes: '',
        order_reference: ''
      });
    }
  }, [prefilledData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create the order
      const order = await orderService.create({
        project_id: projectId,
        supplier: formData.supplier,
        order_date: new Date().toISOString(),
        expected_delivery: new Date(formData.expected_delivery).toISOString(),
        status: formData.status
      });

      // Create order items
      for (const item of orderItems) {
        await orderService.createOrderItem({
          order_id: order.id,
          description: item.description,
          quantity: item.quantity,
          article_code: item.article_code
        });
      }

      toast({
        title: "Success",
        description: "Order created successfully"
      });

      setFormData({
        supplier: '',
        expected_delivery: '',
        status: 'pending',
        notes: '',
        order_reference: ''
      });
      setOrderItems([]);
      
      onOpenChange(false);
      onSuccess(order.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      description: '',
      quantity: 1,
      article_code: ''
    }]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const modalContent = (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create New Order</DialogTitle>
        <DialogDescription>
          Add a new order for this project with order items.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier">Supplier *</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="order_reference">Order Reference</Label>
            <Input
              id="order_reference"
              value={formData.order_reference}
              onChange={(e) => setFormData(prev => ({ ...prev, order_reference: e.target.value }))}
              placeholder="PO number, reference, etc."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expected_delivery">Expected Delivery *</Label>
            <Input
              id="expected_delivery"
              type="date"
              value={formData.expected_delivery}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: Order['status']) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes about this order..."
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Order Items</CardTitle>
              <Button type="button" onClick={addOrderItem} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No items added yet. Click "Add Item" to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.article_code}
                          onChange={(e) => updateOrderItem(index, 'article_code', e.target.value)}
                          placeholder="Article code"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateOrderItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOrderItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  if (showAddOrderButton) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Add Order
          </Button>
        </DialogTrigger>
        {modalContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {modalContent}
    </Dialog>
  );
};

export default NewOrderModal;
