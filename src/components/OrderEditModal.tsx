
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
import { Order, OrderItem, OrderStep } from '@/types/order';

interface OrderEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess: () => void;
}

const OrderEditModal = ({ open, onOpenChange, orderId, onSuccess }: OrderEditModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderSteps, setOrderSteps] = useState<OrderStep[]>([]);
  const [formData, setFormData] = useState({
    supplier: '',
    expected_delivery: '',
    status: 'pending' as Order['status'],
    notes: '',
    order_reference: '',
    order_date: ''
  });

  useEffect(() => {
    if (open && orderId) {
      loadOrderData();
    }
  }, [open, orderId]);

  const loadOrderData = async () => {
    try {
      setLoading(true);
      const orderData = await orderService.getById(orderId);
      const itemsData = await orderService.getOrderItems(orderId);
      
      setOrder(orderData);
      setOrderItems(itemsData);
      
      // Load order steps if it's a semi-finished order
      let stepsData: OrderStep[] = [];
      if (orderData.order_type === 'semi-finished') {
        stepsData = await orderService.getOrderSteps(orderId);
        setOrderSteps(stepsData);
      }
      
      setFormData({
        supplier: orderData.supplier,
        expected_delivery: new Date(orderData.expected_delivery).toISOString().split('T')[0],
        status: orderData.status,
        notes: orderData.notes || '',
        order_reference: '',
        order_date: new Date(orderData.order_date).toISOString().split('T')[0]
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update the order
      await orderService.update(orderId, {
        supplier: formData.supplier,
        expected_delivery: new Date(formData.expected_delivery).toISOString(),
        order_date: new Date(formData.order_date).toISOString(),
        status: formData.status,
        notes: formData.notes
      });

      // Handle order steps for semi-finished orders
      if (order?.order_type === 'semi-finished') {
        const existingSteps = await orderService.getOrderSteps(orderId);
        
        // Delete removed steps
        const currentStepIds = orderSteps.filter(step => step.id).map(step => step.id);
        const stepsToDelete = existingSteps.filter(step => !currentStepIds.includes(step.id));
        
        for (const step of stepsToDelete) {
          await orderService.deleteOrderStep(step.id);
        }

        // Update existing steps and create new ones
        for (const step of orderSteps) {
          if (step.id) {
            // Update existing step
            await orderService.updateOrderStep(step.id, {
              name: step.name,
              supplier: step.supplier,
              status: step.status,
              start_date: step.start_date,
              end_date: step.end_date,
              expected_duration_days: step.expected_duration_days,
              notes: step.notes
            });
          } else {
            // Create new step
            await orderService.createOrderStep({
              order_id: orderId,
              step_number: step.step_number,
              name: step.name,
              supplier: step.supplier,
              status: step.status,
              start_date: step.start_date,
              end_date: step.end_date,
              expected_duration_days: step.expected_duration_days,
              notes: step.notes
            });
          }
        }
      }

      // Get existing order items
      const existingItems = await orderService.getOrderItems(orderId);
      
      // Delete removed items
      const currentItemIds = orderItems.filter(item => item.id).map(item => item.id);
      const itemsToDelete = existingItems.filter(item => !currentItemIds.includes(item.id));
      
      for (const item of itemsToDelete) {
        await orderService.deleteOrderItem(item.id);
      }

      // Update existing items and create new ones
      for (const item of orderItems) {
        if (item.id) {
          // Update existing item
          await orderService.updateOrderItem(item.id, {
            description: item.description,
            quantity: item.quantity,
            article_code: item.article_code
          });
        } else {
          // Create new item
          await orderService.createOrderItem({
            order_id: orderId,
            description: item.description,
            quantity: item.quantity,
            article_code: item.article_code
          });
        }
      }

      toast({
        title: "Success",
        description: "Order updated successfully"
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      id: '',
      order_id: orderId,
      description: '',
      quantity: 1,
      article_code: '',
      created_at: '',
      updated_at: ''
    }]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addOrderStep = () => {
    const newStepNumber = Math.max(0, ...orderSteps.map(s => s.step_number)) + 1;
    setOrderSteps(prev => [...prev, {
      id: '',
      order_id: orderId,
      step_number: newStepNumber,
      name: '',
      supplier: '',
      status: 'pending',
      start_date: null,
      end_date: null,
      expected_duration_days: null,
      notes: null,
      created_at: '',
      updated_at: ''
    }]);
  };

  const updateOrderStep = (index: number, field: keyof OrderStep, value: string | number | null) => {
    setOrderSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const removeOrderStep = (index: number) => {
    setOrderSteps(prev => prev.filter((_, i) => i !== index));
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
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

  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8">
            {loading ? 'Loading order...' : 'Order not found'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogDescription>
            Update order details and manage order items. Order created on {formatDate(order.created_at)}.
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                required
              />
            </div>
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
                  <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
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

          {/* Order Steps for Semi-finished Orders */}
          {order?.order_type === 'semi-finished' && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Processing Steps</CardTitle>
                  <Button type="button" onClick={addOrderStep} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {orderSteps.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No processing steps defined. Click "Add Step" to get started.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {orderSteps.map((step, index) => (
                      <Card key={step.id || index} className="p-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label htmlFor={`step-name-${index}`}>Step Name *</Label>
                            <Input
                              id={`step-name-${index}`}
                              value={step.name}
                              onChange={(e) => updateOrderStep(index, 'name', e.target.value)}
                              placeholder="e.g., Cutting, Assembly, Finishing"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor={`step-supplier-${index}`}>Supplier</Label>
                            <Input
                              id={`step-supplier-${index}`}
                              value={step.supplier || ''}
                              onChange={(e) => updateOrderStep(index, 'supplier', e.target.value)}
                              placeholder="Step supplier (optional)"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label htmlFor={`step-status-${index}`}>Status</Label>
                            <Select
                              value={step.status}
                              onValueChange={(value: OrderStep['status']) => updateOrderStep(index, 'status', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="delayed">Delayed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`step-start-${index}`}>Start Date</Label>
                            <Input
                              id={`step-start-${index}`}
                              type="date"
                              value={step.start_date ? new Date(step.start_date).toISOString().split('T')[0] : ''}
                              onChange={(e) => updateOrderStep(index, 'start_date', e.target.value || null)}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`step-end-${index}`}>End Date</Label>
                            <Input
                              id={`step-end-${index}`}
                              type="date"
                              value={step.end_date ? new Date(step.end_date).toISOString().split('T')[0] : ''}
                              onChange={(e) => updateOrderStep(index, 'end_date', e.target.value || null)}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`step-duration-${index}`}>Duration (days)</Label>
                            <Input
                              id={`step-duration-${index}`}
                              type="number"
                              min="1"
                              value={step.expected_duration_days || ''}
                              onChange={(e) => updateOrderStep(index, 'expected_duration_days', parseInt(e.target.value) || null)}
                              placeholder="Days"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label htmlFor={`step-notes-${index}`}>Notes</Label>
                            <Textarea
                              id={`step-notes-${index}`}
                              value={step.notes || ''}
                              onChange={(e) => updateOrderStep(index, 'notes', e.target.value)}
                              placeholder="Additional notes for this step..."
                              rows={2}
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOrderStep(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  No items in this order. Click "Add Item" to get started.
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
                      <TableRow key={item.id || index}>
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
              {loading ? 'Updating...' : 'Update Order'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderEditModal;
